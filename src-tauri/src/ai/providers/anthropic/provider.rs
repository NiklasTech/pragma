use std::time::Duration;

use crate::ai::{
    config::ProviderConfig,
    error::AIError,
    keychain,
    provider::{Message, Role},
};

use super::request::AnthropicMessage;

pub(super) const DEFAULT_BASE_URL: &str = "https://api.anthropic.com/v1";
pub(super) const MESSAGES_PATH: &str = "/messages";
pub(super) const MODELS_PATH: &str = "/models";
pub(super) const ANTHROPIC_VERSION: &str = "2023-06-01";

pub struct AnthropicProvider {
    pub(super) config: ProviderConfig,
    pub(super) client: reqwest::Client,
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

    pub(super) fn base_url(&self) -> String {
        if self.config.base_url.is_empty() {
            DEFAULT_BASE_URL.to_string()
        } else {
            self.config.base_url.trim_end_matches('/').to_string()
        }
    }

    pub(super) fn validate_model(&self) -> Result<(), AIError> {
        if self.config.model.is_empty() {
            return Err(AIError::InvalidModel("model is empty".to_string()));
        }
        Ok(())
    }

    pub(super) fn split_messages(
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
