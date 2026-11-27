//! Hands Pragma's MCP server to coding CLIs that run in a terminal pane, so they get the same
//! tools (child sessions, browser, extension tools) as Pragma chats get through ACP.

use std::path::{Path, PathBuf};

use serde_json::{json, Map, Value};
use tauri::{AppHandle, Manager, State};

use crate::ai::acp::types::McpServer;

use super::server::ChildSessionServer;

const MAX_SESSION_ID_LEN: usize = 128;

fn valid_session_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= MAX_SESSION_ID_LEN
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_'))
}

/// The server in the `mcpServers` format of Claude Code's `--mcp-config` file.
fn claude_mcp_config(server: &McpServer) -> Value {
    let env: Map<String, Value> = server
        .env
        .iter()
        .flatten()
        .map(|var| (var.name.clone(), Value::String(var.value.clone())))
        .collect();
    json!({
        "mcpServers": {
            server.name.clone(): {
                "type": "stdio",
                "command": server.command,
                "args": server.args.clone().unwrap_or_default(),
                "env": env,
            }
        }
    })
}

/// Writes the file only the user can read: it holds the token of the loopback server.
fn write_private(path: &Path, contents: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Cannot create {}: {e}", parent.display()))?;
    }
    #[cfg(unix)]
    {
        use std::io::Write;
        use std::os::unix::fs::OpenOptionsExt;
        let mut file = std::fs::OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .mode(0o600)
            .open(path)
            .map_err(|e| format!("Cannot write {}: {e}", path.display()))?;
        file.write_all(contents.as_bytes())
            .map_err(|e| format!("Cannot write {}: {e}", path.display()))
    }
    #[cfg(not(unix))]
    {
        std::fs::write(path, contents).map_err(|e| format!("Cannot write {}: {e}", path.display()))
    }
}

fn config_path(app: &AppHandle, session_id: &str) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("Cannot resolve app data dir: {e}"))?
        .join("mcp-sessions")
        .join(format!("{session_id}.json")))
}

/// Writes the MCP config for one terminal session and returns its path, for `claude --mcp-config`.
#[tauri::command]
pub async fn child_session_mcp_config(
    app: AppHandle,
    state: State<'_, ChildSessionServer>,
    chat_session_id: String,
) -> Result<String, String> {
    if !valid_session_id(&chat_session_id) {
        return Err("chat_session_id is invalid".to_string());
    }
    let server = state
        .mcp_server(&chat_session_id)
        .ok_or("Pragma's MCP server is not running")?;
    let path = config_path(&app, &chat_session_id)?;
    let contents = serde_json::to_string_pretty(&claude_mcp_config(&server))
        .map_err(|e| format!("Cannot encode the MCP config: {e}"))?;
    write_private(&path, &contents)?;
    Ok(path.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::acp::types::McpEnvVar;

    #[test]
    fn accepts_only_plain_session_ids() {
        assert!(valid_session_id("5fb246c9-6f7a-4592-845f-58932a0dbcca"));
        assert!(!valid_session_id(""));
        assert!(!valid_session_id("../escape"));
        assert!(!valid_session_id(&"a".repeat(129)));
    }

    #[test]
    fn writes_claude_code_mcp_servers_with_env() {
        let server = McpServer {
            name: "pragma".to_string(),
            type_: None,
            command: Some("/Applications/Pragma.app/Contents/MacOS/app".to_string()),
            args: Some(vec!["--pragma-child-sessions-mcp".to_string()]),
            url: None,
            headers: None,
            env: Some(vec![McpEnvVar {
                name: "PRAGMA_CHILD_SESSIONS_PORT".to_string(),
                value: "4242".to_string(),
            }]),
        };
        let config = claude_mcp_config(&server);
        let pragma = &config["mcpServers"]["pragma"];
        assert_eq!(pragma["type"], "stdio");
        assert_eq!(
            pragma["command"],
            "/Applications/Pragma.app/Contents/MacOS/app"
        );
        assert_eq!(pragma["args"][0], "--pragma-child-sessions-mcp");
        assert_eq!(pragma["env"]["PRAGMA_CHILD_SESSIONS_PORT"], "4242");
    }

    #[cfg(unix)]
    #[test]
    fn only_the_user_can_read_the_file() {
        use std::os::unix::fs::PermissionsExt;
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("sessions/a.json");
        write_private(&path, "{}").unwrap();
        let mode = std::fs::metadata(&path).unwrap().permissions().mode();
        assert_eq!(mode & 0o777, 0o600);
    }
}
