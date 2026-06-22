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

const DEFAULT_BASE_URL: &str = "https://api.openai.com/v1";
const COMPLETIONS_PATH: &str = "/chat/completions";

const MODELS: &[(&str, &str, Option<usize>, bool, bool)] = &[
    ("gpt-4o", "GPT-4o", Some(128_000), true, true),
    ("o1", "o1", Some(200_000), true, false),
    ("o3", "o3", Some(200_000), true, false),
];

pub struct OpenAIProvider {
    config: ProviderConfig,
    client: reqwest::Client,
}

impl OpenAIProvider {
    pub fn new(config: ProviderConfig) -> Result<Self, AIError> {
        Self::new_for_provider(config, "openai")
    }

    pub fn new_for_provider(
        config: ProviderConfig,
        keychain_name: impl AsRef<str>,
    ) -> Result<Self, AIError> {
        let keychain_name = keychain_name.as_ref();
        let is_key_optional = keychain_name == "custom";

        let api_key = match &config.api_key {
            Some(key) if !key.is_empty() => Some(key.clone()),
            _ => keychain::get_api_key(keychain_name)?,
        };

        let api_key = match api_key {
            Some(key) => Some(key),
            None if is_key_optional => None,
            None => return Err(AIError::InvalidApiKey),
        };

        let mut headers = reqwest::header::HeaderMap::new();
        if let Some(api_key) = api_key {
            headers.insert(
                reqwest::header::AUTHORIZATION,
                reqwest::header::HeaderValue::from_str(&format!("Bearer {api_key}"))
                    .map_err(|e| AIError::Provider(format!("invalid api key header: {e}")))?,
            );
        }
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

        Ok(Self { config, client })
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
}

impl AIProvider for OpenAIProvider {
    fn name(&self) -> &'static str {
        "openai"
    }

    fn config(&self) -> &ProviderConfig {
        &self.config
    }

    fn models(&self) -> Vec<ModelInfo> {
        MODELS
            .iter()
            .map(|(id, name, ctx, stream, vision)| ModelInfo {
                id: id.to_string(),
                name: name.to_string(),
                context_window: *ctx,
                supports_streaming: *stream,
                supports_vision: *vision,
            })
            .collect()
    }

