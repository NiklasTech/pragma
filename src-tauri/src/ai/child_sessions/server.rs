use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Emitter, State};
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{oneshot, Mutex};
use tokio::time::timeout;

use crate::ai::acp::types::{McpEnvVar, McpServer};

use super::protocol::{
    BridgeRequest, SpawnReply, BROWSER_TOOL_NAME, EXTENSION_TOOL_PREFIX, LIST_EXTENSION_TOOLS,
    MAX_LINE_BYTES, PORT_ENV, SESSION_ENV, TOKEN_ENV, TOOL_NAME,
};
use super::BRIDGE_FLAG;

const SPAWN_REQUEST_EVENT: &str = "child_session_spawn_request";
const BROWSER_REQUEST_EVENT: &str = "browser_open_request";
const EXTENSION_TOOL_EVENT: &str = "extension_tool_request";
const MAX_EXTENSION_TOOLS: usize = 200;
const MAX_TOOL_DEFINITION_BYTES: usize = 20 * 1024;
const READ_TIMEOUT: Duration = Duration::from_secs(10);
// The user decides in the approval card, so the answer can take a while.
const REPLY_TIMEOUT: Duration = Duration::from_secs(15 * 60);
const MAX_REPLY_BYTES: usize = 64 * 1024;
const MAX_ID_LEN: usize = 128;

type Pending = Arc<Mutex<HashMap<String, oneshot::Sender<SpawnReply>>>>;
/// MCP tool definitions of extension tools, per window that registered them.
type ExtensionTools = Arc<std::sync::Mutex<HashMap<String, Vec<Value>>>>;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SpawnRequestEvent {
    request_id: String,
    chat_session_id: String,
    arguments: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    tool: Option<String>,
}

pub struct ChildSessionServer {
    port: Option<u16>,
    token: String,
    pending: Pending,
    extension_tools: ExtensionTools,
}

impl ChildSessionServer {
    /// Binds a loopback port; without one, ACP sessions simply get no spawn tool.
    pub async fn start(app: AppHandle) -> Self {
        let token = uuid::Uuid::new_v4().simple().to_string();
        let pending: Pending = Arc::new(Mutex::new(HashMap::new()));
        let extension_tools: ExtensionTools = Arc::new(std::sync::Mutex::new(HashMap::new()));

        let listener = match TcpListener::bind(("127.0.0.1", 0)).await {
            Ok(listener) => listener,
            Err(e) => {
                log::error!("failed to bind the child session server: {e}");
                return Self {
                    port: None,
                    token,
                    pending,
                    extension_tools,
                };
            }
        };
        let port = listener.local_addr().ok().map(|addr| addr.port());

        let accept_token = token.clone();
        let accept_pending = pending.clone();
        let accept_tools = extension_tools.clone();
        tauri::async_runtime::spawn(async move {
            loop {
                let stream = match listener.accept().await {
                    Ok((stream, _)) => stream,
                    Err(e) => {
                        log::warn!("child session server accept failed: {e}");
                        tokio::time::sleep(Duration::from_millis(100)).await;
                        continue;
                    }
                };
                let app = app.clone();
                let token = accept_token.clone();
                let pending = accept_pending.clone();
                let tools = accept_tools.clone();
                tauri::async_runtime::spawn(async move {
                    if let Err(e) = handle_connection(app, token, pending, tools, stream).await {
                        log::warn!("child session request failed: {e}");
                    }
                });
            }
        });

        Self {
            port,
            token,
            pending,
            extension_tools,
        }
    }

    /// The MCP server entry an ACP session gets so its agent can start children.
    pub fn mcp_server(&self, chat_session_id: &str) -> Option<McpServer> {
        let port = self.port?;
        let exe = std::env::current_exe().ok()?;
        let env = |name: &str, value: String| McpEnvVar {
            name: name.to_string(),
            value,
        };
        Some(McpServer {
            name: "pragma".to_string(),
            type_: None,
            command: Some(exe.to_string_lossy().to_string()),
            args: Some(vec![BRIDGE_FLAG.to_string()]),
            url: None,
            headers: None,
            env: Some(vec![
                env(PORT_ENV, port.to_string()),
                env(TOKEN_ENV, self.token.clone()),
                env(SESSION_ENV, chat_session_id.to_string()),
            ]),
        })
    }

