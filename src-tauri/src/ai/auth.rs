use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};

use super::error::AIError;
use super::keychain;

const GITHUB_DEVICE_CODE_URL: &str = "https://github.com/login/device/code";
const GITHUB_TOKEN_URL: &str = "https://github.com/login/oauth/access_token";
const COPILOT_TOKEN_URL: &str = "https://api.github.com/copilot_internal/v2/token";

const COPILOT_KEYCHAIN_ID: &str = "copilot";
const COPILOT_CLIENT_ID_KEYCHAIN_ID: &str = "copilot-client-id";
const COPILOT_OAUTH_SCOPE: &str = "read:user copilot";

const APP_NAME: &str = "Pragma";
const APP_VERSION: &str = env!("CARGO_PKG_VERSION");

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthTokenSet {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceFlowStartResponse {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub expires_in: u64,
    pub interval: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceFlowTokenResponse {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CopilotAccessToken {
    pub token: String,
    pub expires_at: DateTime<Utc>,
}

// ─── Public API ──────────────────────────────────────────────────────────────

pub fn store_client_id(client_id: &str) -> Result<(), AIError> {
    if client_id.trim().is_empty() {
        return Err(AIError::Provider(
            "GitHub OAuth client ID is required".to_string(),
        ));
    }
    keychain::set_api_key(COPILOT_CLIENT_ID_KEYCHAIN_ID, client_id.trim())
}

pub fn load_client_id() -> Result<Option<String>, AIError> {
    keychain::get_api_key(COPILOT_CLIENT_ID_KEYCHAIN_ID)
}

pub async fn start_device_flow(client_id: &str) -> Result<DeviceFlowStartResponse, AIError> {
    validate_client_id(client_id)?;

    let client = reqwest::Client::new();
    let body = form_body(&[("client_id", client_id), ("scope", COPILOT_OAUTH_SCOPE)]);

    let response = client
        .post(GITHUB_DEVICE_CODE_URL)
        .header("Accept", "application/json")
        .header("Content-Type", "application/x-www-form-urlencoded")
        .body(body)
        .send()
        .await
        .map_err(|e| AIError::Network(format!("device code request failed: {e}")))?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|e| AIError::Serialization(e.to_string()))?;

    if !status.is_success() {
        return Err(AIError::Provider(format!(
            "device code endpoint returned HTTP {status}: {body}"
        )));
    }

    let raw: DeviceCodeRawResponse = serde_json::from_str(&body).map_err(|e| {
        AIError::Serialization(format!("invalid device code response: {e}: {body}"))
    })?;

    if let Some(error) = raw.error {
        return Err(AIError::Provider(format!(
            "device code endpoint error: {error}"
        )));
    }

    Ok(DeviceFlowStartResponse {
        device_code: raw.device_code.ok_or_else(|| {
            AIError::Serialization("device code response missing device_code".to_string())
        })?,
        user_code: raw.user_code.ok_or_else(|| {
            AIError::Serialization("device code response missing user_code".to_string())
        })?,
        verification_uri: raw.verification_uri.ok_or_else(|| {
            AIError::Serialization("device code response missing verification_uri".to_string())
        })?,
        expires_in: raw.expires_in.unwrap_or(900),
        interval: raw.interval.unwrap_or(5).max(1),
    })
}

/// Polls the GitHub token endpoint once. Returns `Ok(Some(...))` once the user
/// has authorized the device. Returns `Ok(None)` while the authorization is
/// still pending so the caller can keep polling.
pub async fn poll_device_flow(
    client_id: &str,
    device_code: &str,
) -> Result<Option<DeviceFlowTokenResponse>, AIError> {
    validate_client_id(client_id)?;

    if device_code.is_empty() {
        return Err(AIError::Provider("device_code is required".to_string()));
    }

    let client = reqwest::Client::new();
    let body = form_body(&[
        ("client_id", client_id),
        ("device_code", device_code),
        ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
    ]);

    let response = client
        .post(GITHUB_TOKEN_URL)
        .header("Accept", "application/json")
        .header("Content-Type", "application/x-www-form-urlencoded")
        .body(body)
        .send()
        .await
        .map_err(|e| AIError::Network(format!("token request failed: {e}")))?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|e| AIError::Serialization(e.to_string()))?;

    if !status.is_success() {
        return Err(AIError::Provider(format!(
            "token endpoint returned HTTP {status}: {body}"
        )));
    }

    let raw: TokenRawResponse = serde_json::from_str(&body)
        .map_err(|e| AIError::Serialization(format!("invalid token response: {e}: {body}")))?;

    if let Some(error) = raw.error {
        match error.as_str() {
            "authorization_pending" | "slow_down" => return Ok(None),
            "expired_token" => {
                return Err(AIError::Provider(
                    "device code expired, please restart the login flow".to_string(),
                ));
            }
            "access_denied" => {
                return Err(AIError::Provider(
                    "access denied, please authorize the device in your browser".to_string(),
                ));
            }
            _ => return Err(AIError::Provider(format!("oauth error: {error}"))),
        }
    }

    let access_token = raw
        .access_token
        .ok_or_else(|| AIError::Serialization("token response missing access_token".to_string()))?;

    let expires_at = raw
        .expires_in
        .map(|seconds| Utc::now() + Duration::seconds(seconds as i64));

    Ok(Some(DeviceFlowTokenResponse {
        access_token,
        refresh_token: raw.refresh_token,
        expires_at,
    }))
}

pub fn store_tokens(tokens: &OAuthTokenSet) -> Result<(), AIError> {
    let json = serde_json::to_string(tokens).map_err(|e| AIError::Serialization(e.to_string()))?;
    keychain::set_api_key(COPILOT_KEYCHAIN_ID, &json)
}

pub fn load_tokens() -> Result<Option<OAuthTokenSet>, AIError> {
    match keychain::get_api_key(COPILOT_KEYCHAIN_ID)? {
        Some(json) => {
            let tokens = serde_json::from_str(&json)
                .map_err(|e| AIError::Serialization(format!("corrupt copilot tokens: {e}")))?;
            Ok(Some(tokens))
        }
        None => Ok(None),
    }
}

pub fn delete_tokens() -> Result<(), AIError> {
    keychain::delete_api_key(COPILOT_KEYCHAIN_ID)
}

pub fn is_authenticated() -> Result<bool, AIError> {
    match load_tokens()? {
        Some(tokens) => Ok(!tokens.access_token.is_empty()),
        None => Ok(false),
    }
}

/// Returns a valid Copilot chat access token, refreshing the underlying
/// GitHub token first if necessary.
pub async fn get_valid_copilot_token() -> Result<CopilotAccessToken, AIError> {
    let client_id = load_client_id()?.ok_or_else(|| {
        AIError::Provider(
            "GitHub OAuth client ID not configured. Set it in AI Settings.".to_string(),
        )
    })?;

    let tokens = load_tokens()?.ok_or(AIError::InvalidApiKey)?;

    let github_token = if is_expired(tokens.expires_at) {
        match tokens.refresh_token {
            Some(refresh) => refresh_github_token(&client_id, &refresh).await?,
            None => return Err(AIError::InvalidApiKey),
        }
    } else {
        tokens.access_token
    };

    fetch_copilot_token(&github_token).await
}

// ─── Internal Helpers ────────────────────────────────────────────────────────

fn validate_client_id(client_id: &str) -> Result<(), AIError> {
    if client_id.trim().is_empty() {
        return Err(AIError::Provider(
            "GitHub OAuth client ID is required".to_string(),
        ));
    }
    Ok(())
}

fn is_expired(expires_at: Option<DateTime<Utc>>) -> bool {
    match expires_at {
        Some(at) => Utc::now() >= at - Duration::seconds(60),
        None => false,
    }
}

async fn refresh_github_token(client_id: &str, refresh_token: &str) -> Result<String, AIError> {
    let client = reqwest::Client::new();
    let body = form_body(&[
        ("client_id", client_id),
        ("grant_type", "refresh_token"),
        ("refresh_token", refresh_token),
    ]);

    let response = client
        .post(GITHUB_TOKEN_URL)
        .header("Accept", "application/json")
        .header("Content-Type", "application/x-www-form-urlencoded")
        .body(body)
        .send()
        .await
        .map_err(|e| AIError::Network(format!("token refresh failed: {e}")))?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|e| AIError::Serialization(e.to_string()))?;

    if !status.is_success() {
        return Err(AIError::Provider(format!(
            "token refresh returned HTTP {status}: {body}"
        )));
    }

    let raw: TokenRawResponse = serde_json::from_str(&body)
        .map_err(|e| AIError::Serialization(format!("invalid refresh response: {e}: {body}")))?;

    if let Some(error) = raw.error {
        return Err(AIError::Provider(format!(
            "token refresh rejected: {error}. Please log in again."
        )));
    }

    let access_token = raw.access_token.ok_or_else(|| {
        AIError::Serialization("refresh response missing access_token".to_string())
    })?;

    let expires_at = raw
        .expires_in
        .map(|seconds| Utc::now() + Duration::seconds(seconds as i64));

    let new_tokens = OAuthTokenSet {
        access_token: access_token.clone(),
        refresh_token: raw
            .refresh_token
            .or_else(|| Some(refresh_token.to_string())),
        expires_at,
    };
    store_tokens(&new_tokens)?;

    Ok(access_token)
}

