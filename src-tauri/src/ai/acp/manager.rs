use std::collections::HashMap;
use std::sync::Arc;

use serde_json::Value;
use tauri::{AppHandle, Manager};
use tokio::process::Child;
use tokio::sync::{mpsc, Mutex};
use tokio::task::JoinHandle;

use super::approval_bridge::ApprovalBridge;
use super::client::{AcpClient, AcpClientConfig, Notification, ReverseRpcRequest};
use super::error::{AcpError, Result};
use super::fs_bridge::handle_fs_request;
use super::mcp_bridge::configs_to_acp_servers;
use super::types::{
    ClientCapabilities, FsCapabilities, InitializeRequest, NewSessionRequest, PromptContent,
    PromptRequest, SessionUpdate, SessionUpdatePayload,
};
use crate::ai::cli::{enriched_path, get_manifest};
use crate::commands::ai::StreamChunk;

const ACP_PROTOCOL_VERSION: &str = "0.23.0";

pub struct AcpSession {
    client: AcpClient,
    _child: Child,
    #[allow(dead_code)]
    cwd: String,
    acp_session_id: String,
    current_chunk_tx: Arc<Mutex<Option<mpsc::Sender<StreamChunk>>>>,
    _notification_handle: JoinHandle<()>,
    _reverse_rpc_handle: JoinHandle<()>,
}

pub struct AcpSessionManager {
    app_handle: AppHandle,
    approval_bridge: ApprovalBridge,
    sessions: Mutex<HashMap<String, AcpSession>>,
}

impl AcpSessionManager {
    pub fn new(app_handle: AppHandle) -> Self {
        let approval_bridge = ApprovalBridge::new(app_handle.clone());
        Self {
            app_handle,
            approval_bridge,
            sessions: Mutex::new(HashMap::new()),
        }
    }

    pub async fn has_session(&self, chat_session_id: &str) -> bool {
        let sessions = self.sessions.lock().await;
        sessions.contains_key(chat_session_id)
    }

    pub async fn start_session(
        &self,
        provider_id: &str,
        cwd: &str,
        chat_session_id: &str,
    ) -> Result<String> {
        let manifest = get_manifest(provider_id)
            .ok_or_else(|| AcpError::Spawn(format!("unknown provider: {provider_id}")))?;

        let mut cmd_parts = shellwords::split(&manifest.chat_cmd)
            .map_err(|e| AcpError::Spawn(format!("invalid chat command: {e}")))?;
        if cmd_parts.is_empty() {
            return Err(AcpError::Spawn("empty chat command".to_string()));
        }

        let mut env = std::collections::HashMap::new();
        env.insert("PATH".to_string(), enriched_path());
        for (key, value) in std::env::vars() {
            env.insert(key, value);
        }
        if let Some(manifest_env) = &manifest.env {
            for (key, value) in manifest_env {
                env.insert(key.clone(), value.clone());
            }
        }

        let config = AcpClientConfig {
            command: cmd_parts.remove(0),
            args: cmd_parts,
            env,
            request_timeout_ms: None,
        };

        let (client, child, notifications, reverse_requests) = AcpClient::start(config).await?;

        let init_response = client
            .request(
                "initialize",
                Some(serde_json::to_value(InitializeRequest {
                    protocol_version: ACP_PROTOCOL_VERSION.to_string(),
                    client_capabilities: ClientCapabilities {
                        fs: Some(FsCapabilities {
                            read_text_file: true,
                            write_text_file: true,
                        }),
                        ..Default::default()
                    },
                })?),
                Default::default(),
            )
            .await?;

        log::info!(
            "acp: initialized with agent {}",
            init_response
                .get("agentInfo")
                .and_then(|v| v.get("name"))
                .and_then(|v| v.as_str())
                .unwrap_or("unknown")
        );

        let mcp_servers = self.load_mcp_servers().await;
        let new_session_req = NewSessionRequest {
            cwd: cwd.to_string(),
            mcp_servers: Some(mcp_servers),
        };

        let new_session_resp = client
            .request(
                "session/new",
                Some(serde_json::to_value(new_session_req)?),
                Default::default(),
            )
            .await?;

        let acp_session_id = new_session_resp
            .get("sessionId")
            .and_then(|v| v.as_str())
            .ok_or_else(|| {
                AcpError::Protocol("missing sessionId in session/new response".to_string())
            })?
            .to_string();

        let cwd = cwd.to_string();
        let current_chunk_tx: Arc<Mutex<Option<mpsc::Sender<StreamChunk>>>> =
            Arc::new(Mutex::new(None));

        let notification_handle = spawn_notification_handler(
            current_chunk_tx.clone(),
            acp_session_id.clone(),
            notifications,
        );

        let reverse_rpc_handle = spawn_reverse_rpc_handler(
            self.approval_bridge.clone(),
            cwd.clone(),
            reverse_requests,
        );

        let session = AcpSession {
            client,
            _child: child,
            cwd,
            acp_session_id: acp_session_id.clone(),
            current_chunk_tx,
            _notification_handle: notification_handle,
            _reverse_rpc_handle: reverse_rpc_handle,
        };

        {
            let mut sessions = self.sessions.lock().await;
            sessions.insert(chat_session_id.to_string(), session);
        }

        Ok(acp_session_id)
    }

