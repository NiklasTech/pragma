pub mod client;
pub mod connection;
pub mod error;
pub mod http;
pub mod import;
pub mod manager;
pub mod oauth;
pub mod resources;
pub mod secrets;
mod sse;
mod start;
pub mod tools;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager, State};

pub use manager::{McpManager, McpServerState, McpServerStatus};
pub use tools::{McpTool, McpToolCallResult};

const CONFIG_FILE: &str = "mcp.json";
const TOOLS_CACHE_FILE: &str = "mcp-tools-cache.json";
/// Version 1 keeps secret env values in the keychain instead of the file.
pub const CONFIG_VERSION: u32 = 1;

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum McpTransport {
    #[default]
    Stdio,
    /// Streamable HTTP for remote servers.
    Http,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpServerConfig {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub transport: McpTransport,
    #[serde(default)]
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub env: HashMap<String, String>,
    /// Env names whose values live in the OS keychain.
    #[serde(default)]
    pub secret_env: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(default)]
    pub headers: HashMap<String, String>,
    /// Header names whose values live in the OS keychain.
    #[serde(default)]
    pub secret_headers: Vec<String>,
    #[serde(default)]
    pub autostart: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct McpConfigFile {
    #[serde(default)]
    pub version: u32,
    pub servers: Vec<McpServerConfig>,
}

fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Failed to resolve app config dir: {e}"))?;
    Ok(dir.join(CONFIG_FILE))
}

fn tools_cache_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Failed to resolve app config dir: {e}"))?;
    Ok(dir.join(TOOLS_CACHE_FILE))
}

pub async fn load_tools_cache(app: &AppHandle) -> Result<HashMap<String, Vec<McpTool>>, String> {
    let path = tools_cache_path(app)?;
    if !path.exists() {
        return Ok(HashMap::new());
    }
    let content = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("Failed to read MCP tools cache: {e}"))?;
    serde_json::from_str(&content).map_err(|e| format!("Failed to parse MCP tools cache: {e}"))
}

pub async fn save_tools_cache(
    app: &AppHandle,
    cache: &HashMap<String, Vec<McpTool>>,
) -> Result<(), String> {
    let path = tools_cache_path(app)?;
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Failed to create config directory: {e}"))?;
    }
    let content = serde_json::to_string_pretty(cache)
        .map_err(|e| format!("Failed to serialize MCP tools cache: {e}"))?;
    tokio::fs::write(&path, content)
        .await
        .map_err(|e| format!("Failed to write MCP tools cache: {e}"))?;
    Ok(())
}

async fn read_config_file(path: &Path) -> Result<Option<McpConfigFile>, String> {
    if !path.exists() {
        return Ok(None);
    }

    let content = tokio::fs::read_to_string(path)
        .await
        .map_err(|e| format!("Failed to read MCP config: {e}"))?;

    if content.trim().is_empty() {
        return Ok(None);
    }

    serde_json::from_str(&content)
        .map(Some)
        .map_err(|e| format!("Failed to parse MCP config: {e}"))
}

pub async fn write_config_file(path: &Path, servers: Vec<McpServerConfig>) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Failed to create config directory: {e}"))?;
    }

    let file = McpConfigFile {
        version: CONFIG_VERSION,
        servers,
    };
    let content = serde_json::to_string_pretty(&file)
        .map_err(|e| format!("Failed to serialize MCP config: {e}"))?;

    tokio::fs::write(path, content)
        .await
        .map_err(|e| format!("Failed to write MCP config: {e}"))
}

#[tauri::command]
pub async fn mcp_load_config(app: AppHandle) -> Result<Vec<McpServerConfig>, String> {
    let path = config_path(&app)?;
    Ok(read_config_file(&path)
        .await?
        .map(|file| file.servers)
        .unwrap_or_default())
}

/// Rejects configs the manager could never start.
fn validate_server(server: &McpServerConfig) -> Result<(), String> {
    match server.transport {
        McpTransport::Stdio if server.command.trim().is_empty() => {
            Err(format!("MCP server {} needs a command", server.name))
        }
        McpTransport::Http => {
            let url = server
                .url
                .as_deref()
                .ok_or_else(|| format!("MCP server {} needs a URL", server.name))?;
            http::validate_url(url)
                .map(|_| ())
                .map_err(|e| e.to_string())
        }
        McpTransport::Stdio => Ok(()),
    }
}

