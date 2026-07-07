use std::time::Duration;

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};

use crate::ai::{
    config::ProviderConfig,
    error::AIError,
    keychain,
    provider::{
        AIProvider, BoxFuture, CompletionChunk, CompletionRequest, CompletionResponse, Message,
        ModelInfo, Role, Usage,
    },
};

const DEFAULT_BASE_URL: &str = "https://generativelanguage.googleapis.com";
const API_VERSION: &str = "v1beta";

pub struct GeminiProvider {
    config: ProviderConfig,
    client: reqwest::Client,
    api_key: String,
}

impl GeminiProvider {
    pub fn new(config: ProviderConfig) -> Result<Self, AIError> {
        let api_key = match &config.api_key {
            Some(key) if !key.is_empty() => key.clone(),
            _ => match keychain::get_api_key("gemini")? {
                Some(key) => key,
                None => return Err(AIError::InvalidApiKey),
            },
        };

        let mut headers = reqwest::header::HeaderMap::new();
        headers.insert(
            reqwest::header::CONTENT_TYPE,
            reqwest::header::HeaderValue::from_static("application/json"),
        );

        if let Some(extra) = &config.extra_headers {
            for (k, v) in extra {
                headers.insert(
                    reqwest::header::HeaderName::from_bytes(k.as_bytes())
                        .map_err(|e| AIError::Provider(format!("invalid header name: {e}")))?,
                    reqwest::header::HeaderValue::from_str(v)
                        .map_err(|e| AIError::Provider(format!("invalid header value: {e}")))?,
                );
            }
        }

        let client = reqwest::Client::builder()
            .default_headers(headers)
            .timeout(Duration::from_secs(config.timeout_seconds))
            .build()
            .map_err(|e| AIError::Network(e.to_string()))?;

        Ok(Self {
            config,
            client,
            api_key,
        })
    }

    fn base_url(&self) -> String {
        if self.config.base_url.is_empty() {
            DEFAULT_BASE_URL.to_string()
        } else {
            self.config.base_url.trim_end_matches('/').to_string()
        }
    }

    fn validate_model(&self) -> Result<(), AIError> {
        if self.config.model.is_empty() {
            return Err(AIError::InvalidModel("model is empty".to_string()));
        }
        Ok(())
    }

    fn build_url(&self, stream: bool) -> String {
        let action = if stream {
            "streamGenerateContent"
        } else {
            "generateContent"
        };
        format!(
            "{}/{API_VERSION}/models/{}:{action}?key={}",
            self.base_url(),
            self.config.model,
            self.api_key
        )
    }

    fn split_messages(messages: Vec<Message>) -> (Option<String>, Vec<GeminiContent>) {
        let mut system = None;
        let mut contents = Vec::new();

        for msg in messages {
            match msg.role {
                Role::System => {
                    system = Some(msg.content);
                }
                _ => {
                    contents.push(GeminiContent::from(msg));
                }
            }
        }

        (system, merge_consecutive_contents(contents))
    }
}

