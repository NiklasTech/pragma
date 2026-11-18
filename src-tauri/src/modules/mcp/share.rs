//! Writes one of Pragma's MCP servers into the user-wide config of a coding CLI, so agents
//! that CLI starts can use it.

use crate::modules::mcp::cli_configs::{McpCli, UserConfigs};
use crate::modules::mcp::{secrets, McpManager, McpServerConfig, McpTransport};
use serde_json::{Map, Value};
use std::collections::HashMap;
use std::path::Path;
use tauri::State;
use toml_edit::{value, Array, DocumentMut, InlineTable, Item, Table};

/// `~/.claude.json` also holds history and caches.
const MAX_CONFIG_BYTES: u64 = 16 * 1024 * 1024;
const MAX_NAME_LEN: usize = 64;

/// What goes into the CLI config: the server with its secrets resolved when allowed.
struct SharedServer<'a> {
    name: &'a str,
    transport: McpTransport,
    command: &'a str,
    args: &'a [String],
    url: Option<&'a str>,
    env: HashMap<String, String>,
    headers: HashMap<String, String>,
}

fn validate_name(name: &str) -> Result<(), String> {
    let valid = !name.is_empty()
        && name.len() <= MAX_NAME_LEN
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'));
    if valid {
        Ok(())
    } else {
        Err(format!(
            "\"{name}\" cannot be shared: use letters, digits, '-', '_' or '.' (at most {MAX_NAME_LEN})"
        ))
    }
}

fn sorted(map: &HashMap<String, String>) -> Vec<(&String, &String)> {
    let mut entries: Vec<_> = map.iter().collect();
    entries.sort();
    entries
}

fn json_map(map: &HashMap<String, String>) -> Value {
    Value::Object(
        sorted(map)
            .into_iter()
            .map(|(key, val)| (key.clone(), Value::String(val.clone())))
            .collect(),
    )
}

/// The entry in the shape each CLI reads under `mcpServers`.
fn json_entry(cli: McpCli, server: &SharedServer) -> Value {
    let mut entry = Map::new();
    match server.transport {
        McpTransport::Stdio => {
            if cli == McpCli::Claude {
                entry.insert("type".into(), "stdio".into());
            }
            entry.insert("command".into(), server.command.into());
            entry.insert("args".into(), server.args.to_vec().into());
            if !server.env.is_empty() {
                entry.insert("env".into(), json_map(&server.env));
            }
        }
        McpTransport::Http => {
            let url = server.url.unwrap_or_default();
            match cli {
                McpCli::Claude => {
                    entry.insert("type".into(), "http".into());
                    entry.insert("url".into(), url.into());
                }
                McpCli::Gemini => {
                    entry.insert("httpUrl".into(), url.into());
                }
                McpCli::Cursor | McpCli::Codex => {
                    entry.insert("url".into(), url.into());
                }
            }
            if !server.headers.is_empty() {
                entry.insert("headers".into(), json_map(&server.headers));
            }
        }
    }
    Value::Object(entry)
}

/// Adds the server under `mcpServers` of a JSON config and keeps every other key as it was.
fn share_json(content: Option<&str>, cli: McpCli, server: &SharedServer) -> Result<String, String> {
    let mut document = match content.filter(|text| !text.trim().is_empty()) {
        Some(text) => serde_json::from_str::<Value>(text)
            .map_err(|err| format!("the config is not valid JSON ({err}); fix it first"))?,
        None => Value::Object(Map::new()),
    };
    let root = document
        .as_object_mut()
        .ok_or("the config is not a JSON object")?;
    let servers = root
        .entry("mcpServers")
        .or_insert_with(|| Value::Object(Map::new()))
        .as_object_mut()
        .ok_or("mcpServers in the config is not an object")?;
    if servers.contains_key(server.name) {
        return Err(format!("it already lists a server named {}", server.name));
    }
    servers.insert(server.name.to_string(), json_entry(cli, server));
    let mut text = serde_json::to_string_pretty(&document).map_err(|err| err.to_string())?;
    if content.is_some_and(|text| text.ends_with('\n')) {
        text.push('\n');
    }
    Ok(text)
}

fn inline_table(map: &HashMap<String, String>) -> InlineTable {
    let mut table = InlineTable::new();
    for (key, val) in sorted(map) {
        table.insert(key, val.as_str().into());
    }
    table
}

