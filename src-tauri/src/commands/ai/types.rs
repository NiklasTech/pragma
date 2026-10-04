use serde::{Deserialize, Serialize};

use crate::ai::image::ImageContent;
use crate::ai::provider::{ToolCall, ToolDefinition, Usage};

#[derive(Debug, Deserialize)]
pub struct ChatRequest {
    pub provider: String,
    pub model: String,
    pub base_url: Option<String>,
    pub messages: Vec<ChatMessageInput>,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
    pub stream_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tools: Option<Vec<ToolDefinition>>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct ChatMessageInput {
    pub role: String,
    pub content: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCall>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
    #[serde(default)]
    pub images: Vec<ImageContent>,
}

#[derive(Debug, Serialize)]
pub struct ChatResponse {
    pub id: String,
    pub object: String,
    pub created: u64,
    pub model: String,
    pub choices: Vec<ChatChoice>,
}

#[derive(Debug, Serialize)]
pub struct ChatChoice {
    pub index: u32,
    pub message: ChatResponseMessage,
    pub finish_reason: String,
}

#[derive(Debug, Serialize)]
pub struct ChatResponseMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct ToolResult {
    pub tool_call_id: String,
    pub output: String,
    pub is_error: bool,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct StreamChunk {
    pub text: Option<String>,
    pub error: Option<String>,
    pub done: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reasoning: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCall>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_results: Option<Vec<ToolResult>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub usage: Option<StreamUsage>,
}

/// Token counts of one model response. ACP agents may instead report the
/// context fill directly through `context_used` and `context_size`.
#[derive(Debug, Clone, Default, PartialEq, serde::Serialize)]
pub struct StreamUsage {
    /// The whole input, including the cached part.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub input_tokens: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output_tokens: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cache_read_tokens: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cache_write_tokens: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context_used: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context_size: Option<u64>,
}

impl From<Usage> for StreamUsage {
    fn from(usage: Usage) -> Self {
        Self {
            input_tokens: Some(u64::from(usage.prompt_tokens)),
            output_tokens: Some(u64::from(usage.completion_tokens)),
            cache_read_tokens: usage.cache_read_tokens.map(u64::from),
            cache_write_tokens: usage.cache_write_tokens.map(u64::from),
            context_used: None,
            context_size: None,
        }
    }
}
