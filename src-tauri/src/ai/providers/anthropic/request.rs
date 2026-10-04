use serde::{Deserialize, Serialize};

use crate::ai::image::ImageContent;
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
                content: message_content(msg.content, &msg.images),
            },
        }
    }
}

fn message_content(text: String, images: &[ImageContent]) -> serde_json::Value {
    if images.is_empty() {
        return serde_json::Value::String(text);
    }
    let mut blocks: Vec<serde_json::Value> = images
        .iter()
        .map(|image| {
            serde_json::json!({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": image.media_type,
                    "data": image.data,
                },
            })
        })
        .collect();
    if !text.is_empty() {
        blocks.push(serde_json::json!({ "type": "text", "text": text }));
    }
    serde_json::Value::Array(blocks)
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
        let message = AnthropicMessage::from(user_message("hello", Vec::new()));
        assert_eq!(message.content, serde_json::json!("hello"));
    }

    #[test]
    fn images_become_base64_blocks_before_the_text() {
        let image = ImageContent {
            media_type: "image/png".to_string(),
            data: "aGk=".to_string(),
        };
        let message = AnthropicMessage::from(user_message("what is this?", vec![image]));
        assert_eq!(
            message.content,
            serde_json::json!([
                {
                    "type": "image",
                    "source": { "type": "base64", "media_type": "image/png", "data": "aGk=" },
                },
                { "type": "text", "text": "what is this?" },
            ])
        );
    }
}
