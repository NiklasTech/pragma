use std::collections::HashMap;
use std::sync::Arc;

use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager};
use tokio::process::Child;
use tokio::sync::{mpsc, Mutex};
use tokio::task::JoinHandle;

use super::approval_bridge::ApprovalBridge;
use super::client::{
    AcpClient, AcpClientConfig, Notification, RequestOptions, ReverseRpcRequest, DEFAULT_TIMEOUT_MS,
};
use super::config_options::{parse_config_options, SessionConfigOption};
use super::error::{AcpError, Result};
use super::fs_bridge::handle_fs_request;
use super::mcp_bridge::configs_to_acp_servers;
use super::tools_bridge::handle_tool_call;
use super::types::{
    ClientCapabilities, ContentBlock, FsCapabilities, InitializeRequest, NewSessionRequest,
    PromptContent, PromptRequest, SessionUpdate, SessionUpdateDetail, ToolCallContent,
};
use super::usage::{context_usage, prompt_usage};
use crate::ai::child_sessions::ChildSessionServer;
use crate::ai::cli::{enriched_path, get_manifest};
use crate::commands::ai::StreamChunk;
use crate::platform::resolve_on_path;

const ACP_PROTOCOL_VERSION: u64 = 1;
const CONFIG_OPTIONS_EVENT: &str = "acp_config_options";

type SharedConfigOptions = Arc<Mutex<Vec<SessionConfigOption>>>;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ConfigOptionsEvent {
    chat_session_id: String,
    options: Vec<SessionConfigOption>,
}

