use std::time::Duration;

use crate::ai::{config::ProviderConfig, error::AIError, keychain};

pub(super) const DEFAULT_BASE_URL: &str = "https://api.openai.com/v1";
pub(super) const COMPLETIONS_PATH: &str = "/chat/completions";
pub(super) const MODELS_PATH: &str = "/models";

pub struct OpenAIProvider {
    pub(super) config: ProviderConfig,
    pub(super) client: reqwest::Client,
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
            .read_timeout(Duration::from_secs(config.timeout_seconds))
            .pool_max_idle_per_host(0)
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
}
