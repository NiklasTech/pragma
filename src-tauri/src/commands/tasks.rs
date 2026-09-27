use super::chat_storage::workspace_hash;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

static TEMP_FILE_COUNTER: AtomicU64 = AtomicU64::new(0);
static TASKS_IO_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

const MAX_TITLE_CHARS: usize = 120;
const MAX_NOTES_CHARS: usize = 8000;
const MAX_RESULT_CHARS: usize = 4000;
const STATUSES: [&str; 4] = ["todo", "in_progress", "in_review", "done"];

// ─── Public Types ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub notes: String,
    pub status: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub agent_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    #[serde(default)]
    pub result: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Deserialize)]
pub struct LoadTasksRequest {
    pub root_path: String,
}

#[derive(Debug, Deserialize)]
pub struct SaveTasksRequest {
    pub root_path: String,
    pub tasks: Vec<Task>,
}

// ─── Paths ───────────────────────────────────────────────────────────────────

fn tasks_path(app: &AppHandle, root_path: &str) -> Result<PathBuf, String> {
    if root_path.trim().is_empty() {
        return Err("root_path is required".to_string());
    }
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("failed to resolve app data dir: {e}"))?;
    let file_name = format!("{}.json", workspace_hash(root_path));
    Ok(base.join("pragma").join("tasks").join(file_name))
}

// ─── Validation ──────────────────────────────────────────────────────────────

fn validate_tasks(tasks: &[Task]) -> Result<(), String> {
    let mut seen = std::collections::HashSet::new();
    for task in tasks {
        if task.id.trim().is_empty() || !seen.insert(task.id.as_str()) {
            return Err("Task ids must be unique".to_string());
        }
        let title_chars = task.title.trim().chars().count();
        if title_chars == 0 || title_chars > MAX_TITLE_CHARS {
            return Err("Title must be 1 to 120 characters".to_string());
        }
        if task.notes.chars().count() > MAX_NOTES_CHARS {
            return Err("Notes must be 8000 characters or fewer".to_string());
        }
        if task.result.chars().count() > MAX_RESULT_CHARS {
            return Err("Result must be 4000 characters or fewer".to_string());
        }
        if !STATUSES.contains(&task.status.as_str()) {
            return Err("Invalid task status".to_string());
        }
    }
    Ok(())
}

// ─── IO ──────────────────────────────────────────────────────────────────────

async fn write_tasks_atomic(path: &std::path::Path, content: &[u8]) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("failed to create tasks dir: {e}"))?;
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

// ─── Commands ────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn tasks_load(app: AppHandle, req: LoadTasksRequest) -> Result<Vec<Task>, String> {
    let path = tasks_path(&app, &req.root_path)?;
    if !path.exists() {
        return Ok(Vec::new());
    }

    let content = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("failed to read tasks file: {e}"))?;
    serde_json::from_str::<Vec<Task>>(&content)
        .map_err(|e| format!("failed to parse tasks file: {e}"))
}

#[tauri::command]
pub async fn tasks_save(app: AppHandle, req: SaveTasksRequest) -> Result<(), String> {
    validate_tasks(&req.tasks)?;

    let _guard = TASKS_IO_LOCK.lock().await;
    let path = tasks_path(&app, &req.root_path)?;
    let content = serde_json::to_string_pretty(&req.tasks)
        .map_err(|e| format!("failed to serialize tasks: {e}"))?;
    write_tasks_atomic(&path, content.as_bytes()).await
}

#[cfg(test)]
mod tests {
    use super::*;

    fn task(id: &str, title: &str, status: &str) -> Task {
        Task {
            id: id.to_string(),
            title: title.to_string(),
            notes: String::new(),
            status: status.to_string(),
            agent_id: None,
            session_id: None,
            result: String::new(),
            created_at: 1,
            updated_at: 1,
        }
    }

    #[test]
    fn accepts_valid_tasks() {
        let tasks = vec![task("a", "Fix login", "todo"), task("b", "Ship", "done")];
        assert!(validate_tasks(&tasks).is_ok());
    }

    #[test]
    fn rejects_blank_or_long_title() {
        assert!(validate_tasks(&[task("a", "   ", "todo")]).is_err());
        assert!(validate_tasks(&[task("a", &"x".repeat(121), "todo")]).is_err());
        assert!(validate_tasks(&[task("a", &"x".repeat(120), "todo")]).is_ok());
    }

    #[test]
    fn rejects_unknown_status_and_duplicate_ids() {
        assert!(validate_tasks(&[task("a", "Fix", "blocked")]).is_err());
        assert!(validate_tasks(&[task("a", "One", "todo"), task("a", "Two", "todo")]).is_err());
    }

    #[test]
    fn rejects_long_notes_and_result() {
        let mut long_notes = task("a", "Fix", "todo");
        long_notes.notes = "x".repeat(8001);
        assert!(validate_tasks(&[long_notes]).is_err());

        let mut long_result = task("a", "Fix", "todo");
        long_result.result = "x".repeat(4001);
        assert!(validate_tasks(&[long_result]).is_err());
    }
}
