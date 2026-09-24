use serde::Deserialize;

use crate::ai::{
    error::AIError,
    provider::{CompletionChunk, FunctionCall, ToolCall},
};

use super::response::AnthropicUsage;

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
pub(super) enum AnthropicStreamEvent {
    #[serde(rename = "content_block_delta")]
    ContentBlockDelta { delta: AnthropicDelta },
    #[serde(rename = "message_delta")]
    MessageDelta { usage: Option<AnthropicUsage> },
    #[serde(rename = "message_start")]
    MessageStart,
    #[serde(rename = "content_block_start")]
    ContentBlockStart {
        content_block: AnthropicContentBlock,
    },
    #[serde(rename = "content_block_stop")]
    ContentBlockStop,
    #[serde(rename = "message_stop")]
    MessageStop,
    #[serde(rename = "ping")]
    Ping,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
pub(super) enum AnthropicContentBlock {
    #[serde(rename = "text")]
    Text,
    #[serde(rename = "tool_use")]
    ToolUse { id: String, name: String },
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
pub(super) enum AnthropicDelta {
    #[serde(rename = "text_delta")]
    TextDelta { text: String },
    #[serde(rename = "input_json_delta")]
    InputJsonDelta { partial_json: String },
}

pub(super) enum AnthropicCurrentBlock {
    Text,
    ToolUse {
        id: String,
        name: String,
        input: String,
    },
}

pub(super) async fn send_tool_call_chunk(
    block: AnthropicCurrentBlock,
    tx: &tokio::sync::mpsc::Sender<Result<CompletionChunk, AIError>>,
) {
    if let AnthropicCurrentBlock::ToolUse { id, name, input } = block {
        let _ = tx
            .send(Ok(CompletionChunk {
                content: String::new(),
                finish_reason: Some("tool_calls".to_string()),
                tool_calls: Some(vec![ToolCall {
                    id,
                    r#type: "function".to_string(),
                    function: FunctionCall {
                        name,
                        arguments: input,
                    },
                }]),
            }))
            .await;
    }
}
