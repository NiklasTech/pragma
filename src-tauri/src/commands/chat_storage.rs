use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Manager};

static TEMP_FILE_COUNTER: AtomicU64 = AtomicU64::new(0);
static SESSION_IO_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

// ─── Public Types ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatSessionMetadata {
    pub id: String,
    pub title: String,
    pub created_at: i64,
    pub updated_at: i64,
    #[serde(default)]
    pub kind: String,
    #[serde(default)]
    pub environment: String,
    #[serde(default)]
    pub worktree: Option<SessionWorktreeMetadata>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionWorktreeMetadata {
    pub branch: String,
    pub path: String,
    pub setup_log: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub id: String,
    pub role: String,
    pub content: String,
    pub timestamp: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoadSessionsRequest {
    pub root_path: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoadMessagesRequest {
    pub root_path: String,
    pub session_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SaveSessionRequest {
    pub root_path: String,
    pub session: ChatSessionMetadata,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SaveMessagesRequest {
    pub root_path: String,
    pub session_id: String,
    pub messages: Vec<ChatMessage>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DeleteSessionRequest {
    pub root_path: String,
    pub session_id: String,
}

// ─── Paths ───────────────────────────────────────────────────────────────────

pub(crate) fn workspace_hash(root_path: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(root_path.as_bytes());
    format!("{:x}", hasher.finalize())
}

fn sessions_dir(app: &AppHandle, root_path: &str) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("failed to resolve app data dir: {e}"))?;
    let hash = workspace_hash(root_path);
    Ok(base.join("pragma").join("sessions").join(hash))
}

fn session_dir(app: &AppHandle, root_path: &str, session_id: &str) -> Result<PathBuf, String> {
    Ok(sessions_dir(app, root_path)?.join(session_id))
}

fn context_path(app: &AppHandle, root_path: &str, session_id: &str) -> Result<PathBuf, String> {
    Ok(session_dir(app, root_path, session_id)?.join("context.jsonl"))
}

// ─── Commands ────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn ai_load_sessions(
    app: AppHandle,
    req: LoadSessionsRequest,
) -> Result<Vec<ChatSessionMetadata>, String> {
    let dir = sessions_dir(&app, &req.root_path)?;
    if !dir.exists() {
        return Ok(Vec::new());
    }

    let mut sessions = Vec::new();
    let mut entries = tokio::fs::read_dir(&dir)
        .await
        .map_err(|e| format!("failed to read sessions dir: {e}"))?;

    while let Some(entry) = entries
        .next_entry()
        .await
        .map_err(|e| format!("failed to read dir entry: {e}"))?
    {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let state_file = path.join("state.json");
        if !state_file.exists() {
            continue;
        }

        let content = match tokio::fs::read_to_string(&state_file).await {
            Ok(c) if c.trim().is_empty() => continue,
            Ok(c) => c,
            Err(_e) => {
                continue;
            }
        };
        match serde_json::from_str::<ChatSessionMetadata>(&content) {
            Ok(session) => sessions.push(session),
            Err(_e) => {
                continue;
            }
        }
    }

    sessions.sort_by_key(|b| std::cmp::Reverse(b.updated_at));
    Ok(sessions)
}

#[tauri::command]
pub async fn ai_load_session_messages(
    app: AppHandle,
    req: LoadMessagesRequest,
) -> Result<Vec<ChatMessage>, String> {
    let path = context_path(&app, &req.root_path, &req.session_id)?;
    if !path.exists() {
        return Ok(Vec::new());
    }

    let content = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("failed to read context file: {e}"))?;

    let mut messages = Vec::new();
    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let message: ChatMessage =
            serde_json::from_str(line).map_err(|e| format!("failed to parse context line: {e}"))?;
        messages.push(message);
    }

    Ok(messages)
}

async fn write_file(path: &std::path::Path, content: &[u8]) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("failed to create parent dir: {e}"))?;
    }

    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| format!("invalid file path: {path:?}"))?;
    let nonce = TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed);
    let temp_path =
        path.with_file_name(format!("{file_name}.{}.{}.tmp", std::process::id(), nonce));

    if let Err(e) = tokio::fs::write(&temp_path, content).await {
        let _ = tokio::fs::remove_file(&temp_path).await;
        return Err(format!("failed to write temp file {temp_path:?}: {e}"));
    }
    if let Err(e) = tokio::fs::rename(&temp_path, path).await {
        let _ = tokio::fs::remove_file(&temp_path).await;
        return Err(format!("failed to replace file {path:?}: {e}"));
    }

    Ok(())
}

#[tauri::command]
pub async fn ai_save_session(app: AppHandle, req: SaveSessionRequest) -> Result<(), String> {
    let _guard = SESSION_IO_LOCK.lock().await;
    let dir = session_dir(&app, &req.root_path, &req.session.id)?;
    let path = dir.join("state.json");
    let content = serde_json::to_string_pretty(&req.session)
        .map_err(|e| format!("failed to serialize session: {e}"))?;
    write_file(&path, content.as_bytes()).await?;

    Ok(())
}

#[tauri::command]
pub async fn ai_save_session_messages(
    app: AppHandle,
    req: SaveMessagesRequest,
) -> Result<(), String> {
    let _guard = SESSION_IO_LOCK.lock().await;
    let dir = session_dir(&app, &req.root_path, &req.session_id)?;
    let path = dir.join("context.jsonl");

    if req.messages.is_empty() {
        if let Ok(existing) = tokio::fs::read_to_string(&path).await {
            if !existing.trim().is_empty() {
                return Ok(());
            }
        }
    }

    let mut lines = String::new();
    for message in req.messages {
        let line = serde_json::to_string(&message)
            .map_err(|e| format!("failed to serialize message: {e}"))?;
        lines.push_str(&line);
        lines.push('\n');
    }

    write_file(&path, lines.as_bytes()).await?;

    Ok(())
}

#[tauri::command]
pub async fn ai_delete_session(app: AppHandle, req: DeleteSessionRequest) -> Result<(), String> {
    let _guard = SESSION_IO_LOCK.lock().await;
    let dir = session_dir(&app, &req.root_path, &req.session_id)?;
    if dir.exists() {
        tokio::fs::remove_dir_all(&dir)
            .await
            .map_err(|e| format!("failed to delete session dir: {e}"))?;
    }
    Ok(())
}
