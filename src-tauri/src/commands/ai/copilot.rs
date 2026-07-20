use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct CopilotStartLoginRequest {
    pub client_id: String,
}

#[derive(Debug, Serialize)]
pub struct CopilotStartLoginResponse {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub expires_in: u64,
    pub interval: u64,
}

#[tauri::command]
pub async fn copilot_start_device_login(
    req: CopilotStartLoginRequest,
) -> Result<CopilotStartLoginResponse, String> {
    if req.client_id.trim().is_empty() {
        return Err("GitHub OAuth client ID is required".to_string());
    }

    let result = crate::ai::auth::start_device_flow(&req.client_id)
        .await
        .map_err(|e| e.to_string())?;

    crate::ai::auth::store_client_id(&req.client_id).map_err(|e| e.to_string())?;

    Ok(CopilotStartLoginResponse {
        device_code: result.device_code,
        user_code: result.user_code,
        verification_uri: result.verification_uri,
        expires_in: result.expires_in,
        interval: result.interval,
    })
}

#[derive(Debug, Deserialize)]
pub struct CopilotPollLoginRequest {
    pub client_id: String,
    pub device_code: String,
}

#[derive(Debug, Serialize)]
pub struct CopilotPollLoginResponse {
    pub authorized: bool,
}

#[tauri::command]
pub async fn copilot_poll_device_login(
    req: CopilotPollLoginRequest,
) -> Result<CopilotPollLoginResponse, String> {
    if req.client_id.trim().is_empty() {
        return Err("GitHub OAuth client ID is required".to_string());
    }
    if req.device_code.is_empty() {
        return Err("device_code is required".to_string());
    }

    match crate::ai::auth::poll_device_flow(&req.client_id, &req.device_code)
        .await
        .map_err(|e| e.to_string())?
    {
        Some(tokens) => {
            let token_set = crate::ai::auth::OAuthTokenSet {
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                expires_at: tokens.expires_at,
            };
            crate::ai::auth::store_tokens(&token_set).map_err(|e| e.to_string())?;
            crate::ai::auth::store_client_id(&req.client_id).map_err(|e| e.to_string())?;
            Ok(CopilotPollLoginResponse { authorized: true })
        }
        None => Ok(CopilotPollLoginResponse { authorized: false }),
    }
}

#[derive(Debug, Serialize)]
pub struct CopilotAuthStatus {
    pub authenticated: bool,
}

#[tauri::command]
pub async fn copilot_auth_status() -> Result<CopilotAuthStatus, String> {
    let authenticated = crate::ai::auth::is_authenticated().map_err(|e| e.to_string())?;
    Ok(CopilotAuthStatus { authenticated })
}

#[tauri::command]
pub async fn copilot_logout() -> Result<(), String> {
    crate::ai::auth::delete_tokens().map_err(|e| e.to_string())
}
