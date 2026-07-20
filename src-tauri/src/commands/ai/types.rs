use serde::{Deserialize, Serialize};

use crate::ai::provider::{ToolCall, ToolDefinition};

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
}
