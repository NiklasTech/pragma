//! Reads MCP servers from a workspace `.mcp.json` or `.pragma/settings.json` and the
//! Claude Desktop configuration so they can be imported.

use crate::modules::mcp::{McpServerConfig, McpTransport};
use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;
use std::path::{Path, PathBuf};

const MAX_CONFIG_BYTES: u64 = 1024 * 1024;
const MAX_SERVERS: usize = 100;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct McpImportCandidate {
    /// Human readable origin, e.g. "Claude Desktop".
    pub source: String,
    /// The server with its plain env and header values; the frontend moves secrets to the keychain.
    pub server: McpServerConfig,
}

fn string_map(value: Option<&Value>) -> HashMap<String, String> {
    value
        .and_then(Value::as_object)
        .map(|object| {
            object
                .iter()
                .filter_map(|(key, value)| Some((key.clone(), value.as_str()?.to_string())))
                .collect()
        })
        .unwrap_or_default()
}

fn parse_server(name: &str, entry: &Value) -> Option<McpServerConfig> {
    let kind = entry.get("type").and_then(Value::as_str).unwrap_or("stdio");
    let mut server = McpServerConfig {
        name: name.to_string(),
        ..Default::default()
    };
    match kind {
        "http" | "streamable-http" | "streamableHttp" => {
            server.transport = McpTransport::Http;
            server.url = Some(entry.get("url")?.as_str()?.to_string());
            server.headers = string_map(entry.get("headers"));
        }
        // The legacy SSE transport is not supported.
        "sse" => return None,
        _ => {
            server.command = entry.get("command")?.as_str()?.to_string();
            server.args = entry
                .get("args")
                .and_then(Value::as_array)
                .map(|args| {
                    args.iter()
                        .filter_map(Value::as_str)
                        .map(str::to_string)
                        .collect()
                })
                .unwrap_or_default();
            server.env = string_map(entry.get("env"));
        }
    }
    Some(server)
}

/// Servers under `mcpServers` of a Claude-style configuration document.
pub fn parse_mcp_servers(document: &Value) -> Vec<McpServerConfig> {
    let Some(servers) = document.get("mcpServers").and_then(Value::as_object) else {
        return Vec::new();
    };
    let mut parsed: Vec<McpServerConfig> = servers
        .iter()
        .filter_map(|(name, entry)| parse_server(name, entry))
        .collect();
    parsed.sort_by(|a, b| a.name.cmp(&b.name));
    parsed.truncate(MAX_SERVERS);
    parsed
}

fn read_document(path: &Path) -> Option<Value> {
    let metadata = std::fs::metadata(path).ok()?;
    if !metadata.is_file() || metadata.len() > MAX_CONFIG_BYTES {
        return None;
    }
    let content = std::fs::read_to_string(path).ok()?;
    serde_json::from_str(&content).ok()
}

fn claude_desktop_config() -> Option<PathBuf> {
    let relative = Path::new("Claude").join("claude_desktop_config.json");
    if cfg!(target_os = "macos") {
        let home = std::env::var_os("HOME")?;
        Some(
            PathBuf::from(home)
                .join("Library")
                .join("Application Support")
                .join(relative),
        )
    } else if cfg!(target_os = "windows") {
        Some(PathBuf::from(std::env::var_os("APPDATA")?).join(relative))
    } else {
        let config = std::env::var_os("XDG_CONFIG_HOME")
            .map(PathBuf::from)
            .or_else(|| std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".config")))?;
        Some(config.join(relative))
    }
}

fn candidates_from(path: &Path, source: &str) -> Vec<McpImportCandidate> {
    read_document(path)
        .map(|document| parse_mcp_servers(&document))
        .unwrap_or_default()
        .into_iter()
        .map(|server| McpImportCandidate {
            source: source.to_string(),
            server,
        })
        .collect()
}

#[tauri::command]
pub async fn mcp_import_candidates(
    workspace_root: Option<String>,
) -> Result<Vec<McpImportCandidate>, String> {
    let mut candidates = Vec::new();
    if let Some(root) = workspace_root.filter(|root| !root.is_empty()) {
        let root = Path::new(&root);
        if !root.is_dir() {
            return Err("workspace_root is not a directory".to_string());
        }
        candidates.extend(candidates_from(&root.join(".mcp.json"), ".mcp.json"));
        candidates.extend(candidates_from(
            &root.join(".pragma").join("settings.json"),
            ".pragma/settings.json",
        ));
    }
    if let Some(path) = claude_desktop_config() {
        candidates.extend(candidates_from(&path, "Claude Desktop"));
    }
    Ok(candidates)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn parses_stdio_and_http_servers() {
        let document = json!({
            "mcpServers": {
                "github": {
                    "command": "npx",
                    "args": ["-y", "@modelcontextprotocol/server-github"],
                    "env": { "GITHUB_TOKEN": "ghp_x" }
                },
                "linear": {
                    "type": "http",
                    "url": "https://mcp.linear.app/mcp",
                    "headers": { "Authorization": "Bearer x" }
                },
                "legacy": { "type": "sse", "url": "https://example.com/sse" },
                "broken": { "args": [] }
            }
        });
        let servers = parse_mcp_servers(&document);
        assert_eq!(servers.len(), 2);
        assert_eq!(servers[0].name, "github");
        assert_eq!(servers[0].transport, McpTransport::Stdio);
        assert_eq!(servers[0].args.len(), 2);
        assert_eq!(servers[0].env["GITHUB_TOKEN"], "ghp_x");
        assert_eq!(servers[1].transport, McpTransport::Http);
        assert_eq!(
            servers[1].url.as_deref(),
            Some("https://mcp.linear.app/mcp")
        );
        assert_eq!(servers[1].headers["Authorization"], "Bearer x");
    }

    #[test]
    fn missing_or_invalid_documents_yield_nothing() {
        assert!(parse_mcp_servers(&json!({})).is_empty());
        assert!(parse_mcp_servers(&json!({ "mcpServers": [] })).is_empty());
        assert!(candidates_from(Path::new("/nonexistent/.mcp.json"), "x").is_empty());
    }

    #[test]
    fn reads_a_workspace_file() {
        let tmp = tempfile::tempdir().unwrap();
        std::fs::write(
            tmp.path().join(".mcp.json"),
            r#"{"mcpServers":{"fs":{"command":"node","args":["fs.js"]}}}"#,
        )
        .unwrap();
        let candidates = candidates_from(&tmp.path().join(".mcp.json"), ".mcp.json");
        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].source, ".mcp.json");
        assert_eq!(candidates[0].server.command, "node");
    }
}
