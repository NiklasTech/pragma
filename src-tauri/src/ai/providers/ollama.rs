use std::time::Duration;

use serde::{Deserialize, Serialize};

use crate::ai::{
    config::ProviderConfig,
    error::AIError,
    provider::{
        AIProvider, BoxFuture, CompletionChunk, CompletionRequest, CompletionResponse, Message,
        ModelInfo, Role, Usage,
    },
};

const DEFAULT_BASE_URL: &str = "http://localhost:11434";
const CHAT_PATH: &str = "/api/chat";
const TAGS_PATH: &str = "/api/tags";

pub struct OllamaProvider {
    config: ProviderConfig,
    client: reqwest::Client,
}

impl OllamaProvider {
    pub fn new(config: ProviderConfig) -> Result<Self, AIError> {
        let client = reqwest::Client::builder()
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

    async fn fetch_models(&self) -> Result<Vec<ModelInfo>, AIError> {
        let url = format!("{}{}", self.base_url(), TAGS_PATH);

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| map_reqwest_error(e))?;

        if !response.status().is_success() {
            return Ok(Vec::new());
        }

        let tags: OllamaTagsResponse = response
            .json()
            .await
            .map_err(|e| AIError::Serialization(e.to_string()))?;

        Ok(tags
            .models
            .into_iter()
            .map(|m| ModelInfo {
                id: m.name.clone(),
                name: m.name,
                context_window: None,
                supports_streaming: true,
                supports_vision: false,
            })
            .collect())
    }
}

impl AIProvider for OllamaProvider {
    fn name(&self) -> &'static str {
        "ollama"
    }

    fn config(&self) -> &ProviderConfig {
        &self.config
    }

    fn models(&self) -> Vec<ModelInfo> {
        if !self.config.model.is_empty() {
            vec![ModelInfo {
                id: self.config.model.clone(),
                name: self.config.model.clone(),
                context_window: None,
                supports_streaming: true,
                supports_vision: false,
            }]
        } else {
            Vec::new()
        }
    }

    fn complete(
        &self,
        req: CompletionRequest,
    ) -> BoxFuture<'_, Result<CompletionResponse, AIError>> {
        Box::pin(async move {
            self.validate_model()?;

            let body = OllamaRequestBody::from_completion_request(&self.config.model, req);
            let url = format!("{}{}", self.base_url(), CHAT_PATH);

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
                return Err(map_ollama_error(status, &text));
            }

            let ollama_resp: OllamaResponse = response
                .json()
                .await
                .map_err(|e| AIError::Serialization(e.to_string()))?;

            Ok(CompletionResponse {
                content: ollama_resp.message.content,
                model: ollama_resp.model,
                usage: ollama_resp
                    .prompt_eval_count
                    .zip(ollama_resp.eval_count)
                    .map(|(prompt_tokens, completion_tokens)| Usage {
                        prompt_tokens: prompt_tokens as u32,
                        completion_tokens: completion_tokens as u32,
                        total_tokens: (prompt_tokens + completion_tokens) as u32,
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

            let mut body = OllamaRequestBody::from_completion_request(&self.config.model, req);
            body.stream = true;

            let url = format!("{}{}", self.base_url(), CHAT_PATH);

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
                return Err(map_ollama_error(status, &text));
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

                let event: OllamaStreamEvent = serde_json::from_str(line)
                    .map_err(|e| AIError::Stream(format!("invalid stream event: {e}")))?;

                if !event.message.content.is_empty() {
                    chunks.push(CompletionChunk {
                        content: event.message.content,
                        finish_reason: if event.done {
                            Some("stop".to_string())
                        } else {
                            None
                        },
                    });
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
        AIError::Network("Ollama is not running. Start it with: ollama serve".to_string())
    } else {
        AIError::Network(err.to_string())
    }
}

fn map_ollama_error(status: reqwest::StatusCode, body: &str) -> AIError {
    if status.as_u16() == 404 {
        return AIError::Provider("Ollama endpoint not found. Check base URL.".to_string());
    }
    AIError::Provider(format!("HTTP {status}: {body}"))
}

#[derive(Debug, Serialize)]
struct OllamaRequestBody {
    model: String,
    messages: Vec<OllamaMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    num_predict: Option<u32>,
    stream: bool,
}

impl OllamaRequestBody {
    fn from_completion_request(model: &str, req: CompletionRequest) -> Self {
        Self {
            model: model.to_string(),
            messages: req.messages.into_iter().map(Into::into).collect(),
            temperature: req.temperature,
            num_predict: req.max_tokens,
            stream: false,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct OllamaMessage {
    role: String,
    content: String,
}

impl From<Message> for OllamaMessage {
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
struct OllamaResponse {
    model: String,
    message: OllamaMessage,
    prompt_eval_count: Option<usize>,
    eval_count: Option<usize>,
}

#[derive(Debug, Deserialize)]
struct OllamaStreamEvent {
    model: String,
    message: OllamaMessage,
    done: bool,
}

#[derive(Debug, Deserialize)]
struct OllamaTagsResponse {
    models: Vec<OllamaModelTag>,
}

#[derive(Debug, Deserialize)]
struct OllamaModelTag {
    name: String,
}