    async fn reply(&self, request_id: &str, reply: SpawnReply) -> Result<(), String> {
        let sender = self.pending.lock().await.remove(request_id);
        match sender {
            Some(tx) => {
                let _ = tx.send(reply);
                Ok(())
            }
            None => Err(format!("no pending child session request {request_id}")),
        }
    }
}

async fn handle_connection(
    app: AppHandle,
    token: String,
    pending: Pending,
    tools: ExtensionTools,
    stream: TcpStream,
) -> Result<(), String> {
    let (read, mut write) = stream.into_split();
    let mut reader = BufReader::new(read.take(MAX_LINE_BYTES));
    let mut line = String::new();
    timeout(READ_TIMEOUT, reader.read_line(&mut line))
        .await
        .map_err(|_| "timed out reading the request".to_string())?
        .map_err(|e| format!("failed to read the request: {e}"))?;

    let reply = match serde_json::from_str::<BridgeRequest>(line.trim()) {
        Ok(req) if req.token != token => SpawnReply {
            ok: false,
            text: "The request was not authorized".to_string(),
        },
        Ok(req) if req.session_id.is_empty() || req.session_id.len() > MAX_ID_LEN => SpawnReply {
            ok: false,
            text: "The parent session id is invalid".to_string(),
        },
        Ok(req) if req.tool == LIST_EXTENSION_TOOLS => SpawnReply {
            ok: true,
            text: Value::Array(registered_tools(&tools)).to_string(),
        },
        Ok(req) => forward(&app, &pending, &tools, req).await,
        Err(e) => SpawnReply {
            ok: false,
            text: format!("The request was malformed: {e}"),
        },
    };

    let mut payload =
        serde_json::to_string(&reply).map_err(|e| format!("failed to encode the reply: {e}"))?;
    payload.push('\n');
    write
        .write_all(payload.as_bytes())
        .await
        .map_err(|e| format!("failed to write the reply: {e}"))
}

fn registered_tools(tools: &ExtensionTools) -> Vec<Value> {
    tools
        .lock()
        .map(|tools| tools.values().flatten().cloned().collect())
        .unwrap_or_default()
}

fn is_registered_tool(tools: &ExtensionTools, name: &str) -> bool {
    registered_tools(tools)
        .iter()
        .any(|tool| tool.get("name").and_then(Value::as_str) == Some(name))
}

