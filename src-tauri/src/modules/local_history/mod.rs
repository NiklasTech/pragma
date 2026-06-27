pub mod commands;
pub mod config;
pub mod diff_engine;
pub mod storage;
pub mod watcher;

use tauri::Manager;

use commands::has_uncommitted_changes;
use config::RetentionPolicy;
use storage::save_snapshot;

pub fn on_file_saved(
    app: &tauri::AppHandle,
    _repo_path: &str,
    file_path: &str,
    content: &str,
) -> Result<(), String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {e}"))?;

    // Only keep snapshots for files that differ from the last commit.
    // Outside of git this always returns true, preserving basic history support.
    if !has_uncommitted_changes(file_path) {
        return Ok(());
    }

    let repo_path = commands::resolve_repo_path(file_path)?;

    save_snapshot(
        &app_data_dir,
        &repo_path,
        file_path,
        content,
        RetentionPolicy::default(),
    )
}
