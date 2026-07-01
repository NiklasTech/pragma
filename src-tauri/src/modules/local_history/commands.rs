use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri::Manager;

use super::diff_engine::compute_diff;
use super::storage::{get_all_snapshots, get_content_at_snapshot, SnapshotMeta};
use crate::modules::git::operations::{commit_file_diff, diff, file_history, resolve_repo};
use crate::modules::git::utils::authorized_repo_root;

#[derive(Serialize, Deserialize, Clone, Copy, Debug)]
#[serde(rename_all = "snake_case")]
pub enum HistoryEntryKind {
    Git,
    Snapshot,
}

#[derive(Serialize, Clone, Debug)]
pub struct HistoryEntry {
    pub id: String,
    pub kind: HistoryEntryKind,
    pub timestamp: i64,
    pub author: String,
    pub message: String,
}

#[derive(Serialize)]
pub struct LocalHistoryEntriesResponse {
    pub entries: Vec<HistoryEntry>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalHistoryDiffResponse {
    pub original: String,
    pub modified: String,
    pub patch_text: String,
}

fn resolve_app_data_dir(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {e}"))
}

fn resolve_parent_dir(file_path: &str) -> Result<std::path::PathBuf, String> {
    let path = Path::new(file_path);
    let canonical =
        std::fs::canonicalize(path).map_err(|e| format!("Failed to canonicalize path: {e}"))?;

    if canonical.is_file() {
        Ok(canonical
            .parent()
            .map(|p| p.to_path_buf())
            .unwrap_or(canonical))
    } else {
        Ok(canonical)
    }
}

pub(crate) fn resolve_repo_path(file_path: &str) -> Result<String, String> {
    let dir = resolve_parent_dir(file_path)?;

    // Prefer the actual git repo root. Fall back to the parent directory.
    match resolve_repo(&dir.to_string_lossy()) {
        Ok(Some(info)) => Ok(info.repo_root),
        _ => Ok(dir.to_string_lossy().into_owned()),
    }
}

fn snapshot_to_entry(meta: &SnapshotMeta) -> HistoryEntry {
    HistoryEntry {
        id: meta.id.clone(),
        kind: HistoryEntryKind::Snapshot,
        timestamp: meta.timestamp.timestamp_millis() / 1000,
        author: "Pragma".to_string(),
        message: "Auto-saved".to_string(),
    }
}

#[tauri::command]
pub async fn local_history_entries(
    app: tauri::AppHandle,
    file_path: String,
    limit: Option<u32>,
) -> Result<LocalHistoryEntriesResponse, String> {
    if file_path.is_empty() {
        return Err("File path is required".to_string());
    }

    let app_data_dir = resolve_app_data_dir(&app)?;
    let repo_path = resolve_repo_path(&file_path)?;
    let bounded = limit.map(|l| l.clamp(1, 200)).unwrap_or(50);

    let mut entries: Vec<HistoryEntry> = Vec::new();

    // Git history
    let git_repo_root = resolve_parent_dir(&file_path)
        .ok()
        .and_then(|dir| resolve_repo(&dir.to_string_lossy()).ok().flatten());

    if let Some(info) = git_repo_root {
        if let Ok(repo_root) = authorized_repo_root(&info.repo_root) {
            match file_history(&repo_root.to_string_lossy(), &file_path, bounded) {
                Ok(git_entries) => {
                    entries.extend(git_entries.into_iter().map(|entry| HistoryEntry {
                        id: entry.sha,
                        kind: HistoryEntryKind::Git,
                        timestamp: entry.timestamp_secs,
                        author: entry.author,
                        message: entry.subject,
                    }));
                }
                Err(err) => {
                    log::warn!("Failed to load git file history: {err}");
                }
            }
        }
    }

    // Snapshot history
    if let Ok(snapshots) = get_all_snapshots(&app_data_dir, &repo_path, &file_path) {
        entries.extend(snapshots.iter().map(snapshot_to_entry))
    }

    entries.sort_by_key(|b| std::cmp::Reverse(b.timestamp));
    entries.truncate(bounded as usize);

    Ok(LocalHistoryEntriesResponse { entries })
}

#[tauri::command]
pub async fn local_history_diff(
    app: tauri::AppHandle,
    file_path: String,
    entry_id: String,
    kind: HistoryEntryKind,
) -> Result<LocalHistoryDiffResponse, String> {
    if file_path.is_empty() {
        return Err("File path is required".to_string());
    }
    if entry_id.is_empty() {
        return Err("Entry id is required".to_string());
    }

    match kind {
        HistoryEntryKind::Git => {
            let repo_path = resolve_repo_path(&file_path)?;
            let diff = commit_file_diff(&repo_path, &entry_id, &file_path, None)
                .map_err(|e| format!("Failed to load git diff: {e}"))?;
            let patch_text = compute_diff(&diff.original_content, &diff.modified_content);
            Ok(LocalHistoryDiffResponse {
                original: diff.original_content,
                modified: diff.modified_content,
                patch_text,
            })
        }
        HistoryEntryKind::Snapshot => {
            let app_data_dir = resolve_app_data_dir(&app)?;
            let repo_path = resolve_repo_path(&file_path)?;
            let snapshot_content =
                get_content_at_snapshot(&app_data_dir, &repo_path, &file_path, &entry_id)?;
            let current_content = std::fs::read_to_string(&file_path)
                .map_err(|e| format!("Failed to read current file: {e}"))?;
            let patch_text = compute_diff(&snapshot_content, &current_content);
            Ok(LocalHistoryDiffResponse {
                original: snapshot_content,
                modified: current_content,
                patch_text,
            })
        }
    }
}

#[tauri::command]
pub async fn local_history_restore(
    app: tauri::AppHandle,
    file_path: String,
    entry_id: String,
    kind: HistoryEntryKind,
) -> Result<(), String> {
    if file_path.is_empty() {
        return Err("File path is required".to_string());
    }
    if entry_id.is_empty() {
        return Err("Entry id is required".to_string());
    }

    let content = match kind {
        HistoryEntryKind::Git => {
            let repo_path = resolve_repo_path(&file_path)?;
            let diff = commit_file_diff(&repo_path, &entry_id, &file_path, None)
                .map_err(|e| format!("Failed to load git content: {e}"))?;
            diff.modified_content
        }
        HistoryEntryKind::Snapshot => {
            let app_data_dir = resolve_app_data_dir(&app)?;
            let repo_path = resolve_repo_path(&file_path)?;
            get_content_at_snapshot(&app_data_dir, &repo_path, &file_path, &entry_id)?
        }
    };

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

/// Returns true if the file has uncommitted changes relative to git HEAD.
/// If the file is not inside a git repo or git is unavailable, returns true
/// so that snapshots are still kept as a fallback.
pub fn has_uncommitted_changes(file_path: &str) -> bool {
    let Ok(dir) = resolve_parent_dir(file_path) else {
        return true;
    };
    let Some(info) = resolve_repo(&dir.to_string_lossy()).ok().flatten() else {
        return true;
    };
    let Ok(repo_root) = authorized_repo_root(&info.repo_root) else {
        return true;
    };
    match diff(&repo_root.to_string_lossy(), Some(file_path), false) {
        Ok(result) => !result.diff_text.trim().is_empty(),
        Err(_) => true,
    }
}
