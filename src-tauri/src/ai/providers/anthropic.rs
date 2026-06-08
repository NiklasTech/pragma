use std::time::Duration;

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

const DEFAULT_BASE_URL: &str = "https://api.anthropic.com/v1";
const MESSAGES_PATH: &str = "/messages";
const ANTHROPIC_VERSION: &str = "2023-06-01";

const MODELS: &[(&str, &str, Option<usize>, bool, bool)] = &[
    ("claude-opus-4", "Claude Opus 4", Some(200_000), true, true),
    (
        "claude-sonnet-4",
        "Claude Sonnet 4",
        Some(200_000),
        true,
        true,
    ),
    ("claude-haiku", "Claude Haiku", Some(200_000), true, false),
];

pub struct AnthropicProvider {
    config: ProviderConfig,
    client: reqwest::Client,
}

impl AnthropicProvider {
    pub fn new(config: ProviderConfig) -> Result<Self, AIError> {
        let api_key = match &config.api_key {
            Some(key) if !key.is_empty() => key.clone(),
            _ => match keychain::get_api_key("anthropic")? {
                Some(key) => key,
                None => return Err(AIError::InvalidApiKey),
            },
        };

        let mut headers = reqwest::header::HeaderMap::new();
        headers.insert(
            reqwest::header::HeaderName::from_static("x-api-key"),
            reqwest::header::HeaderValue::from_str(&api_key)
                .map_err(|e| AIError::Provider(format!("invalid api key header: {e}")))?,
        );
        headers.insert(
            reqwest::header::HeaderName::from_static("anthropic-version"),
            reqwest::header::HeaderValue::from_static(ANTHROPIC_VERSION),
        );
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

    fn split_messages(
        &self,
        messages: Vec<Message>,
    ) -> (
        Option<String>,
        Vec<AnthropicMessage>,
        Option<f32>,
        Option<u32>,
    ) {
        let mut system = None;
        let mut msgs = Vec::new();

        for msg in messages {
            match msg.role {
                Role::System => {
                    system = Some(msg.content);
                }
                _ => {
                    msgs.push(AnthropicMessage::from(msg));
                }
            }
        }

        (system, msgs, None, None)
    }
}

impl AIProvider for AnthropicProvider {
    fn name(&self) -> &'static str {
        "anthropic"
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

            let (system, messages, temperature, max_tokens) = self.split_messages(req.messages);
            let body = AnthropicRequestBody::from_completion_request(
                &self.config.model,
                system,
                messages,
                temperature,
                max_tokens,
            );
            let url = format!("{}{}", self.base_url(), MESSAGES_PATH);

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
                return Err(map_anthropic_error(status, &text));
            }

            let anthropic_resp: AnthropicResponse = response
                .json()
                .await
                .map_err(|e| AIError::Serialization(e.to_string()))?;

            let content = anthropic_resp
                .content
                .into_iter()
                .filter_map(|c| match c {
                    AnthropicContent::Text { text } => Some(text),
                })
                .collect::<Vec<_>>()
                .join("");

            Ok(CompletionResponse {
                content,
                model: anthropic_resp.model,
                usage: anthropic_resp.usage.map(|u| Usage {
                    prompt_tokens: u.input_tokens,
                    completion_tokens: u.output_tokens,
                    total_tokens: u.input_tokens + u.output_tokens,
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

            let (system, messages, temperature, max_tokens) = self.split_messages(req.messages);
            let mut body = AnthropicRequestBody::from_completion_request(
                &self.config.model,
                system,
                messages,
                temperature,
                max_tokens,
            );
            body.stream = true;

            let url = format!("{}{}", self.base_url(), MESSAGES_PATH);

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
                return Err(map_anthropic_error(status, &text));
            }

            let bytes = response
                .bytes()
                .await
                .map_err(|e| AIError::Network(e.to_string()))?;
            let text = String::from_utf8_lossy(&bytes);

            let mut chunks = Vec::new();
            for line in text.lines() {
                let line = line.trim();
                if line.is_empty() {
                    continue;
                }

                if let Some(data) = line.strip_prefix("data: ") {
                    if data == "[DONE]" {
                        continue;
                    }

                    let event: AnthropicStreamEvent = serde_json::from_str(data)
                        .map_err(|e| AIError::Stream(format!("invalid sse event: {e}")))?;

                    match event {
                        AnthropicStreamEvent::ContentBlockDelta { delta } => {
                            let AnthropicDelta::TextDelta { text } = delta;
                            chunks.push(CompletionChunk {
                                content: text,
                                finish_reason: None,
                            });
                        }
                        AnthropicStreamEvent::MessageDelta { usage, .. } => {
                            if let Some(_u) = usage {
                                if let Some(last) = chunks.last_mut() {
                                    last.finish_reason = Some("stop".to_string());
                                }
                            }
                        }
                        _ => {}
                    }
                }
            }

            Ok(chunks)
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

fn map_anthropic_error(status: reqwest::StatusCode, body: &str) -> AIError {
    if status == reqwest::StatusCode::UNAUTHORIZED {
        return AIError::InvalidApiKey;
    }
    if status == reqwest::StatusCode::TOO_MANY_REQUESTS {
        return AIError::RateLimited { retry_after: None };
    }
    AIError::Provider(format!("HTTP {status}: {body}"))
}

#[derive(Debug, Serialize)]
struct AnthropicRequestBody {
    model: String,
    messages: Vec<AnthropicMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    system: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "std::ops::Not::not", rename = "stream")]
    stream: bool,
}

impl AnthropicRequestBody {
    fn from_completion_request(
        model: &str,
        system: Option<String>,
        messages: Vec<AnthropicMessage>,
        temperature: Option<f32>,
        max_tokens: Option<u32>,
    ) -> Self {
        Self {
            model: model.to_string(),
            messages,
            system,
            temperature,
            max_tokens,
            stream: false,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct AnthropicMessage {
    role: String,
    content: String,
}

impl From<Message> for AnthropicMessage {
    fn from(msg: Message) -> Self {
        Self {
            role: match msg.role {
                Role::System => "user",
                Role::User => "user",
                Role::Assistant => "assistant",
            }
            .to_string(),
            content: msg.content,
        }
    }
}

#[derive(Debug, Deserialize)]
struct AnthropicResponse {
    model: String,
    content: Vec<AnthropicContent>,
    usage: Option<AnthropicUsage>,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
enum AnthropicContent {
    #[serde(rename = "text")]
    Text { text: String },
}

#[derive(Debug, Deserialize)]
struct AnthropicUsage {
    input_tokens: u32,
    output_tokens: u32,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
enum AnthropicStreamEvent {
    #[serde(rename = "content_block_delta")]
    ContentBlockDelta { delta: AnthropicDelta },
    #[serde(rename = "message_delta")]
    MessageDelta { usage: Option<AnthropicUsage> },
    #[serde(rename = "message_start")]
    MessageStart,
    #[serde(rename = "content_block_start")]
    ContentBlockStart,
    #[serde(rename = "content_block_stop")]
    ContentBlockStop,
    #[serde(rename = "message_stop")]
    MessageStop,
    #[serde(rename = "ping")]
    Ping,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
enum AnthropicDelta {
    #[serde(rename = "text_delta")]
    TextDelta { text: String },
}
