use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AIError {
    Network(String),
    RateLimited { retry_after: Option<u64> },
    InvalidApiKey,
    InvalidModel(String),
    ProviderNotFound(String),
    RequestTimeout,
    Serialization(String),
    Provider(String),
    Stream(String),
}

impl fmt::Display for AIError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AIError::Network(msg) => write!(f, "Network error: {msg}"),
            AIError::RateLimited { retry_after } => {
                if let Some(secs) = retry_after {
                    write!(f, "Rate limited. Retry after {secs}s")
                } else {
                    write!(f, "Rate limited")
                }
            }
            AIError::InvalidApiKey => write!(f, "Invalid API key"),
            AIError::InvalidModel(model) => write!(f, "Invalid model: {model}"),
            AIError::ProviderNotFound(name) => write!(f, "Provider not found: {name}"),
            AIError::RequestTimeout => write!(f, "Request timed out"),
            AIError::Serialization(msg) => write!(f, "Serialization error: {msg}"),
            AIError::Provider(msg) => write!(f, "Provider error: {msg}"),
            AIError::Stream(msg) => write!(f, "Stream error: {msg}"),
        }
    }
}

impl std::error::Error for AIError {}

impl From<serde_json::Error> for AIError {
    fn from(err: serde_json::Error) -> Self {
        AIError::Serialization(err.to_string())
    }
}
