//! Where the coding CLIs keep their MCP servers and how to read the formats that are not
//! Claude-style `mcpServers` JSON.

use crate::modules::mcp::{McpServerConfig, McpTransport};
use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use toml_edit::{DocumentMut, Item, TableLike};

/// A coding CLI whose MCP servers Pragma reads.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum McpCli {
    Claude,
    Codex,
    Gemini,
    Cursor,
}

/// The user's home folder, `USERPROFILE` on Windows.
pub fn home_dir() -> Option<PathBuf> {
    let var = if cfg!(target_os = "windows") {
        "USERPROFILE"
    } else {
        "HOME"
    };
    std::env::var_os(var)
        .filter(|home| !home.is_empty())
        .map(PathBuf::from)
}

/// `~/.claude.json`, or the file in `CLAUDE_CONFIG_DIR`.
pub fn claude_config_path(home: &Path) -> PathBuf {
    let config_dir = std::env::var("CLAUDE_CONFIG_DIR").ok();
    crate::ai::subscription_usage::claude_config_path(config_dir.as_deref(), home)
}

/// `~/.codex`, or `CODEX_HOME`.
pub fn codex_home(home: &Path) -> PathBuf {
    std::env::var_os("CODEX_HOME")
        .filter(|dir| !dir.is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| home.join(".codex"))
}

/// Shows a path below the home folder as `~/...`.
pub fn display_path(path: &Path, home: Option<&Path>) -> String {
    if let Some(rest) = home.and_then(|home| path.strip_prefix(home).ok()) {
        return format!("~/{}", rest.to_string_lossy().replace('\\', "/"));
    }
    path.to_string_lossy().into_owned()
}

/// The `mcpServers` Claude Code keeps for one folder under `projects` in `~/.claude.json`.
pub fn claude_local_servers(document: &Value, root: &Path) -> Option<Value> {
    let projects = document.get("projects")?.as_object()?;
    let raw = root.to_string_lossy();
    let forward = raw.replace('\\', "/");
    let project = projects
        .get(raw.as_ref())
        .or_else(|| projects.get(&forward))?;
    let servers = project.get("mcpServers")?;
    Some(serde_json::json!({ "mcpServers": servers }))
}

fn toml_string(table: &dyn TableLike, key: &str) -> Option<String> {
    table.get(key)?.as_str().map(str::to_string)
}

fn toml_string_map(table: &dyn TableLike, key: &str) -> HashMap<String, String> {
    table
        .get(key)
        .and_then(Item::as_table_like)
        .map(|map| {
            map.iter()
                .filter_map(|(name, value)| Some((name.to_string(), value.as_str()?.to_string())))
                .collect()
        })
        .unwrap_or_default()
}

fn parse_codex_server(name: &str, entry: &dyn TableLike) -> Option<McpServerConfig> {
    let mut server = McpServerConfig {
        name: name.to_string(),
        ..Default::default()
    };
    if let Some(url) = toml_string(entry, "url") {
        server.transport = McpTransport::Http;
        server.url = Some(url);
        server.headers = toml_string_map(entry, "http_headers");
    } else {
        server.command = toml_string(entry, "command")?;
        server.args = entry
            .get("args")
            .and_then(Item::as_array)
            .map(|args| {
                args.iter()
                    .filter_map(|arg| arg.as_str().map(str::to_string))
                    .collect()
            })
            .unwrap_or_default();
        server.env = toml_string_map(entry, "env");
    }
    Some(server)
}

/// Servers under `[mcp_servers.<name>]` of a Codex `config.toml`.
pub fn parse_codex_servers(content: &str) -> Vec<McpServerConfig> {
    let Ok(document) = content.parse::<DocumentMut>() else {
        return Vec::new();
    };
    let Some(servers) = document.get("mcp_servers").and_then(Item::as_table_like) else {
        return Vec::new();
    };
    let mut parsed: Vec<McpServerConfig> = servers
        .iter()
        .filter_map(|(name, entry)| parse_codex_server(name, entry.as_table_like()?))
        .collect();
    parsed.sort_by(|a, b| a.name.cmp(&b.name));
    parsed
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn reads_codex_stdio_and_http_servers() {
        let servers = parse_codex_servers(
            r#"
model = "gpt-5"

[mcp_servers.linear]
url = "https://mcp.linear.app/mcp"
http_headers = { "X-Team" = "core" }

[mcp_servers.docs]
command = "npx"
args = ["-y", "docs-mcp"]
env = { DOCS_TOKEN = "t" }

[mcp_servers.broken]
args = []
"#,
        );
        assert_eq!(servers.len(), 2);
        assert_eq!(servers[0].name, "docs");
        assert_eq!(servers[0].transport, McpTransport::Stdio);
        assert_eq!(servers[0].args, vec!["-y", "docs-mcp"]);
        assert_eq!(servers[0].env["DOCS_TOKEN"], "t");
        assert_eq!(servers[1].transport, McpTransport::Http);
        assert_eq!(
            servers[1].url.as_deref(),
            Some("https://mcp.linear.app/mcp")
        );
        assert_eq!(servers[1].headers["X-Team"], "core");
    }

    #[test]
    fn invalid_codex_config_yields_nothing() {
        assert!(parse_codex_servers("not = [toml").is_empty());
        assert!(parse_codex_servers("model = \"x\"").is_empty());
    }

    #[test]
    fn finds_the_servers_of_one_claude_project() {
        let document = json!({
            "mcpServers": { "user": { "command": "a" } },
            "projects": {
                "/work/app": { "mcpServers": { "db": { "command": "pg" } } },
                "C:/work/win": { "mcpServers": { "win": { "command": "w" } } }
            }
        });
        let local = claude_local_servers(&document, Path::new("/work/app")).unwrap();
        assert_eq!(local["mcpServers"]["db"]["command"], "pg");
        assert!(claude_local_servers(&document, Path::new("/work/other")).is_none());
        assert!(claude_local_servers(&document, Path::new("C:\\work\\win")).is_some());
    }

    #[test]
    fn shortens_paths_below_home() {
        let home = Path::new("/home/me");
        assert_eq!(
            display_path(&home.join(".codex").join("config.toml"), Some(home)),
            "~/.codex/config.toml"
        );
        assert_eq!(
            display_path(Path::new("/etc/x.json"), Some(home)),
            "/etc/x.json"
        );
    }
}
