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
    BridgeRequest, SpawnReply, MAX_LINE_BYTES, PORT_ENV, SESSION_ENV, TOKEN_ENV,
};
use super::BRIDGE_FLAG;

const SPAWN_REQUEST_EVENT: &str = "child_session_spawn_request";
const READ_TIMEOUT: Duration = Duration::from_secs(10);
// The user decides in the approval card, so the answer can take a while.
const REPLY_TIMEOUT: Duration = Duration::from_secs(15 * 60);
const MAX_REPLY_BYTES: usize = 64 * 1024;
const MAX_ID_LEN: usize = 128;

type Pending = Arc<Mutex<HashMap<String, oneshot::Sender<SpawnReply>>>>;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SpawnRequestEvent {
    request_id: String,
    chat_session_id: String,
    arguments: Value,
}

pub struct ChildSessionServer {
    port: Option<u16>,
    token: String,
    pending: Pending,
}

impl ChildSessionServer {
    /// Binds a loopback port; without one, ACP sessions simply get no spawn tool.
    pub async fn start(app: AppHandle) -> Self {
        let token = uuid::Uuid::new_v4().simple().to_string();
        let pending: Pending = Arc::new(Mutex::new(HashMap::new()));

        let listener = match TcpListener::bind(("127.0.0.1", 0)).await {
            Ok(listener) => listener,
            Err(e) => {
                log::error!("failed to bind the child session server: {e}");
                return Self {
                    port: None,
                    token,
                    pending,
                };
            }
        };
        let port = listener.local_addr().ok().map(|addr| addr.port());

        let accept_token = token.clone();
        let accept_pending = pending.clone();
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
                tauri::async_runtime::spawn(async move {
                    if let Err(e) = handle_connection(app, token, pending, stream).await {
                        log::warn!("child session request failed: {e}");
                    }
                });
            }
        });

        Self {
            port,
            token,
            pending,
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
        Ok(req) => forward(&app, &pending, req).await,
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

async fn forward(app: &AppHandle, pending: &Pending, req: BridgeRequest) -> SpawnReply {
    let request_id = uuid::Uuid::new_v4().to_string();
    let (tx, rx) = oneshot::channel();
    pending.lock().await.insert(request_id.clone(), tx);

    let event = SpawnRequestEvent {
        request_id: request_id.clone(),
        chat_session_id: req.session_id,
        arguments: req.arguments,
    };
    if let Err(e) = app.emit(SPAWN_REQUEST_EVENT, event) {
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
                text: "Nobody answered the request to start a child session".to_string(),
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