    fn complete(
        &self,
        req: CompletionRequest,
    ) -> BoxFuture<'_, Result<CompletionResponse, AIError>> {
        Box::pin(async move {
            self.validate_model()?;

            let body = OpenAIRequestBody::from_completion_request(&self.config.model, req);
            let url = format!("{}{}", self.base_url(), COMPLETIONS_PATH);

            let response = self
                .client
                .post(&url)
                .json(&body)
                .send()
                .await
                .map_err(|e| map_reqwest_error(e))?;

            let status = response.status();
            if !status.is_success() {
                let text = response.text().await.unwrap_or_default();
                return Err(map_openai_error(status, &text));
            }

            let openai_resp: OpenAIResponse = response
                .json()
                .await
                .map_err(|e| AIError::Serialization(e.to_string()))?;

            let choice = openai_resp
                .choices
                .into_iter()
                .next()
                .ok_or_else(|| AIError::Provider("no choices in response".to_string()))?;

            let content = choice
                .message
                .content
                .clone()
                .filter(|c| !c.is_empty())
                .unwrap_or_else(|| {
                    choice
                        .message
                        .reasoning_content
                        .clone()
                        .filter(|c| !c.is_empty())
                        .map(|r| format!("<thinking>{}</thinking>", r))
                        .unwrap_or_default()
                });

            Ok(CompletionResponse {
                content,
                model: openai_resp.model,
                usage: openai_resp.usage.map(|u| Usage {
                    prompt_tokens: u.prompt_tokens,
                    completion_tokens: u.completion_tokens,
                    total_tokens: u.total_tokens,
                }),
            })
        })
    }

    fn stream(
        &self,
        req: CompletionRequest,
    ) -> BoxFuture<'_, Result<Vec<CompletionChunk>, AIError>> {
        Box::pin(async move {
            self.validate_model()?;

            let mut body = OpenAIRequestBody::from_completion_request(&self.config.model, req);
            body.stream = Some(true);

            let url = format!("{}{}", self.base_url(), COMPLETIONS_PATH);

            let response = self
                .client
                .post(&url)
                .json(&body)
                .send()
                .await
                .map_err(|e| map_reqwest_error(e))?;

            let status = response.status();
            if !status.is_success() {
                let text = response.text().await.unwrap_or_default();
                return Err(map_openai_error(status, &text));
            }

            let bytes = response
                .bytes()
                .await
                .map_err(|e| AIError::Network(e.to_string()))?;
            let text = String::from_utf8_lossy(&bytes);

            let mut chunks = Vec::new();
            let mut in_reasoning = false;
            for line in text.lines() {
                let line = line.trim();
                if line.is_empty() || line == "data: [DONE]" {
                    continue;
                }
                if let Some(data) = line.strip_prefix("data: ") {
                    let event: OpenAIStreamEvent = serde_json::from_str(data)
                        .map_err(|e| AIError::Stream(format!("invalid sse event: {e}")))?;

                    if let Some(choice) = event.choices.into_iter().next() {
                        let has_content = choice
                            .delta
                            .content
                            .as_ref()
                            .map(|c| !c.is_empty())
                            .unwrap_or(false);
                        let has_reasoning = choice
                            .delta
                            .reasoning_content
                            .as_ref()
                            .map(|c| !c.is_empty())
                            .unwrap_or(false);

                        if has_content || has_reasoning {
                            let mut chunk = String::new();

                            if has_content {
                                if in_reasoning {
                                    chunk.push_str("</thinking>");
                                    in_reasoning = false;
                                }
                                chunk.push_str(choice.delta.content.as_deref().unwrap_or_default());
                            }

                            if has_reasoning {
                                if !in_reasoning {
                                    chunk.push_str("<thinking>");
                                    in_reasoning = true;
                                }
                                chunk.push_str(
                                    choice.delta.reasoning_content.as_deref().unwrap_or_default(),
                                );
                            }

                            chunks.push(CompletionChunk {
                                content: chunk,
                                finish_reason: choice.finish_reason,
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
        self.stream_chunks_with_cancel(req, None)
    }

    fn stream_chunks_with_cancel(
        &self,
        req: CompletionRequest,
        cancel_token: Option<tokio_util::sync::CancellationToken>,
    ) -> BoxFuture<'_, Result<tokio::sync::mpsc::Receiver<Result<CompletionChunk, AIError>>, AIError>>
    {
        Box::pin(async move {
            self.validate_model()?;

            let mut body = OpenAIRequestBody::from_completion_request(&self.config.model, req);
            body.stream = Some(true);

            let url = format!("{}{}", self.base_url(), COMPLETIONS_PATH);

            let response = self
                .client
                .post(&url)
                .json(&body)
                .send()
                .await
                .map_err(|e| map_reqwest_error(e))?;

            let status = response.status();
            if !status.is_success() {
                let text = response.text().await.unwrap_or_default();
                return Err(map_openai_error(status, &text));
            }

            let (tx, rx) = tokio::sync::mpsc::channel::<Result<CompletionChunk, AIError>>(64);
            let mut stream = response.bytes_stream();

            tokio::spawn(async move {
                let mut buffer = String::new();
                let mut event_data: Vec<String> = Vec::new();
                let mut in_reasoning = false;

                loop {
                    if cancel_token.as_ref().is_some_and(|t| t.is_cancelled()) {
                        break;
                    }

                    let cancel_fut = async {
                        match &cancel_token {
                            Some(token) => token.cancelled().await,
                            None => std::future::pending().await,
                        }
                    };

                    match tokio::select! {
                        biased;
                        _ = cancel_fut => None,
                        result = stream.next() => Some(result),
                    } {
                        None => break,
                        Some(Some(Ok(bytes))) => {
                            buffer.push_str(&String::from_utf8_lossy(&bytes));

                            while let Some(pos) = buffer.find('\n') {
                                let line = buffer.drain(..=pos).collect::<String>();
                                let line = line.trim_end_matches('\n').trim_end_matches('\r');

                                if line.is_empty() {
                                    for data in &event_data {
                                        if data == "[DONE]" {
                                            continue;
                                        }

                                        match serde_json::from_str::<OpenAIStreamEvent>(data) {
                                            Ok(event) => {
                                                if let Some(choice) =
                                                    event.choices.into_iter().next()
                                                {
                                                    let has_content = choice
                                                        .delta
                                                        .content
                                                        .as_ref()
                                                        .map(|c| !c.is_empty())
                                                        .unwrap_or(false);
                                                    let has_reasoning = choice
                                                        .delta
                                                        .reasoning_content
                                                        .as_ref()
                                                        .map(|c| !c.is_empty())
                                                        .unwrap_or(false);

                                                    if has_content || has_reasoning {
                                                        let mut chunk = String::new();

                                                        if has_content {
                                                            if in_reasoning {
                                                                chunk.push_str("</thinking>");
                                                                in_reasoning = false;
                                                            }
                                                            chunk.push_str(
                                                                choice.delta.content.as_deref().unwrap_or_default(),
                                                            );
                                                        }

                                                        if has_reasoning {
                                                            if !in_reasoning {
                                                                chunk.push_str("<thinking>");
                                                                in_reasoning = true;
                                                            }
                                                            chunk.push_str(
                                                                choice
                                                                    .delta
                                                                    .reasoning_content
                                                                    .as_deref()
                                                                    .unwrap_or_default(),
                                                            );
                                                        }

                                                        if tx
                                                            .send(Ok(CompletionChunk {
                                                                content: chunk,
                                                                finish_reason: choice
                                                                    .finish_reason,
                                                            }))
                                                            .await
                                                            .is_err()
                                                        {
                                                            break;
                                                        }
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
                                    event_data.clear();
                                } else if let Some(data) = line.strip_prefix("data: ") {
                                    event_data.push(data.to_string());
                                }
                            }
                        }
                        Some(Some(Err(e))) => {
                            let _ = tx.send(Err(map_reqwest_error(e))).await;
                            break;
                        }
                        Some(None) => break,
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

fn map_openai_error(status: reqwest::StatusCode, body: &str) -> AIError {
    if status == reqwest::StatusCode::UNAUTHORIZED {
        return AIError::InvalidApiKey;
    }
    if status == reqwest::StatusCode::TOO_MANY_REQUESTS {
        let retry_after = None;
        return AIError::RateLimited { retry_after };
    }
    AIError::Provider(format!("HTTP {status}: {body}"))
}

#[derive(Debug, Serialize)]
struct OpenAIRequestBody {
    model: String,
    messages: Vec<OpenAIMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    stream: Option<bool>,
}

impl OpenAIRequestBody {
    fn from_completion_request(model: &str, req: CompletionRequest) -> Self {
        Self {
            model: model.to_string(),
            messages: req.messages.into_iter().map(Into::into).collect(),
            temperature: req.temperature,
            max_tokens: req.max_tokens,
            stream: None,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct OpenAIMessage {
    role: String,
    content: String,
}

impl From<Message> for OpenAIMessage {
    fn from(msg: Message) -> Self {
        Self {
            role: match msg.role {
                Role::System => "system",
                Role::User => "user",
                Role::Assistant => "assistant",
            }
            .to_string(),
            content: msg.content,
        }
    }
}

#[derive(Debug, Deserialize)]
struct OpenAIResponse {
    model: String,
    choices: Vec<OpenAIChoice>,
    usage: Option<OpenAIUsage>,
}

#[derive(Debug, Deserialize)]
struct OpenAIChoice {
    message: OpenAIResponseMessage,
}

#[derive(Debug, Deserialize)]
struct OpenAIResponseMessage {
    content: Option<String>,
    reasoning_content: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OpenAIUsage {
    prompt_tokens: u32,
    completion_tokens: u32,
    total_tokens: u32,
}

#[derive(Debug, Deserialize)]
struct OpenAIStreamEvent {
    choices: Vec<OpenAIStreamChoice>,
}

#[derive(Debug, Deserialize)]
struct OpenAIStreamChoice {
    delta: OpenAIStreamDelta,
    finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OpenAIStreamDelta {
    content: Option<String>,
    reasoning_content: Option<String>,
}
