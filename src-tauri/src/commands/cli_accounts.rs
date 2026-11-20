use std::path::PathBuf;

use tauri::{AppHandle, Manager, Runtime};

use crate::ai::cli_accounts::{list_claude_accounts, CliAccount};

const MAX_ADDED_DIRS: usize = 32;

/// Every Claude Code account on this machine: the default, `~/.claude-*` folders and folders added by hand.
#[tauri::command]
pub async fn cli_accounts_list<R: Runtime>(
    app: AppHandle<R>,
    added_dirs: Vec<String>,
) -> Result<Vec<CliAccount>, String> {
    let home = app
        .path()
        .home_dir()
        .map_err(|error| format!("Could not resolve the home folder: {error}"))?;
    let added: Vec<PathBuf> = added_dirs
        .iter()
        .take(MAX_ADDED_DIRS)
        .map(PathBuf::from)
        .filter(|dir| dir.is_absolute())
        .collect();
    let env_dir = std::env::var("CLAUDE_CONFIG_DIR").ok();
    tauri::async_runtime::spawn_blocking(move || {
        list_claude_accounts(&home, env_dir.as_deref(), &added)
    })
    .await
    .map_err(|error| format!("Could not list the accounts: {error}"))
}
