use std::time::Duration;

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};

use crate::ai::{
    auth::{self, CopilotAccessToken},
    config::ProviderConfig,
    error::AIError,
    provider::{
        AIProvider, BoxFuture, CompletionChunk, CompletionRequest, CompletionResponse, Message,
        ModelInfo, Role, Usage,
    },
};

const DEFAULT_BASE_URL: &str = "https://api.individual.githubcopilot.com";
const COMPLETIONS_PATH: &str = "/chat/completions";

const APP_NAME: &str = "Pragma";
const APP_VERSION: &str = env!("CARGO_PKG_VERSION");

const MODELS: &[(&str, &str, Option<usize>, bool, bool)] = &[
    ("gpt-4o", "GPT-4o", Some(128_000), true, true),
    (
        "claude-3.5-sonnet",
        "Claude 3.5 Sonnet",
        Some(200_000),
        true,
        true,
    ),
    (
        "gemini-2.0-flash",
        "Gemini 2.0 Flash",
        Some(1_048_576),
        true,
        true,
    ),
];

pub struct CopilotProvider {
    config: ProviderConfig,
    client: reqwest::Client,
}

impl CopilotProvider {
    pub fn new(config: ProviderConfig) -> Result<Self, AIError> {
        let editor_version = format!("{APP_NAME}/{APP_VERSION}");

        let mut headers = reqwest::header::HeaderMap::new();
        headers.insert(
            reqwest::header::CONTENT_TYPE,
            reqwest::header::HeaderValue::from_static("application/json"),
        );
        headers.insert(
            "Editor-Version",
            reqwest::header::HeaderValue::from_str(&editor_version)
                .map_err(|e| AIError::Provider(format!("invalid editor version header: {e}")))?,
        );
        headers.insert(
            "Copilot-Integration-Id",
            reqwest::header::HeaderValue::from_static("pragma"),
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

    async fn fetch_copilot_token(&self) -> Result<CopilotAccessToken, AIError> {
        auth::get_valid_copilot_token().await
    }
}

impl AIProvider for CopilotProvider {
    fn name(&self) -> &'static str {
        "copilot"
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

            let copilot_token = self.fetch_copilot_token().await?;
            let body = CopilotRequestBody::from_completion_request(&self.config.model, req);
            let url = format!("{}{}", self.base_url(), COMPLETIONS_PATH);

            let response = self
                .client
                .post(&url)
                .header("Authorization", format!("Bearer {}", copilot_token.token))
                .json(&body)
                .send()
                .await
                .map_err(map_reqwest_error)?;

            let status = response.status();
            if !status.is_success() {
                let text = response.text().await.unwrap_or_default();
                return Err(map_copilot_error(status, &text));
            }

            let copilot_resp: CopilotResponse = response
                .json()
                .await
                .map_err(|e| AIError::Serialization(e.to_string()))?;

            let choice = copilot_resp
                .choices
                .into_iter()
                .next()
                .ok_or_else(|| AIError::Provider("no choices in response".to_string()))?;

            Ok(CompletionResponse {
                content: choice.message.content.unwrap_or_default(),
                model: copilot_resp.model,
                usage: copilot_resp.usage.map(|u| Usage {
                    prompt_tokens: u.prompt_tokens,
                    completion_tokens: u.completion_tokens,
                    total_tokens: u.total_tokens,
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

            let copilot_token = self.fetch_copilot_token().await?;
            let mut body = CopilotRequestBody::from_completion_request(&self.config.model, req);
            body.stream = Some(true);

            let url = format!("{}{}", self.base_url(), COMPLETIONS_PATH);

            let response = self
                .client
                .post(&url)
                .header("Authorization", format!("Bearer {}", copilot_token.token))
                .json(&body)
                .send()
                .await
                .map_err(map_reqwest_error)?;

            let status = response.status();
            if !status.is_success() {
                let text = response.text().await.unwrap_or_default();
                return Err(map_copilot_error(status, &text));
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
                    let event: CopilotStreamEvent = serde_json::from_str(data)
                        .map_err(|e| AIError::Stream(format!("invalid sse event: {e}")))?;

                    if let Some(choice) = event.choices.into_iter().next() {
                        if let Some(content) = choice.delta.content {
                            chunks.push(CompletionChunk {
                                content,
                                finish_reason: choice.finish_reason,
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

            let copilot_token = self.fetch_copilot_token().await?;
            let mut body = CopilotRequestBody::from_completion_request(&self.config.model, req);
            body.stream = Some(true);

            let url = format!("{}{}", self.base_url(), COMPLETIONS_PATH);

            let response = self
                .client
                .post(&url)
                .header("Authorization", format!("Bearer {}", copilot_token.token))
                .json(&body)
                .send()
                .await
                .map_err(map_reqwest_error)?;

            let status = response.status();
            if !status.is_success() {
                let text = response.text().await.unwrap_or_default();
                return Err(map_copilot_error(status, &text));
            }

            let (tx, rx) = tokio::sync::mpsc::channel::<Result<CompletionChunk, AIError>>(64);
            let mut stream = response.bytes_stream();

            tokio::spawn(async move {
                let mut buffer = String::new();
                let mut event_data: Vec<String> = Vec::new();

                while let Some(result) = stream.next().await {
                    match result {
                        Ok(bytes) => {
                            buffer.push_str(&String::from_utf8_lossy(&bytes));

                            while let Some(pos) = buffer.find('\n') {
                                let line = buffer.drain(..=pos).collect::<String>();
                                let line = line.trim_end_matches('\n').trim_end_matches('\r');

                                if line.is_empty() {
                                    for data_line in &event_data {
                                        if let Some(data) = data_line.strip_prefix("data: ") {
                                            if data == "[DONE]" {
                                                continue;
                                            }

                                            match serde_json::from_str::<CopilotStreamEvent>(data) {
                                                Ok(event) => {
                                                    if let Some(choice) =
                                                        event.choices.into_iter().next()
                                                    {
                                                        if let Some(content) = choice.delta.content
                                                        {
                                                            if !content.is_empty() {
                                                                let _ = tx
                                                                    .send(Ok(CompletionChunk {
                                                                        content,
                                                                        finish_reason: choice
                                                                            .finish_reason,
                                                                        tool_calls: None,
                                                                    }))
                                                                    .await;
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
                                    }
                                    event_data.clear();
                                } else if let Some(data) = line.strip_prefix("data: ") {
                                    event_data.push(data.to_string());
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

fn map_copilot_error(status: reqwest::StatusCode, body: &str) -> AIError {
    if status == reqwest::StatusCode::UNAUTHORIZED {
        return AIError::InvalidApiKey;
    }
    if status == reqwest::StatusCode::TOO_MANY_REQUESTS {
        return AIError::RateLimited { retry_after: None };
    }
    AIError::Provider(format!("HTTP {status}: {body}"))
}

#[derive(Debug, Serialize)]
struct CopilotRequestBody {
    model: String,
    messages: Vec<CopilotMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    stream: Option<bool>,
}

impl CopilotRequestBody {
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
struct CopilotMessage {
    role: String,
    content: String,
}

impl From<Message> for CopilotMessage {
    fn from(msg: Message) -> Self {
        Self {
            role: match msg.role {
                Role::System => "system",
                Role::User => "user",
                Role::Assistant => "assistant",
                Role::Tool => "tool",
            }
            .to_string(),
            content: msg.content,
        }
    }
}

#[derive(Debug, Deserialize)]
struct CopilotResponse {
    model: String,
    choices: Vec<CopilotChoice>,
    usage: Option<CopilotUsage>,
}

#[derive(Debug, Deserialize)]
struct CopilotChoice {
    message: CopilotResponseMessage,
}

#[derive(Debug, Deserialize)]
struct CopilotResponseMessage {
    content: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CopilotUsage {
    prompt_tokens: u32,
    completion_tokens: u32,
    total_tokens: u32,
}

#[derive(Debug, Deserialize)]
struct CopilotStreamEvent {
    choices: Vec<CopilotStreamChoice>,
}

#[derive(Debug, Deserialize)]
struct CopilotStreamChoice {
    delta: CopilotStreamDelta,
    finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CopilotStreamDelta {
    content: Option<String>,
}
