use serde::{Deserialize, Serialize};

use crate::ai::provider::{Message, Role, ToolDefinition};

#[derive(Debug, Serialize)]
pub(super) struct AnthropicRequestBody {
    model: String,
    messages: Vec<AnthropicMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    system: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "std::ops::Not::not", rename = "stream")]
    pub(super) stream: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    tools: Option<Vec<AnthropicToolDefinition>>,
}

impl AnthropicRequestBody {
    pub(super) fn from_completion_request(
        model: &str,
        system: Option<String>,
        messages: Vec<AnthropicMessage>,
        temperature: Option<f32>,
        max_tokens: Option<u32>,
        tools: Option<Vec<ToolDefinition>>,
    ) -> Self {
        Self {
            model: model.to_string(),
            messages,
            system,
            temperature,
            max_tokens,
            stream: false,
            tools: tools.map(|tools| tools.into_iter().map(Into::into).collect()),
        }
    }
}

#[derive(Debug, Serialize)]
struct AnthropicToolDefinition {
    name: String,
    description: String,
    #[serde(rename = "input_schema")]
    input_schema: serde_json::Value,
}

impl From<ToolDefinition> for AnthropicToolDefinition {
    fn from(tool: ToolDefinition) -> Self {
        Self {
            name: tool.function.name,
            description: tool.function.description,
            input_schema: tool.function.parameters,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub(super) struct AnthropicMessage {
    role: String,
    content: serde_json::Value,
}

impl From<Message> for AnthropicMessage {
    fn from(msg: Message) -> Self {
        match msg.role {
            Role::Tool => {
                let tool_use_id = msg.tool_call_id.unwrap_or_default();
                let content = serde_json::json!([{
                    "type": "tool_result",
                    "tool_use_id": tool_use_id,
                    "content": msg.content,
                }]);
                Self {
                    role: "user".to_string(),
                    content,
                }
            }
            _ => Self {
                role: match msg.role {
                    Role::System => "user",
                    Role::User => "user",
                    Role::Assistant => "assistant",
                    Role::Tool => "user",
                }
                .to_string(),
                content: serde_json::Value::String(msg.content),
            },
        }
    }
}
