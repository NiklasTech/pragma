use serde::{Deserialize, Serialize};

use crate::ai::image::ImageContent;
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
    pub(super) stream_options: Option<OpenAIStreamOptions>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tools: Option<Vec<OpenAIToolDefinition>>,
}

#[derive(Debug, Serialize)]
pub(super) struct OpenAIStreamOptions {
    pub(super) include_usage: bool,
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
            stream_options: None,
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
    content: serde_json::Value,
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
            content: message_content(msg.content, &msg.images),
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

fn message_content(text: String, images: &[ImageContent]) -> serde_json::Value {
    if images.is_empty() {
        return serde_json::Value::String(text);
    }
    let mut parts = Vec::with_capacity(images.len() + 1);
    if !text.is_empty() {
        parts.push(serde_json::json!({ "type": "text", "text": text }));
    }
    parts.extend(images.iter().map(|image| {
        serde_json::json!({
            "type": "image_url",
            "image_url": { "url": image.data_url() },
        })
    }));
    serde_json::Value::Array(parts)
}

fn sanitize_tool_parameters(parameters: serde_json::Value) -> serde_json::Value {
    if let serde_json::Value::Object(mut map) = parameters {
        map.remove("$schema");
        serde_json::Value::Object(map)
    } else {
        parameters
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn user_message(content: &str, images: Vec<ImageContent>) -> Message {
        Message {
            role: Role::User,
            content: content.to_string(),
            tool_calls: None,
            tool_call_id: None,
            images,
        }
    }

    #[test]
    fn text_only_messages_keep_string_content() {
        let message = OpenAIMessage::from(user_message("hello", Vec::new()));
        assert_eq!(message.content, serde_json::json!("hello"));
    }

    #[test]
    fn images_become_data_url_parts_after_the_text() {
        let image = ImageContent {
            media_type: "image/jpeg".to_string(),
            data: "aGk=".to_string(),
        };
        let message = OpenAIMessage::from(user_message("what is this?", vec![image]));
        assert_eq!(
            message.content,
            serde_json::json!([
                { "type": "text", "text": "what is this?" },
                { "type": "image_url", "image_url": { "url": "data:image/jpeg;base64,aGk=" } },
            ])
        );
    }
}