#[tauri::command]
pub async fn mcp_save_config(
    app: AppHandle,
    mut servers: Vec<McpServerConfig>,
) -> Result<(), String> {
    for server in &servers {
        validate_server(server)?;
    }
    let path = config_path(&app)?;
    let previous = read_config_file(&path)
        .await
        .ok()
        .flatten()
        .map(|file| file.servers)
        .unwrap_or_default();

    servers.iter_mut().for_each(secrets::sanitize);
    write_config_file(&path, servers.clone()).await?;
    secrets::delete_orphaned(&previous, &servers);

    Ok(())
}

#[tauri::command]
pub async fn mcp_list_servers(state: State<'_, McpManager>) -> Result<Vec<McpServerState>, String> {
    Ok(state.list_servers().await)
}

#[tauri::command]
pub async fn mcp_start_server(state: State<'_, McpManager>, id: String) -> Result<(), String> {
    state.start_server(&id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn mcp_stop_server(state: State<'_, McpManager>, id: String) -> Result<(), String> {
    state.stop_server(&id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn mcp_restart_server(state: State<'_, McpManager>, id: String) -> Result<(), String> {
    state.restart_server(&id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn mcp_list_tools(
    state: State<'_, McpManager>,
    id: String,
) -> Result<Vec<McpTool>, String> {
    Ok(state.get_tools(&id).await)
}

#[tauri::command]
pub async fn mcp_call_tool(
    state: State<'_, McpManager>,
    id: String,
    tool_name: String,
    arguments: Option<Value>,
) -> Result<McpToolCallResult, String> {
    state
        .call_tool(&id, &tool_name, arguments)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn mcp_oauth_authorize(
    app: AppHandle,
    state: State<'_, McpManager>,
    id: String,
) -> Result<(), String> {
    let config = state
        .config_for(&id)
        .await
        .ok_or_else(|| format!("MCP server not found: {id}"))?;
    let url = match (config.transport, config.url.as_deref()) {
        (McpTransport::Http, Some(url)) => url.to_string(),
        _ => return Err("Only remote MCP servers sign in with OAuth".to_string()),
    };
    oauth::authorize(&app, &id, &url)
        .await
        .map_err(|e| e.to_string())?;
    state.restart_server(&id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn mcp_oauth_sign_out(state: State<'_, McpManager>, id: String) -> Result<(), String> {
    secrets::delete_oauth_tokens(&id).map_err(|e| e.to_string())?;
    if state.server_status(&id).await.is_some() {
        let _ = state.stop_server(&id).await;
    }
    Ok(())
}

#[tauri::command]
pub async fn mcp_oauth_status(id: String) -> Result<bool, String> {
    oauth::has_tokens(&id).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validation_requires_command_or_url_by_transport() {
        let stdio = McpServerConfig {
            id: "a".to_string(),
            name: "A".to_string(),
            ..Default::default()
        };
        assert!(validate_server(&stdio).is_err());
        let stdio = McpServerConfig {
            command: "npx".to_string(),
            ..stdio
        };
        assert!(validate_server(&stdio).is_ok());

        let http = McpServerConfig {
            transport: McpTransport::Http,
            url: Some("https://mcp.example.com/mcp".to_string()),
            ..Default::default()
        };
        assert!(validate_server(&http).is_ok());
        let http = McpServerConfig {
            url: Some("file:///etc/passwd".to_string()),
            ..http
        };
        assert!(validate_server(&http).is_err());
    }

    #[test]
    fn legacy_configs_default_to_stdio() {
        let config: McpServerConfig =
            serde_json::from_str(r#"{"id":"a","name":"b","command":"c"}"#).unwrap();
        assert_eq!(config.transport, McpTransport::Stdio);
        let http: McpServerConfig = serde_json::from_str(
            r#"{"id":"a","name":"b","transport":"http","url":"https://x.dev/mcp","headers":{"X-Key":"1"}}"#,
        )
        .unwrap();
        assert_eq!(http.transport, McpTransport::Http);
        assert_eq!(http.headers.get("X-Key").map(String::as_str), Some("1"));
    }
}