    pub async fn send_prompt(
        &self,
        chat_session_id: &str,
        messages: Vec<PromptContent>,
    ) -> Result<mpsc::Receiver<StreamChunk>> {
        let (tx, rx) = mpsc::channel::<StreamChunk>(32);

        let mut sessions = self.sessions.lock().await;
        let session = sessions
            .get_mut(chat_session_id)
            .ok_or_else(|| AcpError::Protocol(format!("no ACP session for {chat_session_id}")))?;

        *session.current_chunk_tx.lock().await = Some(tx.clone());

        let req = PromptRequest {
            session_id: session.acp_session_id.clone(),
            prompt: messages,
        };

        let client = session.client.clone();

        tokio::spawn(async move {
            if let Err(e) = client
                .request(
                    "session/prompt",
                    Some(serde_json::to_value(req).unwrap_or(Value::Null)),
                    Default::default(),
                )
                .await
            {
                let _ = tx
                    .send(StreamChunk {
                        text: None,
                        error: Some(e.to_string()),
                        done: true,
                        tool_calls: None,
                        tool_results: None,
                    })
                    .await;
            }
        });

        Ok(rx)
    }

    pub async fn cancel(&self, chat_session_id: &str) -> Result<()> {
        let sessions = self.sessions.lock().await;
        let session = sessions
            .get(chat_session_id)
            .ok_or_else(|| AcpError::Protocol(format!("no ACP session for {chat_session_id}")))?;

        session
            .client
            .notify(
                "session/cancel",
                Some(serde_json::json!({ "sessionId": session.acp_session_id })),
            )
            .await
    }

    pub async fn approve(&self, tool_call_id: &str, approved: bool) -> Result<()> {
        self.approval_bridge.respond(tool_call_id, approved).await
    }

    async fn load_mcp_servers(&self) -> Vec<super::types::McpServer> {
        let configs = self
            .app_handle
            .state::<crate::modules::mcp::McpManager>()
            .list_servers()
            .await
            .into_iter()
            .map(|s| s.config)
            .collect();

        configs_to_acp_servers(configs)
    }
}

fn spawn_notification_handler(
    chunk_tx: Arc<Mutex<Option<mpsc::Sender<StreamChunk>>>>,
    acp_session_id: String,
    mut notifications: mpsc::UnboundedReceiver<Notification>,
) -> JoinHandle<()> {
    tokio::spawn(async move {
        while let Some(notification) = notifications.recv().await {
            if notification.method != "session/update" {
                continue;
            }

            let Some(params) = notification.params else { continue };
            let Ok(update) = serde_json::from_value::<SessionUpdate>(params) else {
                continue;
            };

            if update.session_id != acp_session_id {
                continue;
            }

            let chunk = session_update_to_chunk(update.payload);
            if let Some(tx) = chunk_tx.lock().await.as_ref() {
                let _ = tx.send(chunk).await;
            }
        }
    })
}

fn session_update_to_chunk(payload: SessionUpdatePayload) -> StreamChunk {
    match payload {
        SessionUpdatePayload::AgentMessageChunk { delta } => StreamChunk {
            text: Some(delta),
            error: None,
            done: false,
            tool_calls: None,
            tool_results: None,
        },
        SessionUpdatePayload::ThinkingDelta { delta } => StreamChunk {
            text: Some(format!("[thinking: {delta}]")),
            error: None,
            done: false,
            tool_calls: None,
            tool_results: None,
        },
        SessionUpdatePayload::ToolCallStarted { name, .. } => StreamChunk {
            text: Some(format!("[tool: {name}]")),
            error: None,
            done: false,
            tool_calls: None,
            tool_results: None,
        },
        SessionUpdatePayload::ToolResult { output, is_error, .. } => {
            let output_text = match output {
                Value::String(s) => s,
                other => other.to_string(),
            };
            StreamChunk {
                text: Some(format!("[tool result: {output_text}]")),
                error: None,
                done: false,
                tool_calls: None,
                tool_results: Some(vec![crate::commands::ai::ToolResult {
                    tool_call_id: String::new(),
                    output: output_text,
                    is_error: is_error.unwrap_or(false),
                }]),
            }
        }
        SessionUpdatePayload::TurnEnded { .. } => StreamChunk {
            text: None,
            error: None,
            done: true,
            tool_calls: None,
            tool_results: None,
        },
        SessionUpdatePayload::Error { message } => StreamChunk {
            text: None,
            error: Some(message),
            done: true,
            tool_calls: None,
            tool_results: None,
        },
        _ => StreamChunk {
            text: None,
            error: None,
            done: false,
            tool_calls: None,
            tool_results: None,
        },
    }
}

fn spawn_reverse_rpc_handler(
    approval_bridge: ApprovalBridge,
    cwd: String,
    mut reverse_requests: mpsc::Receiver<ReverseRpcRequest>,
) -> JoinHandle<()> {
    tokio::spawn(async move {
        while let Some(req) = reverse_requests.recv().await {
            let result = match req.method.as_str() {
                "fs/read_text_file" | "fs/write_text_file" => {
                    handle_fs_request(&req.method, req.params, &cwd)
                }
                "session/request_permission" => {
                    approval_bridge.request_permission(req.params).await
                }
                _ => Err(AcpError::Protocol(format!(
                    "unsupported reverse-RPC method: {}",
                    req.method
                ))),
            };

            let _ = req.response_tx.send(result);
        }
    })
}

#[derive(Debug, Clone)]
pub struct AcpSessionHandle {
    pub acp_session_id: String,
}
