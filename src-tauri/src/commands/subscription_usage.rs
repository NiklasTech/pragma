use std::path::PathBuf;

use tauri::{AppHandle, Manager, Runtime};

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

fn claude_config<R: Runtime>(app: &AppHandle<R>) -> Result<(PathBuf, PathBuf), String> {
    let home = home_dir(app)?;
    let config_dir = std::env::var("CLAUDE_CONFIG_DIR").ok();
    Ok((claude_config_path(config_dir.as_deref(), &home), home))
}

/// The usage the CLI last cached; reads a file only, no network and no credentials.
#[tauri::command]
pub async fn subscription_usage_read<R: Runtime>(
    app: AppHandle<R>,
    provider_id: String,
) -> Result<SubscriptionUsage, String> {
    ensure_supported(&provider_id)?;
    let (path, _) = claude_config(&app)?;
    read_claude_usage(&path).await
}

/// Lets the CLI fetch fresh usage in its own process, then reads what it cached.
#[tauri::command]
pub async fn subscription_usage_refresh<R: Runtime>(
    app: AppHandle<R>,
    provider_id: String,
) -> Result<SubscriptionUsage, String> {
    ensure_supported(&provider_id)?;
    let (path, home) = claude_config(&app)?;
    refresh_claude_usage(&path, &home).await
}
