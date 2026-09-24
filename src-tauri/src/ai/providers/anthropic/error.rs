use crate::ai::error::AIError;

pub(super) fn map_reqwest_error(err: reqwest::Error) -> AIError {
    if err.is_timeout() {
        AIError::RequestTimeout
    } else if err.is_connect() {
        AIError::Network(format!("connection failed: {err}"))
    } else {
        AIError::Network(err.to_string())
    }
}

pub(super) fn map_anthropic_error(status: reqwest::StatusCode, body: &str) -> AIError {
    if status == reqwest::StatusCode::UNAUTHORIZED {
        return AIError::InvalidApiKey;
    }
    if status == reqwest::StatusCode::TOO_MANY_REQUESTS {
        return AIError::RateLimited { retry_after: None };
    }
    AIError::Provider(format!("HTTP {status}: {body}"))
}
