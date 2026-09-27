use std::path::Path;

use serde::Deserialize;
use tauri::State;

use crate::ai::acp::config_options::SessionConfigOption;
use crate::ai::acp::AcpSessionManager;
use crate::ai::cli::get_manifest;

#[derive(Debug, Deserialize)]
pub struct AcpSessionConfigRequest {
    pub provider_id: String,
    pub chat_session_id: String,
    pub cwd: String,
}

#[derive(Debug, Deserialize)]
pub struct AcpSetConfigOptionRequest {
    pub chat_session_id: String,
    pub config_id: String,
    pub value: String,
}

/// Returns the models and other options the coding CLI reports, starting its session if needed.
#[tauri::command]
pub async fn cli_acp_session_config(
    req: AcpSessionConfigRequest,
    state: State<'_, AcpSessionManager>,
) -> Result<Vec<SessionConfigOption>, String> {
    if req.chat_session_id.is_empty() {
        return Err("chat_session_id is required".to_string());
    }
    let manifest = get_manifest(&req.provider_id)
        .ok_or_else(|| format!("unknown provider: {}", req.provider_id))?;
    if !manifest.uses_acp {
        return Err(format!("{} does not support ACP", manifest.name));
    }
    if req.cwd.is_empty() || !Path::new(&req.cwd).is_dir() {
        return Err("cwd must be an existing directory".to_string());
    }

    if !state.has_session(&req.chat_session_id).await {
        state
            .start_session(&req.provider_id, &req.cwd, &req.chat_session_id)
            .await
            .map_err(|e| e.to_string())?;
    }

    state
        .config_options(&req.chat_session_id)
        .await
        .map_err(|e| e.to_string())
}

/// Changes one session config option, e.g. the model, on a running coding CLI session.
#[tauri::command]
pub async fn cli_acp_set_config_option(
    req: AcpSetConfigOptionRequest,
    state: State<'_, AcpSessionManager>,
) -> Result<Vec<SessionConfigOption>, String> {
    if req.chat_session_id.is_empty() {
        return Err("chat_session_id is required".to_string());
    }
    if req.config_id.is_empty() {
        return Err("config_id is required".to_string());
    }
    if req.value.is_empty() {
        return Err("value is required".to_string());
    }

    state
        .set_config_option(&req.chat_session_id, &req.config_id, &req.value)
        .await
        .map_err(|e| e.to_string())
}
