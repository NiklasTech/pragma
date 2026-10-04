use serde::Deserialize;

use super::stream::AnthropicStreamUsage;

#[derive(Debug, Deserialize)]
pub(super) struct AnthropicResponse {
    pub(super) model: String,
    pub(super) content: Vec<AnthropicContent>,
    pub(super) usage: Option<AnthropicStreamUsage>,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
pub(super) enum AnthropicContent {
    #[serde(rename = "text")]
    Text { text: String },
    #[serde(rename = "tool_use")]
    ToolUse {
        id: String,
        name: String,
        input: serde_json::Value,
    },
}
