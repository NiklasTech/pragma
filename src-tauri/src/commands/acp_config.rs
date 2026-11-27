use std::path::Path;

use serde::Deserialize;
use tauri::State;

use crate::ai::acp::config_options::SessionConfigOption;
use crate::ai::acp::continuation::ReplayedMessage;
use crate::ai::acp::session_info::SessionInfo;
use crate::ai::acp::sign_in::AuthMethodInfo;
use crate::ai::acp::{AcpSessionManager, SessionStart};
use crate::ai::cli::get_manifest;

#[derive(Debug, Deserialize)]
pub struct AcpSessionConfigRequest {
    pub provider_id: String,
    pub chat_session_id: String,
    pub cwd: String,
    #[serde(default)]
    pub allow_child_sessions: bool,
    /// MCP servers the session may use; absent means all configured servers.
    #[serde(default)]
    pub mcp_server_ids: Option<Vec<String>>,
    /// The CLI account's config folder; absent runs the default account.
    #[serde(default)]
    pub account_dir: Option<String>,
    /// The agent's id of a conversation to continue instead of starting a new one.
    #[serde(default)]
    pub resume_session_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AcpSessionRequest {
    pub chat_session_id: String,
}

#[derive(Debug, Deserialize)]
pub struct AcpSetConfigOptionRequest {
    pub chat_session_id: String,
    pub config_id: String,
    pub value: String,
}

/// Checks a session start request and returns the CLI's name.
fn validate_start(req: &AcpSessionConfigRequest) -> Result<String, String> {
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
    Ok(manifest.name)
}

/// An agent's conversation id: letters, digits and dashes, as CLIs write them.
fn is_conversation_id(id: &str) -> bool {
    (8..=64).contains(&id.len()) && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
}

/// Returns the models and other options the coding CLI reports, starting its session if needed.
#[tauri::command]
pub async fn cli_acp_session_config(
    req: AcpSessionConfigRequest,
    state: State<'_, AcpSessionManager>,
) -> Result<Vec<SessionConfigOption>, String> {
    validate_start(&req)?;

    if !state.has_session(&req.chat_session_id).await {
        state
            .start_session(SessionStart {
                provider_id: &req.provider_id,
                cwd: &req.cwd,
                chat_session_id: &req.chat_session_id,
                allow_child_sessions: req.allow_child_sessions,
                mcp_server_ids: req.mcp_server_ids.as_deref(),
                account_dir: req.account_dir.as_deref(),
                resume_session_id: req.resume_session_id.as_deref(),
                replay_history: false,
                sign_in_method: None,
            })
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

/// Whether the coding CLI accepts images in prompts; null while its session has not started.
#[tauri::command]
pub async fn cli_acp_accepts_images(
    req: AcpSessionRequest,
    state: State<'_, AcpSessionManager>,
) -> Result<Option<bool>, String> {
    if req.chat_session_id.is_empty() {
        return Err("chat_session_id is required".to_string());
    }
    Ok(state.accepts_images(&req.chat_session_id).await)
}

/// The slash commands, skills and plan the coding CLI reported for a running session.
#[tauri::command]
pub async fn cli_acp_session_info(
    req: AcpSessionRequest,
    state: State<'_, AcpSessionManager>,
) -> Result<SessionInfo, String> {
    if req.chat_session_id.is_empty() {
        return Err("chat_session_id is required".to_string());
    }
    state
        .session_info(&req.chat_session_id)
        .await
        .map_err(|e| e.to_string())
}

/// Opens a conversation the CLI had in a terminal as this chat's session and returns its
/// messages, so the chat shows what happened before.
#[tauri::command]
pub async fn cli_acp_open_session(
    req: AcpSessionConfigRequest,
    state: State<'_, AcpSessionManager>,
) -> Result<Vec<ReplayedMessage>, String> {
    let name = validate_start(&req)?;
    let session_id = req
        .resume_session_id
        .as_deref()
        .filter(|id| is_conversation_id(id))
        .ok_or_else(|| "a valid resume_session_id is required".to_string())?;

    state.stop_session(&req.chat_session_id).await;
    state
        .start_session(SessionStart {
            provider_id: &req.provider_id,
            cwd: &req.cwd,
            chat_session_id: &req.chat_session_id,
            allow_child_sessions: req.allow_child_sessions,
            mcp_server_ids: req.mcp_server_ids.as_deref(),
            account_dir: req.account_dir.as_deref(),
            resume_session_id: Some(session_id),
            replay_history: true,
            sign_in_method: None,
        })
        .await
        .map_err(|e| e.to_string())?;

    match state.take_replayed(&req.chat_session_id).await {
        Some(messages) => Ok(messages),
        None => {
            state.stop_session(&req.chat_session_id).await;
            Err(format!("{name} could not open this conversation"))
        }
    }
}

/// The sign-in methods of a chat whose coding CLI asked for a signed-in account.
#[tauri::command]
pub async fn cli_acp_sign_in_methods(
    req: AcpSessionRequest,
    state: State<'_, AcpSessionManager>,
) -> Result<Vec<AuthMethodInfo>, String> {
    if req.chat_session_id.is_empty() {
        return Err("chat_session_id is required".to_string());
    }
    Ok(state.sign_in_methods(&req.chat_session_id).await)
}

#[derive(Debug, Deserialize)]
pub struct AcpSignInRequest {
    #[serde(flatten)]
    pub start: AcpSessionConfigRequest,
    pub method_id: String,
}

/// Signs the coding CLI in with one of its methods, e.g. a browser login, then starts the
/// chat's session and returns its options.
#[tauri::command]
pub async fn cli_acp_sign_in(
    req: AcpSignInRequest,
    state: State<'_, AcpSessionManager>,
) -> Result<Vec<SessionConfigOption>, String> {
    let start = &req.start;
    validate_start(start)?;
    if req.method_id.is_empty() || req.method_id.len() > 128 {
        return Err("a valid method_id is required".to_string());
    }

    state.stop_session(&start.chat_session_id).await;
    state
        .start_session(SessionStart {
            provider_id: &start.provider_id,
            cwd: &start.cwd,
            chat_session_id: &start.chat_session_id,
            allow_child_sessions: start.allow_child_sessions,
            mcp_server_ids: start.mcp_server_ids.as_deref(),
            account_dir: start.account_dir.as_deref(),
            resume_session_id: start.resume_session_id.as_deref(),
            replay_history: false,
            sign_in_method: Some(&req.method_id),
        })
        .await
        .map_err(|e| e.to_string())?;

    state
        .config_options(&start.chat_session_id)
        .await
        .map_err(|e| e.to_string())
}

/// Ends the coding CLI behind a chat, e.g. before its conversation goes on in a terminal.
#[tauri::command]
pub async fn cli_acp_stop_session(
    req: AcpSessionRequest,
    state: State<'_, AcpSessionManager>,
) -> Result<(), String> {
    if req.chat_session_id.is_empty() {
        return Err("chat_session_id is required".to_string());
    }
    state.stop_session(&req.chat_session_id).await;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn conversation_ids_are_plain() {
        assert!(is_conversation_id("d46ec595-b288-433a-85fc-6f5a76c52d86"));
        assert!(!is_conversation_id("short"));
        assert!(!is_conversation_id("d46ec595 --dangerous"));
        assert!(!is_conversation_id("../../etc/passwd-0000"));
    }
}
