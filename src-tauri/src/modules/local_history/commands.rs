use serde::Serialize;
use std::path::Path;
use tauri::Manager;

use super::storage::{get_all_snapshots, get_content_at_snapshot, SnapshotMeta};

#[derive(Serialize)]
pub struct LocalHistorySnapshotsResponse {
    pub snapshots: Vec<SnapshotMeta>,
}

#[derive(Serialize)]
pub struct LocalHistoryDiffResponse {
    pub original: String,
    pub modified: String,
}

fn resolve_app_data_dir(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {e}"))
}

fn resolve_repo_path(file_path: &str) -> Result<String, String> {
    let path = Path::new(file_path);
    let canonical =
        std::fs::canonicalize(path).map_err(|e| format!("Failed to canonicalize path: {e}"))?;

    let mut current = canonical.as_path();
    while let Some(parent) = current.parent() {
        if parent.join(".git").is_dir() {
            return Ok(parent.to_string_lossy().into_owned());
        }
        current = parent;
    }

    Ok(canonical
        .parent()
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_default())
}

#[tauri::command]
pub async fn local_history_snapshots(
    app: tauri::AppHandle,
    file_path: String,
) -> Result<LocalHistorySnapshotsResponse, String> {
    if file_path.is_empty() {
        return Err("File path is required".to_string());
    }

    let app_data_dir = resolve_app_data_dir(&app)?;
    let repo_path = resolve_repo_path(&file_path)?;
    let snapshots = get_all_snapshots(&app_data_dir, &repo_path, &file_path)?;

    Ok(LocalHistorySnapshotsResponse { snapshots })
}

#[tauri::command]
pub async fn local_history_diff(
    app: tauri::AppHandle,
    file_path: String,
    snapshot_id: String,
) -> Result<LocalHistoryDiffResponse, String> {
    if file_path.is_empty() {
        return Err("File path is required".to_string());
    }
    if snapshot_id.is_empty() {
        return Err("Snapshot ID is required".to_string());
    }

    let app_data_dir = resolve_app_data_dir(&app)?;
    let repo_path = resolve_repo_path(&file_path)?;

    let current_content = std::fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read current file: {e}"))?;

    let snapshot_content =
        get_content_at_snapshot(&app_data_dir, &repo_path, &file_path, &snapshot_id)?;

    Ok(LocalHistoryDiffResponse {
        original: snapshot_content,
        modified: current_content,
    })
}

#[tauri::command]
pub async fn local_history_restore(
    app: tauri::AppHandle,
    file_path: String,
    snapshot_id: String,
) -> Result<(), String> {
    if file_path.is_empty() {
        return Err("File path is required".to_string());
    }
    if snapshot_id.is_empty() {
        return Err("Snapshot ID is required".to_string());
    }

    let app_data_dir = resolve_app_data_dir(&app)?;
    let repo_path = resolve_repo_path(&file_path)?;

    let content = get_content_at_snapshot(&app_data_dir, &repo_path, &file_path, &snapshot_id)?;

    std::fs::write(&file_path, content).map_err(|e| format!("Failed to restore file: {e}"))?;

    Ok(())
}

#[tauri::command]
pub async fn local_history_delete_older_than(
    app: tauri::AppHandle,
    file_path: String,
    days: u32,
) -> Result<(), String> {
    if file_path.is_empty() {
        return Err("File path is required".to_string());
    }

    let app_data_dir = resolve_app_data_dir(&app)?;
    let repo_path = resolve_repo_path(&file_path)?;

    let mut snapshots = get_all_snapshots(&app_data_dir, &repo_path, &file_path)?;
    let cutoff = chrono::Utc::now() - chrono::Duration::days(days as i64);

    snapshots.retain(|s| s.timestamp >= cutoff);

    let hash = {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        let mut hasher = DefaultHasher::new();
        file_path.hash(&mut hasher);
        format!("{:016x}", hasher.finish())
    };

    let dir = app_data_dir
        .join("history")
        .join({
            use std::collections::hash_map::DefaultHasher;
            use std::hash::{Hash, Hasher};
            let mut hasher = DefaultHasher::new();
            repo_path.hash(&mut hasher);
            format!("{:016x}", hasher.finish())
        })
        .join(&hash);

    let meta_file = dir.join("meta.json");
    let meta_json = serde_json::to_string_pretty(&snapshots)
        .map_err(|e| format!("Failed to serialize meta: {e}"))?;
    std::fs::write(&meta_file, meta_json).map_err(|e| format!("Failed to write meta file: {e}"))?;

    Ok(())
}
