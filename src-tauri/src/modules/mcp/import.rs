//! Reads MCP servers from the workspace (`.mcp.json`, `.pragma/settings.json`), the configs of
//! the coding CLIs and Claude Desktop so they can be imported.

use crate::modules::mcp::cli_configs::{self, McpCli, UserConfigs};
use crate::modules::mcp::{McpServerConfig, McpTransport};
use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;
use std::path::{Path, PathBuf};

pub const MAX_CONFIG_BYTES: u64 = 1024 * 1024;
/// `~/.claude.json` also holds history and caches, so it may be much larger.
pub const MAX_CLAUDE_CONFIG_BYTES: u64 = 16 * 1024 * 1024;
const MAX_SERVERS: usize = 100;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct McpImportCandidate {
    /// Human readable origin, e.g. "Claude Desktop" or "~/.codex/config.toml".
    pub source: String,
    /// The coding CLI that reads this config, if any.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cli: Option<McpCli>,
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
    let kind = match entry.get("type").and_then(Value::as_str) {
        Some(kind) => kind,
        // Gemini names a streamable HTTP endpoint `httpUrl`; Cursor leaves out the type.
        None if entry.get("httpUrl").is_some() => "http",
        None if entry.get("command").is_none() && entry.get("url").is_some() => "http",
        None => "stdio",
    };
    let mut server = McpServerConfig {
        name: name.to_string(),
        ..Default::default()
    };
    match kind {
        "http" | "streamable-http" | "streamableHttp" => {
            server.transport = McpTransport::Http;
            let url = entry.get("httpUrl").or_else(|| entry.get("url"))?;
            server.url = Some(url.as_str()?.to_string());
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

fn read_text(path: &Path, max_bytes: u64) -> Option<String> {
    let metadata = std::fs::metadata(path).ok()?;
    if !metadata.is_file() || metadata.len() > max_bytes {
        return None;
    }
    std::fs::read_to_string(path).ok()
}

pub fn read_document(path: &Path, max_bytes: u64) -> Option<Value> {
    serde_json::from_str(&read_text(path, max_bytes)?).ok()
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

fn tag(
    servers: Vec<McpServerConfig>,
    source: &str,
    cli: Option<McpCli>,
) -> Vec<McpImportCandidate> {
    servers
        .into_iter()
        .map(|server| McpImportCandidate {
            source: source.to_string(),
            cli,
            server,
        })
        .collect()
}

fn candidates_from(path: &Path, source: &str, cli: Option<McpCli>) -> Vec<McpImportCandidate> {
    let servers = read_document(path, MAX_CONFIG_BYTES)
        .map(|document| parse_mcp_servers(&document))
        .unwrap_or_default();
    tag(servers, source, cli)
}

fn codex_candidates(path: &Path, source: &str) -> Vec<McpImportCandidate> {
    let servers = read_text(path, MAX_CONFIG_BYTES)
        .map(|content| cli_configs::parse_codex_servers(&content))
        .unwrap_or_default();
    tag(servers, source, Some(McpCli::Codex))
}

/// User-wide servers and the ones Claude Code keeps for `root` in `~/.claude.json`.
fn claude_candidates(configs: &UserConfigs, root: Option<&Path>) -> Vec<McpImportCandidate> {
    let Some(document) = read_document(&configs.claude, MAX_CLAUDE_CONFIG_BYTES) else {
        return Vec::new();
    };
    let source = configs.display(McpCli::Claude);
    let mut candidates = tag(parse_mcp_servers(&document), &source, Some(McpCli::Claude));
    if let Some(local) = root.and_then(|root| cli_configs::claude_local_servers(&document, root)) {
        candidates.extend(tag(
            parse_mcp_servers(&local),
            &format!("{source}, this folder"),
            Some(McpCli::Claude),
        ));
    }
    candidates
}

fn workspace_candidates(root: &Path) -> Vec<McpImportCandidate> {
    let mut candidates =
        candidates_from(&root.join(".mcp.json"), ".mcp.json", Some(McpCli::Claude));
    candidates.extend(candidates_from(
        &root.join(".pragma").join("settings.json"),
        ".pragma/settings.json",
        None,
    ));
    candidates.extend(codex_candidates(
        &root.join(".codex").join("config.toml"),
        ".codex/config.toml",
    ));
    candidates.extend(candidates_from(
        &root.join(".gemini").join("settings.json"),
        ".gemini/settings.json",
        Some(McpCli::Gemini),
    ));
    candidates.extend(candidates_from(
        &root.join(".cursor").join("mcp.json"),
        ".cursor/mcp.json",
        Some(McpCli::Cursor),
    ));
    candidates
}

fn user_candidates(configs: &UserConfigs, root: Option<&Path>) -> Vec<McpImportCandidate> {
    let mut candidates = claude_candidates(configs, root);
    candidates.extend(codex_candidates(
        &configs.codex,
        &configs.display(McpCli::Codex),
    ));
    for cli in [McpCli::Gemini, McpCli::Cursor] {
        candidates.extend(candidates_from(
            configs.path(cli),
            &configs.display(cli),
            Some(cli),
        ));
    }
    candidates
}

#[tauri::command]
pub async fn mcp_import_candidates(
    workspace_root: Option<String>,
) -> Result<Vec<McpImportCandidate>, String> {
    let root = workspace_root
        .filter(|root| !root.is_empty())
        .map(PathBuf::from);
    if root.as_deref().is_some_and(|root| !root.is_dir()) {
        return Err("workspace_root is not a directory".to_string());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let mut candidates = root
            .as_deref()
            .map(workspace_candidates)
            .unwrap_or_default();
        if let Some(configs) = UserConfigs::from_env() {
            candidates.extend(user_candidates(&configs, root.as_deref()));
        }
        if let Some(path) = claude_desktop_config() {
            candidates.extend(candidates_from(&path, "Claude Desktop", None));
        }
        candidates
    })
    .await
    .map_err(|err| format!("Failed to read MCP configs: {err}"))
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
        assert!(candidates_from(Path::new("/nonexistent/.mcp.json"), "x", None).is_empty());
    }

    #[test]
    fn reads_a_workspace_file() {
        let tmp = tempfile::tempdir().unwrap();
        std::fs::write(
            tmp.path().join(".mcp.json"),
            r#"{"mcpServers":{"fs":{"command":"node","args":["fs.js"]}}}"#,
        )
        .unwrap();
        let candidates = workspace_candidates(tmp.path());
        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].source, ".mcp.json");
        assert_eq!(candidates[0].cli, Some(McpCli::Claude));
        assert_eq!(candidates[0].server.command, "node");
    }

    #[test]
    fn reads_gemini_and_cursor_remote_servers() {
        let document = json!({
            "mcpServers": {
                "gemini-http": { "httpUrl": "https://example.com/mcp" },
                "cursor-remote": { "url": "https://example.com/cursor" },
                "local": { "command": "node", "url": "ignored" }
            }
        });
        let servers = parse_mcp_servers(&document);
        assert_eq!(servers.len(), 3);
        assert_eq!(servers[0].name, "cursor-remote");
        assert_eq!(servers[0].transport, McpTransport::Http);
        assert_eq!(servers[1].name, "gemini-http");
        assert_eq!(servers[1].url.as_deref(), Some("https://example.com/mcp"));
        assert_eq!(servers[2].transport, McpTransport::Stdio);
    }

    #[test]
    fn reads_the_cli_configs_of_a_home_folder() {
        let home = tempfile::tempdir().unwrap();
        let root = Path::new("/work/app");
        std::fs::write(
            home.path().join(".claude.json"),
            r#"{"mcpServers":{"gh":{"type":"http","url":"https://gh"}},"projects":{"/work/app":{"mcpServers":{"db":{"command":"pg"}}}}}"#,
        )
        .unwrap();
        std::fs::create_dir_all(home.path().join(".codex")).unwrap();
        std::fs::write(
            home.path().join(".codex").join("config.toml"),
            "[mcp_servers.docs]\ncommand = \"docs\"\n",
        )
        .unwrap();
        let candidates = user_candidates(&UserConfigs::in_home(home.path()), Some(root));
        let found: Vec<(&str, &str)> = candidates
            .iter()
            .map(|c| (c.server.name.as_str(), c.source.as_str()))
            .collect();
        assert!(found.contains(&("gh", "~/.claude.json")));
        assert!(found.contains(&("db", "~/.claude.json, this folder")));
        assert!(found.contains(&("docs", "~/.codex/config.toml")));
    }
}
