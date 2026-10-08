use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::ai::image::ImageContent;

pub const PORT_ENV: &str = "PRAGMA_CHILD_SESSIONS_PORT";
pub const TOKEN_ENV: &str = "PRAGMA_CHILD_SESSIONS_TOKEN";
pub const SESSION_ENV: &str = "PRAGMA_CHILD_SESSIONS_PARENT";
pub const TOOL_NAME: &str = "agent_spawn_session";
pub const BROWSER_TOOL_NAME: &str = "agent_open_browser";
pub const BROWSER_SCREENSHOT_TOOL_NAME: &str = "agent_browser_screenshot";
pub const BROWSER_CONSOLE_TOOL_NAME: &str = "agent_browser_console";
/// Internal request of the bridge for the current extension tools; never offered as a tool.
pub const LIST_EXTENSION_TOOLS: &str = "pragma_list_extension_tools";
/// Extension tools are named `ext__<extension id>__<tool name>`.
pub const EXTENSION_TOOL_PREFIX: &str = "ext__";
pub const MAX_LINE_BYTES: u64 = 1024 * 1024;
/// Replies can carry a screenshot of up to 5 MB as base64.
pub const MAX_REPLY_LINE_BYTES: u64 = 8 * 1024 * 1024;

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
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub images: Vec<ImageContent>,
}

/// Whether the tool is one of Pragma's browser pane tools.
pub fn is_browser_tool(name: &str) -> bool {
    matches!(
        name,
        BROWSER_TOOL_NAME | BROWSER_SCREENSHOT_TOOL_NAME | BROWSER_CONSOLE_TOOL_NAME
    )
}
