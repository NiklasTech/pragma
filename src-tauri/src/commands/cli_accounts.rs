use std::path::PathBuf;

use tauri::{AppHandle, Manager, Runtime};

use crate::ai::cli_accounts::{
    list_claude_accounts, AddedAccountFolder, CliAccount, CODEX_PROVIDER_ID,
};
use crate::ai::codex_accounts::list_codex_accounts;
use crate::ai::subscription_usage::CLAUDE_PROVIDER_ID;

const MAX_ADDED_DIRS: usize = 32;

fn added_for(added: &[AddedAccountFolder], provider_id: &str) -> Vec<PathBuf> {
    added
        .iter()
        .filter(|folder| folder.provider_id == provider_id)
        .take(MAX_ADDED_DIRS)
        .map(|folder| PathBuf::from(&folder.dir))
        .filter(|dir| dir.is_absolute())
        .collect()
}

/// Every Claude Code and Codex account on this machine: the default, `~/.claude-*` and
/// `~/.codex-*` folders, and folders added by hand.
#[tauri::command]
pub async fn cli_accounts_list<R: Runtime>(
    app: AppHandle<R>,
    added: Vec<AddedAccountFolder>,
) -> Result<Vec<CliAccount>, String> {
    let home = app
        .path()
        .home_dir()
        .map_err(|error| format!("Could not resolve the home folder: {error}"))?;
    let claude_added = added_for(&added, CLAUDE_PROVIDER_ID);
    let codex_added = added_for(&added, CODEX_PROVIDER_ID);
    let claude_env = std::env::var("CLAUDE_CONFIG_DIR").ok();
    let codex_env = std::env::var("CODEX_HOME").ok();
    tauri::async_runtime::spawn_blocking(move || {
        let mut accounts = list_claude_accounts(&home, claude_env.as_deref(), &claude_added);
        accounts.extend(list_codex_accounts(
            &home,
            codex_env.as_deref(),
            &codex_added,
        ));
        accounts
    })
    .await
    .map_err(|error| format!("Could not list the accounts: {error}"))
}