pub struct AcpSession {
    client: AcpClient,
    _child: Child,
    #[allow(dead_code)]
    cwd: String,
    acp_session_id: String,
    current_chunk_tx: Arc<Mutex<Option<mpsc::Sender<StreamChunk>>>>,
    config_options: SharedConfigOptions,
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
        allow_child_sessions: bool,
        mcp_server_ids: Option<&[String]>,
    ) -> Result<String> {
        let manifest = get_manifest(provider_id)
            .ok_or_else(|| AcpError::Spawn(format!("unknown provider: {provider_id}")))?;

        let mut cmd_parts = shellwords::split(&manifest.chat_cmd)
            .map_err(|e| AcpError::Spawn(format!("invalid chat command: {e}")))?;
        if cmd_parts.is_empty() {
            return Err(AcpError::Spawn("empty chat command".to_string()));
        }

        let path_var = enriched_path();
        let mut env: HashMap<String, String> = std::env::vars().collect();
        env.insert("PATH".to_string(), path_var.clone());
        if let Some(manifest_env) = &manifest.env {
            for (key, value) in manifest_env {
                env.insert(key.clone(), value.clone());
            }
        }
        if let Some(path_env) = &manifest.path_env {
            for (key, binary) in path_env {
                if let Some(resolved) = resolve_on_path(binary, &path_var) {
                    env.insert(key.clone(), resolved.to_string_lossy().to_string());
                }
            }
        }

        let config = AcpClientConfig {
            command: cmd_parts.remove(0),
            args: cmd_parts,
            env,
            request_timeout_ms: Some(DEFAULT_TIMEOUT_MS),
        };

        let (client, child, notifications, reverse_requests) = AcpClient::start(config).await?;

        let _init_response = client
            .request(
                "initialize",
                Some(serde_json::to_value(InitializeRequest {
                    protocol_version: ACP_PROTOCOL_VERSION,
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

        let mut mcp_servers = self.load_mcp_servers(mcp_server_ids).await;
        if allow_child_sessions {
            if let Some(server) = self
                .app_handle
                .try_state::<ChildSessionServer>()
                .and_then(|state| state.mcp_server(chat_session_id))
            {
                mcp_servers.push(server);
            }
        }
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
        let config_options: SharedConfigOptions = Arc::new(Mutex::new(parse_config_options(
            new_session_resp
                .get("configOptions")
                .unwrap_or(&Value::Null),
        )));

        let notification_handle = spawn_notification_handler(
            current_chunk_tx.clone(),
            acp_session_id.clone(),
            notifications,
            ConfigOptionsSink {
                app_handle: self.app_handle.clone(),
                chat_session_id: chat_session_id.to_string(),
                options: config_options.clone(),
            },
        );

        let reverse_rpc_handle =
            spawn_reverse_rpc_handler(self.approval_bridge.clone(), cwd.clone(), reverse_requests);

        let session = AcpSession {
            client,
            _child: child,
            cwd,
            acp_session_id: acp_session_id.clone(),
            current_chunk_tx,
            config_options,
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

        let _acp_session_id = session.acp_session_id.clone();

        let client = session.client.clone();

        tokio::spawn(async move {
            let result = client
                .request(
                    "session/prompt",
                    Some(serde_json::to_value(req).unwrap_or(Value::Null)),
                    RequestOptions { timeout_ms: None },
                )
                .await;
            match &result {
                Ok(_value) => {}
                Err(_e) => {}
            }
            // Signal stream end once the prompt RPC completes. Turn-ended notifications
            // may arrive earlier; the frontend ignores chunks after the first done.
            let usage = result.as_ref().ok().and_then(prompt_usage);
            let _ = tx
                .send(StreamChunk {
                    text: None,
                    error: result.err().map(|e| e.to_string()),
                    done: true,
                    reasoning: None,
                    tool_calls: None,
                    tool_results: None,
                    usage,
                })
                .await;
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

    pub async fn config_options(&self, chat_session_id: &str) -> Result<Vec<SessionConfigOption>> {
        let sessions = self.sessions.lock().await;
        let session = sessions
            .get(chat_session_id)
            .ok_or_else(|| AcpError::Protocol(format!("no ACP session for {chat_session_id}")))?;
        let options = session.config_options.lock().await.clone();
        Ok(options)
    }

    pub async fn set_config_option(
        &self,
        chat_session_id: &str,
        config_id: &str,
        value: &str,
    ) -> Result<Vec<SessionConfigOption>> {
        let (client, acp_session_id, shared) = {
            let sessions = self.sessions.lock().await;
            let session = sessions.get(chat_session_id).ok_or_else(|| {
                AcpError::Protocol(format!("no ACP session for {chat_session_id}"))
            })?;
            (
                session.client.clone(),
                session.acp_session_id.clone(),
                session.config_options.clone(),
            )
        };

        let known = shared.lock().await.iter().any(|option| {
            option.id == config_id && option.options.iter().any(|choice| choice.value == value)
        });
        if !known {
            return Err(AcpError::Protocol(format!(
                "unknown value {value} for config option {config_id}"
            )));
        }

        let response = client
            .request(
                "session/set_config_option",
                Some(serde_json::json!({
                    "sessionId": acp_session_id,
                    "configId": config_id,
                    "value": value,
                })),
                Default::default(),
            )
            .await?;

        let options = parse_config_options(response.get("configOptions").unwrap_or(&Value::Null));
        let mut stored = shared.lock().await;
        if options.is_empty() {
            // Agents may answer without the full list; keep ours and record the new value.
            for option in stored.iter_mut().filter(|option| option.id == config_id) {
                option.current_value = value.to_string();
            }
        } else {
            *stored = options;
        }
        Ok(stored.clone())
    }

    pub async fn approve(&self, tool_call_id: &str, approved: bool) -> Result<()> {
        self.approval_bridge.respond(tool_call_id, approved).await
    }

    /// The configured servers the session may use; `None` allows all of them.
    async fn load_mcp_servers(&self, allowed: Option<&[String]>) -> Vec<super::types::McpServer> {
        use crate::modules::mcp::{oauth, secrets, McpServerConfig};

        let servers = self
            .app_handle
            .state::<crate::modules::mcp::McpManager>()
            .list_servers()
            .await;
        let mut configs = Vec::new();
        for state in servers {
            let config = state.config;
            if allowed.is_some_and(|ids| !ids.contains(&config.id)) {
                continue;
            }
            // A server whose secrets are missing from the keychain cannot start.
            let (Ok(env), Ok(mut headers)) = (
                secrets::resolve_env(&config),
                secrets::resolve_headers(&config),
            ) else {
                continue;
            };
            if let Ok(Some(token)) = oauth::access_token(&config.id).await {
                headers.insert("Authorization".to_string(), format!("Bearer {token}"));
            }
            configs.push(McpServerConfig {
                env,
                headers,
                ..config
            });
        }

        configs_to_acp_servers(configs)
    }
}

/// Keeps a session's config options current and tells the UI when the agent changes them.
struct ConfigOptionsSink {
    app_handle: AppHandle,
    chat_session_id: String,
    options: SharedConfigOptions,
}

impl ConfigOptionsSink {
    async fn replace(&self, raw: &Value) {
        let options = parse_config_options(raw);
        *self.options.lock().await = options.clone();
        let _ = self.app_handle.emit(
            CONFIG_OPTIONS_EVENT,
            ConfigOptionsEvent {
                chat_session_id: self.chat_session_id.clone(),
                options,
            },
        );
    }
}

fn spawn_notification_handler(
    chunk_tx: Arc<Mutex<Option<mpsc::Sender<StreamChunk>>>>,
    acp_session_id: String,
    mut notifications: mpsc::UnboundedReceiver<Notification>,
    config_sink: ConfigOptionsSink,
) -> JoinHandle<()> {
    tokio::spawn(async move {
        while let Some(notification) = notifications.recv().await {
            if notification.method != "session/update" {
                continue;
            }

            let Some(params) = notification.params else {
                continue;
            };
            let update = match serde_json::from_value::<SessionUpdate>(params.clone()) {
                Ok(u) => u,
                Err(_e) => {
                    continue;
                }
            };

            if update.session_id != acp_session_id {
                continue;
            }

            if let SessionUpdateDetail::ConfigOptionUpdate { config_options } = &update.update {
                config_sink.replace(config_options).await;
                continue;
            }

            let chunk = session_update_to_chunk(update.update.clone());
            if let Some(tx) = chunk_tx.lock().await.as_ref() {
                let _ = tx.send(chunk).await;
            }
        }
    })
}

fn session_update_to_chunk(payload: SessionUpdateDetail) -> StreamChunk {
    match payload {
        SessionUpdateDetail::AgentMessageChunk { content } => StreamChunk {
            text: Some(extract_text(content)),
            error: None,
            done: false,
            reasoning: None,
            tool_calls: None,
            tool_results: None,
            usage: None,
        },
        SessionUpdateDetail::AgentThoughtChunk { content } => StreamChunk {
            text: None,
            error: None,
            done: false,
            reasoning: Some(extract_text(content)),
            tool_calls: None,
            tool_results: None,
            usage: None,
        },
        SessionUpdateDetail::ToolCall {
            tool_call_id,
            title,
            raw_input,
            content,
            ..
        } => {
            let input_text = raw_input
                .as_ref()
                .map(|v| match v {
                    Value::String(s) => s.clone(),
                    other => other.to_string(),
                })
                .or_else(|| content.as_ref().and_then(|c| extract_first_text(c)))
                .unwrap_or_default();
            StreamChunk {
                text: None,
                error: None,
                done: false,
                reasoning: None,
                tool_calls: Some(vec![crate::ai::provider::ToolCall {
                    id: tool_call_id,
                    r#type: "function".to_string(),
                    function: crate::ai::provider::FunctionCall {
                        name: title,
                        arguments: input_text,
                    },
                }]),
                tool_results: None,
                usage: None,
            }
        }
        SessionUpdateDetail::ToolCallUpdate {
            tool_call_id,
            status,
            content,
            raw_output,
            ..
        } => {
            let is_completed = status.as_deref() == Some("completed");
            let is_failed = status.as_deref() == Some("failed");
            if is_completed || is_failed {
                let output_text = raw_output
                    .map(|v| match v {
                        Value::String(s) => s,
                        other => other.to_string(),
                    })
                    .or_else(|| content.as_ref().and_then(|c| extract_first_text(c)))
                    .unwrap_or_default();
                StreamChunk {
                    text: None,
                    error: None,
                    done: false,
                    reasoning: None,
                    tool_calls: None,
                    tool_results: Some(vec![crate::commands::ai::ToolResult {
                        tool_call_id,
                        output: output_text,
                        is_error: is_failed,
                    }]),
                    usage: None,
                }
            } else {
                // Ignore intermediate tool_call_update chunks that only stream input.
                // The final result is delivered via the completed/failed branch above.
                StreamChunk {
                    text: None,
                    error: None,
                    done: false,
                    reasoning: None,
                    tool_calls: None,
                    tool_results: None,
                    usage: None,
                }
            }
        }
        SessionUpdateDetail::UsageUpdate { used, size } => StreamChunk {
            text: None,
            error: None,
            done: false,
            reasoning: None,
            tool_calls: None,
            tool_results: None,
            usage: context_usage(used, size),
        },
        SessionUpdateDetail::TurnEnded { .. } => StreamChunk {
            text: None,
            error: None,
            done: true,
            reasoning: None,
            tool_calls: None,
            tool_results: None,
            usage: None,
        },
        SessionUpdateDetail::Error { message } => StreamChunk {
            text: None,
            error: Some(message),
            done: true,
            reasoning: None,
            tool_calls: None,
            tool_results: None,
            usage: None,
        },
        SessionUpdateDetail::ConfigOptionUpdate { .. } | SessionUpdateDetail::Other => {
            StreamChunk {
                text: None,
                error: None,
                done: false,
                reasoning: None,
                tool_calls: None,
                tool_results: None,
                usage: None,
            }
        }
    }
}

fn extract_text(block: ContentBlock) -> String {
    match block {
        ContentBlock::Text { text } => text,
        ContentBlock::Image { .. } => String::new(),
        ContentBlock::Resource { content, .. } => content,
        ContentBlock::ResourceLink { .. } => String::new(),
        ContentBlock::Other => String::new(),
    }
}

fn extract_first_text(contents: &[ToolCallContent]) -> Option<String> {
    contents.iter().find_map(|c| match &c.content {
        Some(ContentBlock::Text { text }) => Some(text.clone()),
        _ => None,
    })
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
                "tools/call" => handle_tool_call(req.params, &cwd).await,
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

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn chunk(update: Value) -> StreamChunk {
        session_update_to_chunk(serde_json::from_value(update).unwrap())
    }

    fn is_empty(chunk: &StreamChunk) -> bool {
        chunk.text.is_none()
            && chunk.error.is_none()
            && !chunk.done
            && chunk.reasoning.is_none()
            && chunk.tool_calls.is_none()
            && chunk.tool_results.is_none()
            && chunk.usage.is_none()
    }

    #[test]
    fn usage_updates_report_the_context_fill() {
        let update =
            chunk(json!({ "sessionUpdate": "usage_update", "used": 64000, "size": 200000 }));

        let usage = update.usage.expect("usage");
        assert_eq!(usage.context_used, Some(64000));
        assert_eq!(usage.context_size, Some(200000));
        assert!(!update.done);
    }

    #[test]
    fn message_and_thought_chunks_stream_text() {
        let message = chunk(json!({
            "sessionUpdate": "agent_message_chunk",
            "content": { "type": "text", "text": "hello" }
        }));
        let thought = chunk(json!({
            "sessionUpdate": "agent_thought_chunk",
            "content": { "type": "text", "text": "thinking" }
        }));

        assert_eq!(message.text.as_deref(), Some("hello"));
        assert!(!message.done);
        assert_eq!(thought.reasoning.as_deref(), Some("thinking"));
        assert!(thought.text.is_none());
    }

    #[test]
    fn non_text_content_becomes_empty_text() {
        let image = chunk(json!({
            "sessionUpdate": "agent_message_chunk",
            "content": { "type": "image", "data": "AAAA", "mime_type": "image/png" }
        }));
        let resource = chunk(json!({
            "sessionUpdate": "agent_message_chunk",
            "content": { "type": "resource", "uri": "file:///a", "content": "body" }
        }));

        assert_eq!(image.text.as_deref(), Some(""));
        assert_eq!(resource.text.as_deref(), Some("body"));
    }

    #[test]
    fn tool_calls_carry_raw_input_or_first_text_content() {
        let with_input = chunk(json!({
            "sessionUpdate": "tool_call",
            "toolCallId": "call-1",
            "title": "Read file",
            "rawInput": { "path": "src/main.rs" }
        }));
        let with_content = chunk(json!({
            "sessionUpdate": "tool_call",
            "toolCallId": "call-2",
            "title": "Run",
            "content": [
                { "type": "diff", "path": "a.rs" },
                { "type": "content", "content": { "type": "text", "text": "ls -la" } }
            ]
        }));

        let call = &with_input.tool_calls.unwrap()[0];
        assert_eq!(call.id, "call-1");
        assert_eq!(call.function.name, "Read file");
        assert_eq!(call.function.arguments, r#"{"path":"src/main.rs"}"#);
        assert_eq!(
            with_content.tool_calls.unwrap()[0].function.arguments,
            "ls -la"
        );
    }

    #[test]
    fn finished_tool_call_updates_become_results() {
        let completed = chunk(json!({
            "sessionUpdate": "tool_call_update",
            "toolCallId": "call-1",
            "status": "completed",
            "rawOutput": "done"
        }));
        let failed = chunk(json!({
            "sessionUpdate": "tool_call_update",
            "toolCallId": "call-2",
            "status": "failed",
            "content": [{ "type": "content", "content": { "type": "text", "text": "boom" } }]
        }));

        let result = &completed.tool_results.unwrap()[0];
        assert_eq!(result.tool_call_id, "call-1");
        assert_eq!(result.output, "done");
        assert!(!result.is_error);
        let result = &failed.tool_results.unwrap()[0];
        assert_eq!(result.output, "boom");
        assert!(result.is_error);
    }

    #[test]
    fn in_progress_tool_call_updates_are_ignored() {
        let update = chunk(json!({
            "sessionUpdate": "tool_call_update",
            "toolCallId": "call-1",
            "status": "in_progress",
            "rawInput": { "partial": true }
        }));

        assert!(is_empty(&update));
    }

    #[test]
    fn turn_end_and_errors_finish_the_stream() {
        let ended = chunk(json!({ "sessionUpdate": "turn_ended", "stop_reason": "end_turn" }));
        let error = chunk(json!({ "sessionUpdate": "error", "message": "rate limited" }));

        assert!(ended.done);
        assert!(ended.error.is_none());
        assert!(error.done);
        assert_eq!(error.error.as_deref(), Some("rate limited"));
    }

    #[test]
    fn unknown_and_config_updates_produce_empty_chunks() {
        let unknown = chunk(json!({ "sessionUpdate": "plan", "entries": [] }));
        let config = chunk(json!({ "sessionUpdate": "config_option_update", "configOptions": [] }));

        assert!(is_empty(&unknown));
        assert!(is_empty(&config));
    }
}
