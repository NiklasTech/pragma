use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub(super) struct OpenAIResponse {
    pub(super) model: String,
    pub(super) choices: Vec<OpenAIChoice>,
    pub(super) usage: Option<OpenAIUsage>,
}

#[derive(Debug, Deserialize)]
pub(super) struct OpenAIChoice {
    pub(super) message: OpenAIResponseMessage,
    pub(super) finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub(super) struct OpenAIResponseMessage {
    pub(super) content: Option<String>,
    pub(super) reasoning_content: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(super) tool_calls: Option<Vec<OpenAIToolCall>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(super) struct OpenAIToolCall {
    pub(super) id: String,
    pub(super) r#type: String,
    pub(super) function: OpenAIFunctionCall,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(super) struct OpenAIFunctionCall {
    pub(super) name: String,
    pub(super) arguments: String,
}

#[derive(Debug, Deserialize)]
pub(super) struct OpenAIUsage {
    pub(super) prompt_tokens: u32,
    pub(super) completion_tokens: u32,
    pub(super) total_tokens: u32,
}
