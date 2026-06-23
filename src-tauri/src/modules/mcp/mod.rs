pub mod client;
pub mod error;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const CONFIG_FILE: &str = "mcp.json";

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
struct McpConfigFile {
    servers: Vec<McpServerConfig>,
}

fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Failed to resolve app config dir: {e}"))?;
    Ok(dir.join(CONFIG_FILE))
}

#[tauri::command]
pub async fn mcp_load_config(app: AppHandle) -> Result<Vec<McpServerConfig>, String> {
    let path = config_path(&app)?;

    if !path.exists() {
        return Ok(Vec::new());
    }

    let content =
        std::fs::read_to_string(&path).map_err(|e| format!("Failed to read MCP config: {e}"))?;

    let file: McpConfigFile =
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse MCP config: {e}"))?;

    Ok(file.servers)
}

#[tauri::command]
pub async fn mcp_save_config(app: AppHandle, servers: Vec<McpServerConfig>) -> Result<(), String> {
    let path = config_path(&app)?;

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {e}"))?;
    }

    let file = McpConfigFile { servers };
    let content = serde_json::to_string_pretty(&file)
        .map_err(|e| format!("Failed to serialize MCP config: {e}"))?;

    std::fs::write(&path, content).map_err(|e| format!("Failed to write MCP config: {e}"))?;

    Ok(())
}
