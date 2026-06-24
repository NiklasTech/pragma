pub mod client;
pub mod error;
pub mod manager;
pub mod tools;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::path::PathBuf;
use tauri::{AppHandle, Manager, State};

pub use manager::{McpManager, McpServerState, McpServerStatus};
pub use tools::{McpTool, McpToolCallResult};

const CONFIG_FILE: &str = "mcp.json";
const TOOLS_CACHE_FILE: &str = "mcp-tools-cache.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpServerConfig {
    pub id: String,
    pub name: String,
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub env: HashMap<String, String>,
    #[serde(default)]
    pub autostart: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct McpConfigFile {
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

pub async fn load_tools_cache(
    app: &AppHandle,
) -> Result<HashMap<String, Vec<McpTool>>, String> {
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

#[tauri::command]
pub async fn mcp_load_config(app: AppHandle) -> Result<Vec<McpServerConfig>, String> {
    let path = config_path(&app)?;

    if !path.exists() {
        return Ok(Vec::new());
    }

    let content = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("Failed to read MCP config: {e}"))?;

    let file: McpConfigFile =
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse MCP config: {e}"))?;

    Ok(file.servers)
}

#[tauri::command]
pub async fn mcp_save_config(app: AppHandle, servers: Vec<McpServerConfig>) -> Result<(), String> {
    let path = config_path(&app)?;

    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Failed to create config directory: {e}"))?;
    }

    let file = McpConfigFile { servers };
    let content = serde_json::to_string_pretty(&file)
        .map_err(|e| format!("Failed to serialize MCP config: {e}"))?;

    tokio::fs::write(&path, content)
        .await
        .map_err(|e| format!("Failed to write MCP config: {e}"))?;

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
