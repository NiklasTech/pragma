use std::path::PathBuf;

use tauri::{AppHandle, Manager, Runtime};

use crate::ai::cli_accounts::existing_account_dir;
use crate::ai::subscription_usage::{
    claude_config_path, read_claude_usage, refresh_claude_usage, SubscriptionUsage,
    CLAUDE_PROVIDER_ID,
};

fn home_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    app.path()
        .home_dir()
        .map_err(|error| format!("Could not resolve the home folder: {error}"))
}

fn ensure_supported(provider_id: &str) -> Result<(), String> {
    if provider_id == CLAUDE_PROVIDER_ID {
        Ok(())
    } else {
        Err("Subscription usage is not available for this CLI".to_string())
    }
}

/// The config file to read, the folder to run in, and the account folder of a second account.
struct ClaudeConfig {
    path: PathBuf,
    home: PathBuf,
    account_dir: Option<PathBuf>,
}

fn claude_config<R: Runtime>(
    app: &AppHandle<R>,
    config_dir: Option<&str>,
) -> Result<ClaudeConfig, String> {
    let home = home_dir(app)?;
    let account_dir = config_dir.map(existing_account_dir).transpose()?;
    let path = match &account_dir {
        Some(dir) => claude_config_path(dir.to_str(), &home),
        None => claude_config_path(std::env::var("CLAUDE_CONFIG_DIR").ok().as_deref(), &home),
    };
    Ok(ClaudeConfig {
        path,
        home,
        account_dir,
    })
}

/// The usage the CLI last cached; reads a file only, no network and no credentials.
#[tauri::command]
pub async fn subscription_usage_read<R: Runtime>(
    app: AppHandle<R>,
    provider_id: String,
    config_dir: Option<String>,
) -> Result<SubscriptionUsage, String> {
    ensure_supported(&provider_id)?;
    let config = claude_config(&app, config_dir.as_deref())?;
    read_claude_usage(&config.path).await
}

/// Lets the CLI fetch fresh usage in its own process, then reads what it cached.
#[tauri::command]
pub async fn subscription_usage_refresh<R: Runtime>(
    app: AppHandle<R>,
    provider_id: String,
    config_dir: Option<String>,
) -> Result<SubscriptionUsage, String> {
    ensure_supported(&provider_id)?;
    let config = claude_config(&app, config_dir.as_deref())?;
    refresh_claude_usage(&config.path, &config.home, config.account_dir.as_deref()).await
}