impl AIProvider for GeminiProvider {
    fn name(&self) -> &'static str {
        "gemini"
    }

    fn config(&self) -> &ProviderConfig {
        &self.config
    }

    fn models(&self) -> Vec<ModelInfo> {
        Vec::new()
    }

    fn list_models(&self) -> BoxFuture<'_, Result<Vec<ModelInfo>, AIError>> {
        Box::pin(async move {
            let url = format!(
                "{}/{API_VERSION}/models?key={}",
                self.base_url(),
                self.api_key
            );
            let response = self
                .client
                .get(&url)
                .send()
                .await
                .map_err(map_reqwest_error)?;

            let status = response.status();
            if !status.is_success() {
                let text = response.text().await.unwrap_or_default();
                return Err(map_gemini_error(status, &text));
            }

            let body: serde_json::Value = response
                .json()
                .await
                .map_err(|e| AIError::Serialization(e.to_string()))?;

            let models = body
                .get("models")
                .and_then(|m| m.as_array())
                .unwrap_or(&vec![])
                .iter()
                .filter_map(|m| {
                    let name = m.get("name").and_then(|n| n.as_str())?;
                    // Names are returned as "models/gemini-..."; strip the prefix.
                    let id = name.strip_prefix("models/").unwrap_or(name);
                    let supported = m
                        .get("supportedGenerationMethods")
                        .and_then(|s| s.as_array())
                        .map(|arr| arr.iter().any(|v| v.as_str() == Some("generateContent")))
                        .unwrap_or(false);
                    if !supported {
                        return None;
                    }
                    Some(ModelInfo {
                        id: id.to_string(),
                        name: id.to_string(),
                        context_window: None,
                        supports_streaming: true,
                        supports_vision: true,
                    })
                })
                .collect();

            Ok(models)
        })
    }

    fn complete(
        &self,
        req: CompletionRequest,
    ) -> BoxFuture<'_, Result<CompletionResponse, AIError>> {
        Box::pin(async move {
            self.validate_model()?;

            let (system, contents) = Self::split_messages(req.messages);
            let body =
                GeminiRequestBody::new(contents, system, req.temperature, req.max_tokens, false);
            let url = self.build_url(false);

            let response = self
                .client
                .post(&url)
                .json(&body)
                .send()
                .await
                .map_err(map_reqwest_error)?;

            let status = response.status();
            if !status.is_success() {
                let text = response.text().await.unwrap_or_default();
                return Err(map_gemini_error(status, &text));
            }

            let gemini_resp: GeminiResponse = response
                .json()
                .await
                .map_err(|e| AIError::Serialization(e.to_string()))?;

            let content = gemini_resp
                .candidates
                .into_iter()
                .next()
                .and_then(|c| c.content)
                .map(|c| c.parts.into_iter().map(|p| p.text).collect::<String>())
                .unwrap_or_default();

            Ok(CompletionResponse {
                content,
                model: self.config.model.clone(),
                usage: gemini_resp.usage_metadata.map(|u| Usage {
                    prompt_tokens: u.prompt_token_count,
                    completion_tokens: u.candidates_token_count,
                    total_tokens: u.total_token_count,
                }),
                tool_calls: None,
                finish_reason: None,
            })
        })
    }

    fn stream(
        &self,
        req: CompletionRequest,
    ) -> BoxFuture<'_, Result<Vec<CompletionChunk>, AIError>> {
        Box::pin(async move {
            self.validate_model()?;

            let (system, contents) = Self::split_messages(req.messages);
            let body =
                GeminiRequestBody::new(contents, system, req.temperature, req.max_tokens, true);
            let url = self.build_url(true);

            let response = self
                .client
                .post(&url)
                .json(&body)
                .send()
                .await
                .map_err(map_reqwest_error)?;

            let status = response.status();
            if !status.is_success() {
                let text = response.text().await.unwrap_or_default();
                return Err(map_gemini_error(status, &text));
            }

            let bytes = response
                .bytes()
                .await
                .map_err(|e| AIError::Network(e.to_string()))?;
            let text = String::from_utf8_lossy(&bytes);

            let mut chunks = Vec::new();
            for line in text.lines() {
                let line = line.trim();
                if line.is_empty() || line == "data: [DONE]" {
                    continue;
                }

                if let Some(data) = line.strip_prefix("data: ") {
                    let event: GeminiStreamEvent = serde_json::from_str(data)
                        .map_err(|e| AIError::Stream(format!("invalid sse event: {e}")))?;

                    if let Some(content) = event.delta_text() {
                        if !content.is_empty() {
                            chunks.push(CompletionChunk {
                                content,
                                finish_reason: event.finish_reason(),
                                tool_calls: None,
                            });
                        }
                    }
                }
            }

            Ok(chunks)
        })
    }

    fn stream_chunks(
        &self,
        req: CompletionRequest,
    ) -> BoxFuture<'_, Result<tokio::sync::mpsc::Receiver<Result<CompletionChunk, AIError>>, AIError>>
    {
        Box::pin(async move {
            self.validate_model()?;

            let (system, contents) = Self::split_messages(req.messages);
            let body =
                GeminiRequestBody::new(contents, system, req.temperature, req.max_tokens, true);
            let url = self.build_url(true);

            let response = self
                .client
                .post(&url)
                .json(&body)
                .send()
                .await
                .map_err(map_reqwest_error)?;

            let status = response.status();
            if !status.is_success() {
                let text = response.text().await.unwrap_or_default();
                return Err(map_gemini_error(status, &text));
            }

            let (tx, rx) = tokio::sync::mpsc::channel::<Result<CompletionChunk, AIError>>(64);
            let mut stream = response.bytes_stream();

            tokio::spawn(async move {
                let mut buffer = String::new();

                while let Some(result) = stream.next().await {
                    match result {
                        Ok(bytes) => {
                            buffer.push_str(&String::from_utf8_lossy(&bytes));

                            while let Some(pos) = buffer.find('\n') {
                                let line = buffer.drain(..=pos).collect::<String>();
                                let line = line.trim_end_matches('\n').trim_end_matches('\r');

                                if line.is_empty() || line == "data: [DONE]" {
                                    continue;
                                }

                                if let Some(data) = line.strip_prefix("data: ") {
                                    match serde_json::from_str::<GeminiStreamEvent>(data) {
                                        Ok(event) => {
                                            if let Some(content) = event.delta_text() {
                                                if !content.is_empty() {
                                                    let _ = tx
                                                        .send(Ok(CompletionChunk {
                                                            content,
                                                            finish_reason: event.finish_reason(),
                                                            tool_calls: None,
                                                        }))
                                                        .await;
                                                }
                                            }
                                        }
                                        Err(e) => {
                                            let _ = tx
                                                .send(Err(AIError::Stream(format!(
                                                    "invalid sse event: {e}"
                                                ))))
                                                .await;
                                        }
                                    }
                                }
                            }
                        }
                        Err(e) => {
                            let _ = tx.send(Err(map_reqwest_error(e))).await;
                            break;
                        }
                    }
                }
            });

            Ok(rx)
        })
    }
}

