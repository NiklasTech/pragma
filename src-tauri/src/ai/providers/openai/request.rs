use serde::{Deserialize, Serialize};

use crate::ai::provider::{
    coalesce_system_messages, CompletionRequest, Message, Role, ToolDefinition,
};

use super::response::{OpenAIFunctionCall, OpenAIToolCall};

#[derive(Debug, Serialize)]
pub(super) struct OpenAIRequestBody {
    model: String,
    messages: Vec<OpenAIMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) stream: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tools: Option<Vec<OpenAIToolDefinition>>,
}

impl OpenAIRequestBody {
    pub(super) fn from_completion_request(model: &str, req: CompletionRequest) -> Self {
        Self {
            model: model.to_string(),
            messages: coalesce_system_messages(req.messages)
                .into_iter()
                .map(Into::into)
                .collect(),
            temperature: req.temperature.or_else(|| {
                if req.tools.is_some() {
                    Some(0.1)
                } else {
                    None
                }
            }),
            max_tokens: req.max_tokens.or(Some(4096)),
            stream: None,
            tools: req
                .tools
                .map(|tools| tools.into_iter().map(Into::into).collect()),
        }
    }
}

#[derive(Debug, Serialize)]
struct OpenAIToolDefinition {
    r#type: String,
    function: OpenAIFunctionDefinition,
}

impl From<ToolDefinition> for OpenAIToolDefinition {
    fn from(tool: ToolDefinition) -> Self {
        Self {
            r#type: tool.r#type,
            function: OpenAIFunctionDefinition {
                name: tool.function.name,
                description: tool.function.description,
                parameters: sanitize_tool_parameters(tool.function.parameters),
            },
        }
    }
}

#[derive(Debug, Serialize)]
struct OpenAIFunctionDefinition {
    name: String,
    description: String,
    parameters: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
struct OpenAIMessage {
    role: String,
    content: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    tool_calls: Option<Vec<OpenAIToolCall>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    tool_call_id: Option<String>,
}

impl From<Message> for OpenAIMessage {
    fn from(msg: Message) -> Self {
        Self {
            role: match msg.role {
                Role::System => "system",
                Role::User => "user",
                Role::Assistant => "assistant",
                Role::Tool => "tool",
            }
            .to_string(),
            content: msg.content,
            tool_calls: msg.tool_calls.map(|calls| {
                calls
                    .into_iter()
                    .map(|call| OpenAIToolCall {
                        id: call.id,
                        r#type: call.r#type,
                        function: OpenAIFunctionCall {
                            name: call.function.name,
                            arguments: call.function.arguments,
                        },
                    })
                    .collect()
            }),
            tool_call_id: msg.tool_call_id,
        }
    }
}

fn sanitize_tool_parameters(parameters: serde_json::Value) -> serde_json::Value {
    if let serde_json::Value::Object(mut map) = parameters {
        map.remove("$schema");
        serde_json::Value::Object(map)
    } else {
        parameters
    }
}