async fn fetch_copilot_token(github_token: &str) -> Result<CopilotAccessToken, AIError> {
    let client = reqwest::Client::new();
    let editor_version = format!("{APP_NAME}/{APP_VERSION}");

    let response = client
        .get(COPILOT_TOKEN_URL)
        .header("Authorization", format!("Bearer {github_token}"))
        .header("Editor-Version", &editor_version)
        .header("User-Agent", &editor_version)
        .send()
        .await
        .map_err(|e| AIError::Network(format!("copilot token request failed: {e}")))?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|e| AIError::Serialization(e.to_string()))?;

    if status == reqwest::StatusCode::UNAUTHORIZED {
        return Err(AIError::InvalidApiKey);
    }
    if !status.is_success() {
        return Err(AIError::Provider(format!(
            "copilot token endpoint returned HTTP {status}: {body}"
        )));
    }

    let raw: CopilotTokenRawResponse = serde_json::from_str(&body).map_err(|e| {
        AIError::Serialization(format!("invalid copilot token response: {e}: {body}"))
    })?;

    let token = raw.token.ok_or_else(|| {
        AIError::Serialization("copilot token response missing token".to_string())
    })?;

    let expires_at = raw.expires_at.map(parse_timestamp).unwrap_or_else(|| {
        // Copilot tokens are typically short-lived; assume 25 minutes if no expiry.
        Utc::now() + Duration::minutes(25)
    });

    Ok(CopilotAccessToken { token, expires_at })
}

