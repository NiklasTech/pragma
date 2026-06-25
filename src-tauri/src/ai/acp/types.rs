use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

// ─── JSON-RPC envelope ───────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcRequest {
    pub jsonrpc: String,
    pub id: Option<Value>,
    pub method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub params: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcResponse {
    pub jsonrpc: String,
    pub id: Option<Value>,
    #[serde(flatten)]
    pub body: JsonRpcResponseBody,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum JsonRpcResponseBody {
    Result(Value),
    Error(JsonRpcErrorObject),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcErrorObject {
    pub code: i64,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,
}

// ─── Initialize ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InitializeRequest {
    pub protocol_version: String,
    pub client_capabilities: ClientCapabilities,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InitializeResponse {
    pub protocol_version: String,
    pub agent_capabilities: AgentCapabilities,
    pub auth_methods: Vec<AuthMethod>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_info: Option<Implementation>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ClientCapabilities {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fs: Option<FsCapabilities>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prompt_capabilities: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mcp_capabilities: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_capabilities: Option<Value>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct FsCapabilities {
    pub read_text_file: bool,
    pub write_text_file: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentCapabilities {
    pub load_session: bool,
    pub prompt_capabilities: PromptCapabilities,
    pub mcp_capabilities: McpCapabilities,
    pub session_capabilities: SessionCapabilities,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptCapabilities {
    pub image: bool,
    pub audio: bool,
    pub embedded_context: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpCapabilities {
    pub http: bool,
    pub sse: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionCapabilities {
    pub list: Value,
    pub resume: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthMethod {
    pub id: String,
    #[serde(rename = "type")]
    pub auth_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub args: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub env: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Implementation {
    pub name: String,
    pub version: String,
}

// ─── Session lifecycle ───────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewSessionRequest {
    pub cwd: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mcp_servers: Option<Vec<McpServer>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewSessionResponse {
    pub session_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub config_options: Option<Vec<Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadSessionRequest {
    pub cwd: String,
    pub session_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mcp_servers: Option<Vec<McpServer>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadSessionResponse {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub config_options: Option<Vec<Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CancelNotification {
    pub session_id: String,
}

// ─── Prompt ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptRequest {
    pub session_id: String,
    pub prompt: Vec<PromptContent>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum PromptContent {
    #[serde(rename = "text")]
    Text { text: String },
    #[serde(rename = "image")]
    Image { data: String, mime_type: String },
    #[serde(rename = "resource")]
    Resource { uri: String, content: String },
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct PromptResponse {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stop_reason: Option<String>,
}

// ─── Session update notifications ────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionUpdate {
    pub session_id: String,
    #[serde(flatten)]
    pub payload: SessionUpdatePayload,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum SessionUpdatePayload {
    #[serde(rename = "agent_message_chunk")]
    AgentMessageChunk { delta: String },
    #[serde(rename = "thinking_delta")]
    ThinkingDelta { delta: String },
    #[serde(rename = "tool_call_started")]
    ToolCallStarted {
        tool_call_id: String,
        name: String,
        args: Value,
    },
    #[serde(rename = "tool_call_delta")]
    ToolCallDelta {
        tool_call_id: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        arguments_part: Option<String>,
    },
    #[serde(rename = "tool_progress")]
    ToolProgress {
        tool_call_id: String,
        update: Value,
    },
    #[serde(rename = "tool_result")]
    ToolResult {
        tool_call_id: String,
        output: Value,
        #[serde(skip_serializing_if = "Option::is_none")]
        is_error: Option<bool>,
    },
    #[serde(rename = "turn_ended")]
    TurnEnded { reason: String },
    #[serde(rename = "error")]
    Error { message: String },
    #[serde(other)]
    Other,
}

// ─── MCP forwarding ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpServer {
    pub name: String,
    pub transport: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub command: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub args: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub env: Option<HashMap<String, String>>,
}

// ─── Reverse-RPC: fs ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FsReadTextFileRequest {
    pub session_id: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FsReadTextFileResponse {
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FsWriteTextFileRequest {
    pub session_id: String,
    pub path: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FsWriteTextFileResponse {
    pub written: bool,
}

// ─── Reverse-RPC: permission ─────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RequestPermissionRequest {
    pub session_id: String,
    pub tool_call_id: String,
    pub tool_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub args: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RequestPermissionResponse {
    pub approved: bool,
}
