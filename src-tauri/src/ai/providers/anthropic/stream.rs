use serde::Deserialize;

use crate::ai::{
    error::AIError,
    provider::{CompletionChunk, FunctionCall, ToolCall, Usage},
};

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
pub(super) enum AnthropicStreamEvent {
    #[serde(rename = "content_block_delta")]
    ContentBlockDelta { delta: AnthropicDelta },
    #[serde(rename = "message_delta")]
    MessageDelta { usage: Option<AnthropicStreamUsage> },
    #[serde(rename = "message_start")]
    MessageStart {
        #[serde(default)]
        message: AnthropicStartMessage,
    },
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

#[derive(Debug, Default, Deserialize)]
pub(super) struct AnthropicStartMessage {
    #[serde(default)]
    pub(super) usage: Option<AnthropicStreamUsage>,
}

/// `message_start` carries the input counts, `message_delta` the output count and,
/// on newer API versions, the input counts again.
#[derive(Debug, Clone, Default, PartialEq, Deserialize)]
pub(super) struct AnthropicStreamUsage {
    #[serde(default)]
    pub(super) input_tokens: Option<u32>,
    #[serde(default)]
    pub(super) output_tokens: Option<u32>,
    #[serde(default)]
    pub(super) cache_creation_input_tokens: Option<u32>,
    #[serde(default)]
    pub(super) cache_read_input_tokens: Option<u32>,
}

impl AnthropicStreamUsage {
    pub(super) fn merge(&mut self, update: AnthropicStreamUsage) {
        self.input_tokens = update.input_tokens.or(self.input_tokens);
        self.output_tokens = update.output_tokens.or(self.output_tokens);
        self.cache_creation_input_tokens = update
            .cache_creation_input_tokens
            .or(self.cache_creation_input_tokens);
        self.cache_read_input_tokens = update
            .cache_read_input_tokens
            .or(self.cache_read_input_tokens);
    }

    pub(super) fn to_usage(&self) -> Usage {
        let prompt_tokens = self
            .input_tokens
            .unwrap_or(0)
            .saturating_add(self.cache_creation_input_tokens.unwrap_or(0))
            .saturating_add(self.cache_read_input_tokens.unwrap_or(0));
        Usage {
            cache_read_tokens: self.cache_read_input_tokens,
            cache_write_tokens: self.cache_creation_input_tokens,
            ..Usage::new(prompt_tokens, self.output_tokens.unwrap_or(0))
        }
    }
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
                usage: None,
            }))
            .await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn usage_of(data: &str) -> AnthropicStreamUsage {
        match serde_json::from_str::<AnthropicStreamEvent>(data) {
            Ok(AnthropicStreamEvent::MessageStart { message }) => message.usage.unwrap_or_default(),
            Ok(AnthropicStreamEvent::MessageDelta { usage }) => usage.unwrap_or_default(),
            other => panic!("expected a usage event, got {other:?}"),
        }
    }

    #[test]
    fn merges_start_and_delta_usage_with_cache() {
        let mut usage = usage_of(
            r#"{"type":"message_start","message":{"id":"m1","usage":{"input_tokens":10,"cache_creation_input_tokens":200,"cache_read_input_tokens":3000,"output_tokens":1}}}"#,
        );
        usage.merge(usage_of(
            r#"{"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":42}}"#,
        ));

        let usage = usage.to_usage();
        assert_eq!(usage.prompt_tokens, 3210);
        assert_eq!(usage.completion_tokens, 42);
        assert_eq!(usage.total_tokens, 3252);
        assert_eq!(usage.cache_read_tokens, Some(3000));
        assert_eq!(usage.cache_write_tokens, Some(200));
    }

    #[test]
    fn message_start_without_usage_still_parses() {
        let event = serde_json::from_str::<AnthropicStreamEvent>(r#"{"type":"message_start"}"#);
        assert!(matches!(
            event,
            Ok(AnthropicStreamEvent::MessageStart { .. })
        ));
    }
}
