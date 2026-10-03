use serde::{Deserialize, Serialize};
use serde_json::Value;

pub const PORT_ENV: &str = "PRAGMA_CHILD_SESSIONS_PORT";
pub const TOKEN_ENV: &str = "PRAGMA_CHILD_SESSIONS_TOKEN";
pub const SESSION_ENV: &str = "PRAGMA_CHILD_SESSIONS_PARENT";
pub const TOOL_NAME: &str = "agent_spawn_session";
pub const BROWSER_TOOL_NAME: &str = "agent_open_browser";
/// Internal request of the bridge for the current extension tools; never offered as a tool.
pub const LIST_EXTENSION_TOOLS: &str = "pragma_list_extension_tools";
/// Extension tools are named `ext__<extension id>__<tool name>`.
pub const EXTENSION_TOOL_PREFIX: &str = "ext__";
pub const MAX_LINE_BYTES: u64 = 1024 * 1024;

/// One tool call from the bridge process to the app.
#[derive(Debug, Serialize, Deserialize)]
pub struct BridgeRequest {
    pub token: String,
    pub session_id: String,
    pub tool: String,
    pub arguments: Value,
}

/// The app's answer, returned to the agent as the tool result.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SpawnReply {
    pub ok: bool,
    pub text: String,
}