fn parse_timestamp(seconds: i64) -> DateTime<Utc> {
    DateTime::from_timestamp(seconds, 0).unwrap_or_else(|| Utc::now() + Duration::minutes(25))
}

fn form_body(pairs: &[(&str, &str)]) -> String {
    pairs
        .iter()
        .map(|(k, v)| format!("{}={}", url_encode(k), url_encode(v)))
        .collect::<Vec<_>>()
        .join("&")
}

fn url_encode(value: &str) -> String {
    value
        .chars()
        .map(|c| match c {
            'a'..='z' | 'A'..='Z' | '0'..='9' | '-' | '_' | '.' | '~' => c.to_string(),
            ' ' => "+".to_string(),
            _ => format!("%{:02X}", c as u8),
        })
        .collect()
}

// ─── Raw GitHub Responses ────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct DeviceCodeRawResponse {
    device_code: Option<String>,
    user_code: Option<String>,
    verification_uri: Option<String>,
    expires_in: Option<u64>,
    interval: Option<u64>,
    error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct TokenRawResponse {
    access_token: Option<String>,
    refresh_token: Option<String>,
    expires_in: Option<u64>,
    #[allow(dead_code)]
    token_type: Option<String>,
    #[allow(dead_code)]
    scope: Option<String>,
    error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CopilotTokenRawResponse {
    token: Option<String>,
    expires_at: Option<i64>,
}