/// Adds `[mcp_servers.<name>]` to a Codex `config.toml`, keeping its comments and layout.
fn share_toml(content: Option<&str>, server: &SharedServer) -> Result<String, String> {
    let mut document = content
        .unwrap_or_default()
        .parse::<DocumentMut>()
        .map_err(|err| format!("the config is not valid TOML ({err}); fix it first"))?;
    let servers = document
        .entry("mcp_servers")
        .or_insert_with(|| {
            let mut table = Table::new();
            table.set_implicit(true);
            Item::Table(table)
        })
        .as_table_mut()
        .ok_or("mcp_servers in the config is not a table")?;
    if servers.contains_key(server.name) {
        return Err(format!("it already lists a server named {}", server.name));
    }
    let mut entry = Table::new();
    match server.transport {
        McpTransport::Stdio => {
            entry.insert("command", value(server.command));
            entry.insert("args", value(server.args.iter().collect::<Array>()));
            if !server.env.is_empty() {
                entry.insert("env", value(inline_table(&server.env)));
            }
        }
        McpTransport::Http => {
            entry.insert("url", value(server.url.unwrap_or_default()));
            if !server.headers.is_empty() {
                entry.insert("http_headers", value(inline_table(&server.headers)));
            }
        }
    }
    servers.insert(server.name, Item::Table(entry));
    Ok(document.to_string())
}

/// Writes next to the file and renames it over, so a CLI never reads half a config.
fn write_atomically(path: &Path, content: &str) -> Result<(), String> {
    let parent = path.parent().ok_or("the config path has no folder")?;
    std::fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    let file_name = path
        .file_name()
        .ok_or("the config path has no file name")?
        .to_string_lossy();
    let temp = parent.join(format!(".{file_name}.pragma-tmp"));
    std::fs::write(&temp, content).map_err(|err| err.to_string())?;
    if let Ok(metadata) = std::fs::metadata(path) {
        let _ = std::fs::set_permissions(&temp, metadata.permissions());
    }
    std::fs::rename(&temp, path).map_err(|err| {
        let _ = std::fs::remove_file(&temp);
        err.to_string()
    })
}

fn read_existing(path: &Path) -> Result<Option<String>, String> {
    match std::fs::metadata(path) {
        Ok(metadata) if !metadata.is_file() => Err("the config path is not a file".to_string()),
        Ok(metadata) if metadata.len() > MAX_CONFIG_BYTES => {
            Err("the config is too large to edit".to_string())
        }
        Ok(_) => std::fs::read_to_string(path)
            .map(Some)
            .map_err(|err| err.to_string()),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(err) => Err(err.to_string()),
    }
}

fn share_into(path: &Path, cli: McpCli, server: &SharedServer) -> Result<(), String> {
    let existing = read_existing(path)?;
    let updated = match cli {
        McpCli::Codex => share_toml(existing.as_deref(), server)?,
        McpCli::Claude | McpCli::Gemini | McpCli::Cursor => {
            share_json(existing.as_deref(), cli, server)?
        }
    };
    write_atomically(path, &updated)
}

fn shared_server(
    config: &McpServerConfig,
    include_secrets: bool,
) -> Result<SharedServer<'_>, String> {
    validate_name(&config.name)?;
    let has_secrets = !config.secret_env.is_empty() || !config.secret_headers.is_empty();
    if has_secrets && !include_secrets {
        return Err(format!(
            "{} has secrets; confirm to write them into the config",
            config.name
        ));
    }
    let (env, headers) = if include_secrets {
        (
            secrets::resolve_env(config).map_err(|err| err.to_string())?,
            secrets::resolve_headers(config).map_err(|err| err.to_string())?,
        )
    } else {
        (config.env.clone(), config.headers.clone())
    };
    match config.transport {
        McpTransport::Stdio if config.command.trim().is_empty() => {
            return Err(format!("{} has no command", config.name));
        }
        McpTransport::Http
            if !config
                .url
                .as_deref()
                .is_some_and(|url| url.starts_with("https://") || url.starts_with("http://")) =>
        {
            return Err(format!("{} has no http(s) URL", config.name));
        }
        _ => {}
    }
    Ok(SharedServer {
        name: &config.name,
        transport: config.transport,
        command: &config.command,
        args: &config.args,
        url: config.url.as_deref(),
        env,
        headers,
    })
}

