use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;
use tauri::State;

use crate::ai::acp::{AcpSessionManager, PromptContent};
use crate::ai::cli::{built_in_manifests, CLIChatMessage, CLIChatRequest, CLIManager, CLIStatus};
use crate::commands::ai::StreamChunk;

// ─── Request / Response Types ────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CLIProviderRequest {
    pub provider_id: String,
}

#[derive(Debug, Deserialize)]
pub struct CLIChatCommandRequest {
    pub provider_id: String,
    pub messages: Vec<CLIChatMessage>,
    pub session_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AcpChatCommandRequest {
    pub provider_id: String,
    pub chat_session_id: String,
    pub cwd: String,
    pub messages: Vec<CLIChatMessage>,
}

#[derive(Debug, Deserialize)]
pub struct AcpCancelRequest {
    pub chat_session_id: String,
}

#[derive(Debug, Deserialize)]
pub struct AcpApproveRequest {
    pub tool_call_id: String,
    pub approved: bool,
}

#[derive(Debug, Serialize)]
pub struct CLIManifestResponse {
    pub id: String,
    pub name: String,
    pub description: String,
    pub supports_sessions: bool,
}

// ─── Commands ────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn cli_list_manifests() -> Result<Vec<CLIManifestResponse>, String> {
    let manifests = built_in_manifests();
    Ok(manifests
        .into_iter()
        .map(|m| CLIManifestResponse {
            id: m.id,
            name: m.name,
            description: m.description,
            supports_sessions: m.supports_sessions,
        })
        .collect())
}

#[tauri::command]
pub async fn cli_check_status(req: CLIProviderRequest) -> Result<CLIStatus, String> {
    if req.provider_id.is_empty() {
        return Err("provider_id is required".to_string());
    }

    let manager = CLIManager::new();
    manager
        .check_status(&req.provider_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cli_check_all_statuses() -> Result<Vec<CLIStatus>, String> {
    let manager = CLIManager::new();
    Ok(manager.check_all_statuses().await)
}

#[tauri::command]
pub async fn cli_install(req: CLIProviderRequest) -> Result<(), String> {
    if req.provider_id.is_empty() {
        return Err("provider_id is required".to_string());
    }

    let manager = CLIManager::new();
    manager
        .install(&req.provider_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cli_start_login(req: CLIProviderRequest) -> Result<String, String> {
    if req.provider_id.is_empty() {
        return Err("provider_id is required".to_string());
    }

    let manager = CLIManager::new();
    manager
        .start_login(&req.provider_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cli_logout(req: CLIProviderRequest) -> Result<(), String> {
    if req.provider_id.is_empty() {
        return Err("provider_id is required".to_string());
    }

    let manager = CLIManager::new();
    manager
        .logout(&req.provider_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cli_chat(req: CLIChatCommandRequest) -> Result<String, String> {
    if req.provider_id.is_empty() {
        return Err("provider_id is required".to_string());
    }
    if req.messages.is_empty() {
        return Err("messages are required".to_string());
    }

    let manager = CLIManager::new();
    let chat_req = CLIChatRequest {
        provider_id: req.provider_id,
        messages: req.messages,
        session_id: req.session_id,
        cwd: None,
    };

    let mut rx = manager.chat(chat_req).await.map_err(|e| e.to_string())?;

    // Collect all chunks into a single response (non-streaming for now)
    let mut full_text = String::new();
    while let Some(chunk) = rx.recv().await {
        if chunk.done {
            break;
        }
        full_text.push_str(&chunk.text);
    }

    Ok(full_text)
}

#[tauri::command]
pub async fn cli_chat_stream(
    req: CLIChatCommandRequest,
    channel: Channel<StreamChunk>,
) -> Result<(), String> {
    if req.provider_id.is_empty() {
        return Err("provider_id is required".to_string());
    }
    if req.messages.is_empty() {
        return Err("messages are required".to_string());
    }

    let manager = CLIManager::new();
    let chat_req = CLIChatRequest {
        provider_id: req.provider_id,
        messages: req.messages,
        session_id: req.session_id,
        cwd: None,
    };

    let mut rx = manager.chat(chat_req).await.map_err(|e| e.to_string())?;

    while let Some(chunk) = rx.recv().await {
        let done = chunk.done;
        let text = if chunk.text.is_empty() && !done {
            None
        } else {
            Some(chunk.text)
        };

        if channel
            .send(StreamChunk {
                text,
                error: None,
                done,
                tool_calls: None,
                tool_results: None,
            })
            .is_err()
        {
            break;
        }

        if done {
            break;
        }
    }

    Ok(())
}

// ─── ACP Commands ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn cli_acp_chat_stream(
    req: AcpChatCommandRequest,
    channel: Channel<StreamChunk>,
    state: State<'_, AcpSessionManager>,
) -> Result<(), String> {
    if req.provider_id.is_empty() {
        return Err("provider_id is required".to_string());
    }
    if req.chat_session_id.is_empty() {
        return Err("chat_session_id is required".to_string());
    }
    if req.cwd.is_empty() {
        return Err("cwd is required".to_string());
    }
    if req.messages.is_empty() {
        return Err("messages are required".to_string());
    }

    let prompt_contents: Vec<PromptContent> = req
        .messages
        .into_iter()
        .map(|m| PromptContent::Text { text: m.content })
        .collect();

    // Ensure the ACP session exists; create it on first use.
    if !state.has_session(&req.chat_session_id).await {
        state
            .start_session(&req.provider_id, &req.cwd, &req.chat_session_id)
            .await
            .map_err(|e| e.to_string())?;
    }

    let mut rx = state
        .send_prompt(&req.chat_session_id, prompt_contents)
        .await
        .map_err(|e| e.to_string())?;

    while let Some(chunk) = rx.recv().await {
        if channel.send(chunk).is_err() {
            break;
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn cli_acp_cancel(
    req: AcpCancelRequest,
    state: State<'_, AcpSessionManager>,
) -> Result<(), String> {
    if req.chat_session_id.is_empty() {
        return Err("chat_session_id is required".to_string());
    }

    state
        .cancel(&req.chat_session_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cli_acp_approve(
    req: AcpApproveRequest,
    state: State<'_, AcpSessionManager>,
) -> Result<(), String> {
    if req.tool_call_id.is_empty() {
        return Err("tool_call_id is required".to_string());
    }

    state
        .approve(&req.tool_call_id, req.approved)
        .await
        .map_err(|e| e.to_string())
}
