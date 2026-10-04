use super::agents::AgentEngine;
use crate::ai::image::{validate_image, ImageContent};
use std::path::{Component, Path, PathBuf};
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
    #[serde(default)]
    pub cli_provider_id: Option<String>,
    #[serde(default)]
    pub agent_id: Option<String>,
    #[serde(default)]
    pub archived: bool,
    #[serde(default)]
    pub agent_engine: Option<AgentEngine>,
    #[serde(default)]
    pub parent_id: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
    /// MCP server ids the session uses; absent means the agent's or all servers.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mcp_servers: Option<Vec<String>>,
    /// Token totals of the session; absent until a model reported usage.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub usage: Option<SessionUsageMetadata>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SessionUsageMetadata {
    #[serde(default)]
    pub input_tokens: u64,
    #[serde(default)]
    pub output_tokens: u64,
    #[serde(default)]
    pub cache_read_tokens: u64,
    #[serde(default)]
    pub cache_write_tokens: u64,
    #[serde(default)]
    pub responses: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub context_tokens: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub context_window: Option<u64>,
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
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub images: Vec<ImageContent>,
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

fn validate_session_id(session_id: &str) -> Result<(), String> {
    let mut components = Path::new(session_id).components();
    match (components.next(), components.next()) {
        (Some(Component::Normal(name)), None)
            if name == session_id && !session_id.contains('\\') =>
        {
            Ok(())
        }
        _ => Err(format!("invalid session id: {session_id:?}")),
    }
}

fn session_dir(app: &AppHandle, root_path: &str, session_id: &str) -> Result<PathBuf, String> {
    validate_session_id(session_id)?;
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
    load_sessions(&dir).await
}

async fn load_sessions(dir: &Path) -> Result<Vec<ChatSessionMetadata>, String> {
    if !dir.exists() {
        return Ok(Vec::new());
    }

    let mut sessions = Vec::new();
    let mut entries = tokio::fs::read_dir(dir)
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
    load_messages(&path).await
}