async fn forward(
    app: &AppHandle,
    pending: &Pending,
    tools: &ExtensionTools,
    req: BridgeRequest,
) -> SpawnReply {
    let event_name = match req.tool.as_str() {
        TOOL_NAME => SPAWN_REQUEST_EVENT,
        BROWSER_TOOL_NAME => BROWSER_REQUEST_EVENT,
        name if name.starts_with(EXTENSION_TOOL_PREFIX) && is_registered_tool(tools, name) => {
            EXTENSION_TOOL_EVENT
        }
        other => {
            return SpawnReply {
                ok: false,
                text: format!("Unknown tool: {other}"),
            }
        }
    };
    let request_id = uuid::Uuid::new_v4().to_string();
    let (tx, rx) = oneshot::channel();
    pending.lock().await.insert(request_id.clone(), tx);

    let event = SpawnRequestEvent {
        request_id: request_id.clone(),
        chat_session_id: req.session_id,
        arguments: req.arguments,
        tool: (event_name == EXTENSION_TOOL_EVENT).then_some(req.tool),
    };
    if let Err(e) = app.emit(event_name, event) {
        pending.lock().await.remove(&request_id);
        return SpawnReply {
            ok: false,
            text: format!("Pragma could not ask the user: {e}"),
        };
    }

    match timeout(REPLY_TIMEOUT, rx).await {
        Ok(Ok(reply)) => reply,
        _ => {
            pending.lock().await.remove(&request_id);
            SpawnReply {
                ok: false,
                text: "Nobody answered the request".to_string(),
            }
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct SpawnReplyRequest {
    pub request_id: String,
    pub ok: bool,
    pub text: String,
}

#[tauri::command]
pub async fn child_session_spawn_reply(
    req: SpawnReplyRequest,
    state: State<'_, ChildSessionServer>,
) -> Result<(), String> {
    if req.request_id.is_empty() || req.request_id.len() > MAX_ID_LEN {
        return Err("request_id is invalid".to_string());
    }
    if req.text.len() > MAX_REPLY_BYTES {
        return Err("text is too long".to_string());
    }
    state
        .reply(
            &req.request_id,
            SpawnReply {
                ok: req.ok,
                text: req.text,
            },
        )
        .await
}

/// Checks one MCP tool definition an extension window registers.
fn validate_extension_tool(tool: &Value) -> Result<(), String> {
    let name = tool
        .get("name")
        .and_then(Value::as_str)
        .ok_or("tool name is required")?;
    let valid_name = name.len() <= 64
        && name.starts_with(EXTENSION_TOOL_PREFIX)
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '-'));
    if !valid_name {
        return Err(format!("invalid extension tool name: {name}"));
    }
    if tool.get("description").and_then(Value::as_str).is_none() {
        return Err(format!("tool {name} needs a description"));
    }
    if tool
        .get("inputSchema")
        .and_then(|schema| schema.get("type"))
        .and_then(Value::as_str)
        != Some("object")
    {
        return Err(format!("tool {name} needs an object input schema"));
    }
    if tool.to_string().len() > MAX_TOOL_DEFINITION_BYTES {
        return Err(format!("tool {name} is too large"));
    }
    Ok(())
}

/// Replaces the extension tools a window offers to coding CLIs.
#[tauri::command]
pub async fn extension_tools_sync(
    window: tauri::Window,
    tools: Vec<Value>,
    state: State<'_, ChildSessionServer>,
) -> Result<(), String> {
    if tools.len() > MAX_EXTENSION_TOOLS {
        return Err("too many extension tools".to_string());
    }
    for tool in &tools {
        validate_extension_tool(tool)?;
    }
    let mut registry = state
        .extension_tools
        .lock()
        .map_err(|_| "extension tool registry is unavailable".to_string())?;
    if tools.is_empty() {
        registry.remove(window.label());
    } else {
        registry.insert(window.label().to_string(), tools);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn extension_tools_need_a_prefixed_name_and_object_schema() {
        let valid = json!({
            "name": "ext__word-count__count",
            "description": "Counts words",
            "inputSchema": { "type": "object" },
        });
        assert!(validate_extension_tool(&valid).is_ok());

        let mut unprefixed = valid.clone();
        unprefixed["name"] = json!("count");
        assert!(validate_extension_tool(&unprefixed).is_err());

        let mut no_schema = valid.clone();
        no_schema["inputSchema"] = json!({ "type": "string" });
        assert!(validate_extension_tool(&no_schema).is_err());
    }

    #[test]
    fn registry_lists_tools_of_all_windows() {
        let tools: ExtensionTools = Arc::new(std::sync::Mutex::new(HashMap::new()));
        tools
            .lock()
            .unwrap()
            .insert("main".to_string(), vec![json!({ "name": "ext__a__one" })]);
        tools.lock().unwrap().insert(
            "workspace-1".to_string(),
            vec![json!({ "name": "ext__b__two" })],
        );
        assert_eq!(registered_tools(&tools).len(), 2);
        assert!(is_registered_tool(&tools, "ext__b__two"));
        assert!(!is_registered_tool(&tools, "ext__c__three"));
    }
}
