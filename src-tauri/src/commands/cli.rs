use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;

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