async fn load_messages(path: &Path) -> Result<Vec<ChatMessage>, String> {
    if !path.exists() {
        return Ok(Vec::new());
    }

    let content = tokio::fs::read_to_string(path)
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

async fn write_file(path: &Path, content: &[u8]) -> Result<(), String> {
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
    save_session(&dir, &req.session).await
}

async fn save_session(dir: &Path, session: &ChatSessionMetadata) -> Result<(), String> {
    let content = serde_json::to_string_pretty(session)
        .map_err(|e| format!("failed to serialize session: {e}"))?;
    write_file(&dir.join("state.json"), content.as_bytes()).await
}

#[tauri::command]
pub async fn ai_save_session_messages(
    app: AppHandle,
    req: SaveMessagesRequest,
) -> Result<(), String> {
    for image in req.messages.iter().flat_map(|message| &message.images) {
        validate_image(image)?;
    }
    let _guard = SESSION_IO_LOCK.lock().await;
    let path = context_path(&app, &req.root_path, &req.session_id)?;
    save_messages(&path, req.messages).await
}

async fn save_messages(path: &Path, messages: Vec<ChatMessage>) -> Result<(), String> {
    if messages.is_empty() {
        if let Ok(existing) = tokio::fs::read_to_string(path).await {
            if !existing.trim().is_empty() {
                return Ok(());
            }
        }
    }

    let mut lines = String::new();
    for message in messages {
        let line = serde_json::to_string(&message)
            .map_err(|e| format!("failed to serialize message: {e}"))?;
        lines.push_str(&line);
        lines.push('\n');
    }

    write_file(path, lines.as_bytes()).await
}

#[tauri::command]
pub async fn ai_delete_session(app: AppHandle, req: DeleteSessionRequest) -> Result<(), String> {
    let _guard = SESSION_IO_LOCK.lock().await;
    let dir = session_dir(&app, &req.root_path, &req.session_id)?;
    delete_session_dir(&dir).await
}

async fn delete_session_dir(dir: &Path) -> Result<(), String> {
    if dir.exists() {
        tokio::fs::remove_dir_all(dir)
            .await
            .map_err(|e| format!("failed to delete session dir: {e}"))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn session(id: &str, updated_at: i64) -> ChatSessionMetadata {
        serde_json::from_value(serde_json::json!({
            "id": id,
            "title": format!("Session {id}"),
            "created_at": 1,
            "updated_at": updated_at,
        }))
        .unwrap()
    }

    fn message(id: &str, content: &str) -> ChatMessage {
        ChatMessage {
            id: id.to_string(),
            role: "user".to_string(),
            content: content.to_string(),
            timestamp: 1,
            images: Vec::new(),
        }
    }

    #[test]
    fn session_usage_round_trips_and_stays_optional() {
        let without = session("a", 1);
        assert!(without.usage.is_none());
        assert!(serde_json::to_value(&without)
            .unwrap()
            .get("usage")
            .is_none());

        let with: ChatSessionMetadata = serde_json::from_value(serde_json::json!({
            "id": "b",
            "title": "Session b",
            "created_at": 1,
            "updated_at": 2,
            "usage": { "input_tokens": 1200, "output_tokens": 300, "responses": 2, "context_tokens": 900 }
        }))
        .unwrap();
        let usage = with.usage.clone().expect("usage");
        assert_eq!(usage.input_tokens, 1200);
        assert_eq!(usage.cache_read_tokens, 0);
        assert_eq!(usage.context_tokens, Some(900));
        assert_eq!(usage.context_window, None);

        let saved = serde_json::to_value(&with).unwrap();
        assert_eq!(saved["usage"]["output_tokens"], 300);
        assert!(saved["usage"].get("context_window").is_none());
    }

    #[test]
    fn session_ids_must_be_a_single_path_component() {
        assert!(validate_session_id("6f1c2a9e-1111-4c2d-9a7b-0123456789ab").is_ok());
        assert!(validate_session_id("legacy_session-1").is_ok());

        for invalid in ["", ".", "..", "../other", "a/b", "a\\b", "/abs", "a/"] {
            assert!(validate_session_id(invalid).is_err(), "{invalid:?}");
        }
    }

    #[test]
    fn workspace_hash_is_stable_per_root() {
        assert_eq!(workspace_hash("/repo"), workspace_hash("/repo"));
        assert_ne!(workspace_hash("/repo"), workspace_hash("/other"));
        assert_eq!(workspace_hash("/repo").len(), 64);
    }

    #[tokio::test]
    async fn load_sessions_returns_empty_for_a_missing_directory() {
        let dir = tempfile::tempdir().unwrap();
        let sessions = load_sessions(&dir.path().join("missing")).await.unwrap();
        assert!(sessions.is_empty());
    }

    #[tokio::test]
    async fn saved_sessions_load_newest_first() {
        let dir = tempfile::tempdir().unwrap();
        save_session(&dir.path().join("old"), &session("old", 10))
            .await
            .unwrap();
        save_session(&dir.path().join("new"), &session("new", 20))
            .await
            .unwrap();

        let sessions = load_sessions(dir.path()).await.unwrap();
        let ids: Vec<_> = sessions.iter().map(|s| s.id.as_str()).collect();

        assert_eq!(ids, vec!["new", "old"]);
        assert_eq!(sessions[0].title, "Session new");
        assert!(!sessions[0].archived);
    }

    #[tokio::test]
    async fn load_sessions_skips_broken_and_unrelated_entries() {
        let dir = tempfile::tempdir().unwrap();
        save_session(&dir.path().join("good"), &session("good", 1))
            .await
            .unwrap();
        for (name, content) in [("empty", "  "), ("corrupt", "{not json")] {
            std::fs::create_dir(dir.path().join(name)).unwrap();
            std::fs::write(dir.path().join(name).join("state.json"), content).unwrap();
        }
        std::fs::create_dir(dir.path().join("no-state")).unwrap();
        std::fs::write(dir.path().join("stray.json"), "{}").unwrap();

        let sessions = load_sessions(dir.path()).await.unwrap();

        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].id, "good");
    }

    #[tokio::test]
    async fn messages_round_trip_as_json_lines() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("session").join("context.jsonl");
        let messages = vec![message("1", "hello"), message("2", "multi\nline")];

        save_messages(&path, messages).await.unwrap();

        let content = std::fs::read_to_string(&path).unwrap();
        assert_eq!(content.lines().count(), 2);
        let loaded = load_messages(&path).await.unwrap();
        assert_eq!(loaded.len(), 2);
        assert_eq!(loaded[1].content, "multi\nline");
    }

    #[tokio::test]
    async fn message_images_round_trip_and_stay_optional() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("context.jsonl");
        let image = ImageContent {
            media_type: "image/png".to_string(),
            data: "aGk=".to_string(),
        };
        let with_image = ChatMessage {
            images: vec![image.clone()],
            ..message("1", "look")
        };

        save_messages(&path, vec![with_image, message("2", "plain")])
            .await
            .unwrap();

        let content = std::fs::read_to_string(&path).unwrap();
        assert!(!content.lines().nth(1).unwrap().contains("images"));
        let loaded = load_messages(&path).await.unwrap();
        assert_eq!(loaded[0].images, vec![image]);
        assert!(loaded[1].images.is_empty());
    }

    #[tokio::test]
    async fn saving_no_messages_keeps_existing_history() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("context.jsonl");
        save_messages(&path, vec![message("1", "keep")])
            .await
            .unwrap();

        save_messages(&path, Vec::new()).await.unwrap();

        assert_eq!(load_messages(&path).await.unwrap().len(), 1);
    }

    #[tokio::test]
    async fn load_messages_handles_missing_and_corrupt_files() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("context.jsonl");
        assert!(load_messages(&path).await.unwrap().is_empty());

        std::fs::write(&path, "\n{broken\n").unwrap();

        assert!(load_messages(&path)
            .await
            .unwrap_err()
            .starts_with("failed to parse context line"));
    }

    #[tokio::test]
    async fn write_file_replaces_content_without_leaving_temp_files() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("state.json");

        write_file(&path, b"first").await.unwrap();
        write_file(&path, b"second").await.unwrap();

        assert_eq!(std::fs::read_to_string(&path).unwrap(), "second");
        assert_eq!(std::fs::read_dir(dir.path()).unwrap().count(), 1);
    }

    #[tokio::test]
    async fn delete_session_dir_removes_the_session_and_ignores_missing_ones() {
        let dir = tempfile::tempdir().unwrap();
        let session_dir = dir.path().join("session");
        save_session(&session_dir, &session("session", 1))
            .await
            .unwrap();
        save_messages(&session_dir.join("context.jsonl"), vec![message("1", "x")])
            .await
            .unwrap();

        delete_session_dir(&session_dir).await.unwrap();
        delete_session_dir(&session_dir).await.unwrap();

        assert!(!session_dir.exists());
        assert!(dir.path().exists());
    }
}