/// Adds a Pragma server to the user-wide config of `cli`; returns that file as `~/...`.
/// Secrets go in only with `include_secrets`, after the user agreed to plain text there.
#[tauri::command]
pub async fn mcp_share_server(
    state: State<'_, McpManager>,
    id: String,
    cli: McpCli,
    include_secrets: bool,
) -> Result<String, String> {
    let config = state
        .config_for(&id)
        .await
        .ok_or_else(|| format!("MCP server not found: {id}"))?;
    let configs = UserConfigs::from_env().ok_or("the home folder is unknown")?;
    tauri::async_runtime::spawn_blocking(move || {
        let server = shared_server(&config, include_secrets)?;
        share_into(configs.path(cli), cli, &server)
            .map_err(|err| format!("Could not share with {}: {err}", configs.display(cli)))?;
        Ok(configs.display(cli))
    })
    .await
    .map_err(|err| err.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    fn stdio(name: &str) -> McpServerConfig {
        McpServerConfig {
            id: "s1".to_string(),
            name: name.to_string(),
            command: "npx".to_string(),
            args: vec!["-y".to_string(), "docs-mcp".to_string()],
            env: HashMap::from([("MODE".to_string(), "fast".to_string())]),
            ..Default::default()
        }
    }

    fn http(name: &str) -> McpServerConfig {
        McpServerConfig {
            id: "s2".to_string(),
            name: name.to_string(),
            transport: McpTransport::Http,
            url: Some("https://mcp.linear.app/mcp".to_string()),
            ..Default::default()
        }
    }

    #[test]
    fn adds_to_a_claude_config_and_keeps_its_keys_in_order() {
        let config = stdio("docs");
        let server = shared_server(&config, false).unwrap();
        let before = "{\n  \"numStartups\": 3,\n  \"autoUpdates\": true\n}\n";
        let after = share_json(Some(before), McpCli::Claude, &server).unwrap();
        let document: Value = serde_json::from_str(&after).unwrap();
        let keys: Vec<&String> = document.as_object().unwrap().keys().collect();
        assert_eq!(keys, vec!["numStartups", "autoUpdates", "mcpServers"]);
        assert_eq!(document["mcpServers"]["docs"]["type"], "stdio");
        assert_eq!(document["mcpServers"]["docs"]["env"]["MODE"], "fast");
        assert!(after.ends_with("}\n"));
    }

    #[test]
    fn writes_each_clis_remote_shape() {
        let config = http("linear");
        let server = shared_server(&config, false).unwrap();
        let gemini: Value =
            serde_json::from_str(&share_json(None, McpCli::Gemini, &server).unwrap()).unwrap();
        assert_eq!(
            gemini["mcpServers"]["linear"]["httpUrl"],
            "https://mcp.linear.app/mcp"
        );
        let cursor: Value =
            serde_json::from_str(&share_json(None, McpCli::Cursor, &server).unwrap()).unwrap();
        assert!(cursor["mcpServers"]["linear"].get("type").is_none());
        let toml = share_toml(None, &server).unwrap();
        assert!(toml.contains("[mcp_servers.linear]"));
        assert!(toml.contains("url = \"https://mcp.linear.app/mcp\""));
    }

    #[test]
    fn adds_to_codex_and_keeps_comments() {
        let config = stdio("docs");
        let server = shared_server(&config, false).unwrap();
        let before = "# my settings\nmodel = \"gpt-5\"\n\n[mcp_servers.other]\ncommand = \"x\"\n";
        let after = share_toml(Some(before), &server).unwrap();
        assert!(after.starts_with("# my settings\nmodel = \"gpt-5\"\n"));
        assert!(after.contains("[mcp_servers.other]"));
        assert!(
            after.contains("[mcp_servers.docs]\ncommand = \"npx\"\nargs = [\"-y\", \"docs-mcp\"]")
        );
        assert!(after.contains("env = { MODE = \"fast\" }"));
    }

    #[test]
    fn refuses_taken_names_broken_files_and_unconfirmed_secrets() {
        let config = stdio("docs");
        let server = shared_server(&config, false).unwrap();
        let taken = "{\"mcpServers\":{\"docs\":{\"command\":\"a\"}}}";
        assert!(share_json(Some(taken), McpCli::Claude, &server)
            .unwrap_err()
            .contains("already lists"));
        assert!(share_json(Some("{ not json"), McpCli::Claude, &server).is_err());
        assert!(share_toml(Some("[mcp_servers.docs]\ncommand = \"a\"\n"), &server).is_err());
        assert!(share_toml(Some("model = ["), &server).is_err());

        let mut secret = stdio("docs");
        secret.secret_env = vec!["API_KEY".to_string()];
        assert!(shared_server(&secret, false)
            .err()
            .is_some_and(|err| err.contains("has secrets")));
        assert!(shared_server(&stdio("bad name"), false).is_err());
    }

    #[test]
    fn writes_the_file_in_place() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join(".cursor").join("mcp.json");
        let config = stdio("docs");
        let server = shared_server(&config, false).unwrap();
        share_into(&path, McpCli::Cursor, &server).unwrap();
        let written: Value =
            serde_json::from_str(&std::fs::read_to_string(&path).unwrap()).unwrap();
        assert_eq!(written["mcpServers"]["docs"]["command"], "npx");
        let leftovers: Vec<_> = std::fs::read_dir(path.parent().unwrap())
            .unwrap()
            .filter_map(Result::ok)
            .filter(|entry| entry.file_name().to_string_lossy().ends_with(".pragma-tmp"))
            .collect();
        assert!(leftovers.is_empty());
    }
}