fn map_reqwest_error(err: reqwest::Error) -> AIError {
    if err.is_timeout() {
        AIError::RequestTimeout
    } else if err.is_connect() {
        AIError::Network(format!("connection failed: {err}"))
    } else {
        AIError::Network(err.to_string())
    }
}

fn map_gemini_error(status: reqwest::StatusCode, body: &str) -> AIError {
    if status == reqwest::StatusCode::UNAUTHORIZED || status.as_u16() == 400 {
        let lower = body.to_lowercase();
        if lower.contains("api key") || lower.contains("apikey") {
            return AIError::InvalidApiKey;
        }
    }
    if status == reqwest::StatusCode::TOO_MANY_REQUESTS {
        return AIError::RateLimited { retry_after: None };
    }
    AIError::Provider(format!("HTTP {status}: {body}"))
}

#[derive(Debug, Serialize)]
struct GeminiRequestBody {
    contents: Vec<GeminiContent>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "systemInstruction")]
    system_instruction: Option<GeminiContent>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "generationConfig")]
    generation_config: Option<GeminiGenerationConfig>,
}

impl GeminiRequestBody {
    fn new(
        contents: Vec<GeminiContent>,
        system: Option<String>,
        temperature: Option<f32>,
        max_output_tokens: Option<u32>,
        _stream: bool,
    ) -> Self {
        let system_instruction = system.map(|text| GeminiContent {
            role: None,
            parts: vec![GeminiPart { text }],
        });

        let generation_config = if temperature.is_some() || max_output_tokens.is_some() {
            Some(GeminiGenerationConfig {
                temperature,
                max_output_tokens,
            })
        } else {
            None
        };

        Self {
            contents,
            system_instruction,
            generation_config,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct GeminiContent {
    #[serde(skip_serializing_if = "Option::is_none")]
    role: Option<String>,
    parts: Vec<GeminiPart>,
}

impl From<Message> for GeminiContent {
    fn from(msg: Message) -> Self {
        Self {
            role: Some(
                match msg.role {
                    Role::User => "user",
                    Role::Assistant => "model",
                    Role::System => "user",
                    Role::Tool => "user",
                }
                .to_string(),
            ),
            parts: vec![GeminiPart { text: msg.content }],
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct GeminiPart {
    text: String,
}

#[derive(Debug, Serialize)]
struct GeminiGenerationConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "maxOutputTokens")]
    max_output_tokens: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct GeminiResponse {
    candidates: Vec<GeminiCandidate>,
    #[serde(rename = "usageMetadata")]
    usage_metadata: Option<GeminiUsageMetadata>,
}

#[derive(Debug, Deserialize)]
struct GeminiCandidate {
    content: Option<GeminiContent>,
    #[serde(rename = "finishReason")]
    finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GeminiUsageMetadata {
    #[serde(rename = "promptTokenCount")]
    prompt_token_count: u32,
    #[serde(rename = "candidatesTokenCount")]
    candidates_token_count: u32,
    #[serde(rename = "totalTokenCount")]
    total_token_count: u32,
}

#[derive(Debug, Deserialize)]
struct GeminiStreamEvent {
    candidates: Option<Vec<GeminiCandidate>>,
}

impl GeminiStreamEvent {
    fn delta_text(&self) -> Option<String> {
        self.candidates
            .as_ref()
            .and_then(|c| c.first())
            .and_then(|c| c.content.as_ref())
            .map(|c| c.parts.iter().map(|p| &p.text).cloned().collect::<String>())
            .filter(|s| !s.is_empty())
    }

    fn finish_reason(&self) -> Option<String> {
        self.candidates
            .as_ref()
            .and_then(|c| c.first())
            .and_then(|c| c.finish_reason.clone())
    }
}

fn merge_consecutive_contents(contents: Vec<GeminiContent>) -> Vec<GeminiContent> {
    let mut merged: Vec<GeminiContent> = Vec::new();

    for content in contents {
        if let Some(last) = merged.last_mut() {
            if last.role == content.role {
                last.parts.extend(content.parts);
                continue;
            }
        }
        merged.push(content);
    }

    merged
}
