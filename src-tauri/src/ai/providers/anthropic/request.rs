use serde::{Deserialize, Serialize};

use crate::ai::image::ImageContent;
use crate::ai::provider::{Message, Role, ToolDefinition};

#[derive(Debug, Serialize)]
pub(super) struct AnthropicRequestBody {
    model: String,
    messages: Vec<AnthropicMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    system: Option<Vec<AnthropicSystemBlock>>,
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
        mut messages: Vec<AnthropicMessage>,
        temperature: Option<f32>,
        max_tokens: Option<u32>,
        tools: Option<Vec<ToolDefinition>>,
    ) -> Self {
        let mut tools: Option<Vec<AnthropicToolDefinition>> =
            tools.map(|tools| tools.into_iter().map(Into::into).collect());
        if let Some(last) = tools.as_mut().and_then(|tools| tools.last_mut()) {
            last.cache_control = Some(ephemeral_cache_control());
        }
        let system = system
            .filter(|text| !text.is_empty())
            .map(|text| vec![AnthropicSystemBlock::cached(text)]);
        if let Some(message) = messages
            .iter_mut()
            .rev()
            .find(|message| message.has_cacheable_content())
        {
            message.mark_cache_breakpoint();
        }

        Self {
            model: model.to_string(),
            messages,
            system,
            temperature,
            max_tokens,
            stream: false,
            tools,
        }
    }
}

fn ephemeral_cache_control() -> serde_json::Value {
    serde_json::json!({ "type": "ephemeral" })
}

#[derive(Debug, Serialize)]
struct AnthropicSystemBlock {
    #[serde(rename = "type")]
    kind: &'static str,
    text: String,
    cache_control: serde_json::Value,
}

impl AnthropicSystemBlock {
    fn cached(text: String) -> Self {
        Self {
            kind: "text",
            text,
            cache_control: ephemeral_cache_control(),
        }
    }
}

#[derive(Debug, Serialize)]
struct AnthropicToolDefinition {
    name: String,
    description: String,
    #[serde(rename = "input_schema")]
    input_schema: serde_json::Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    cache_control: Option<serde_json::Value>,
}

impl From<ToolDefinition> for AnthropicToolDefinition {
    fn from(tool: ToolDefinition) -> Self {
        Self {
            name: tool.function.name,
            description: tool.function.description,
            input_schema: tool.function.parameters,
            cache_control: None,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub(super) struct AnthropicMessage {
    role: String,
    content: serde_json::Value,
}

impl AnthropicMessage {
    fn has_cacheable_content(&self) -> bool {
        match &self.content {
            serde_json::Value::String(text) => !text.is_empty(),
            serde_json::Value::Array(blocks) => !blocks.is_empty(),
            _ => false,
        }
    }

    /// Anthropic only accepts `cache_control` on content blocks, so string content becomes a text block.
    fn mark_cache_breakpoint(&mut self) {
        let cache_control = ephemeral_cache_control();
        match &mut self.content {
            serde_json::Value::String(text) => {
                self.content = serde_json::json!([{
                    "type": "text",
                    "text": std::mem::take(text),
                    "cache_control": cache_control,
                }]);
            }
            serde_json::Value::Array(blocks) => {
                if let Some(serde_json::Value::Object(block)) = blocks.last_mut() {
                    block.insert("cache_control".to_string(), cache_control);
                }
            }
            _ => {}
        }
    }
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

    fn tool(name: &str) -> ToolDefinition {
        serde_json::from_value(serde_json::json!({
            "type": "function",
            "function": {
                "name": name,
                "description": "",
                "parameters": { "type": "object" },
            },
        }))
        .expect("valid tool definition")
    }

    #[test]
    fn request_marks_tools_system_and_last_message_as_cache_breakpoints() {
        let mut tool_result = user_message("file contents", Vec::new());
        tool_result.role = Role::Tool;
        tool_result.tool_call_id = Some("call_1".to_string());
        let messages = vec![
            AnthropicMessage::from(user_message("read the file", Vec::new())),
            AnthropicMessage::from(tool_result),
        ];
        let body = AnthropicRequestBody::from_completion_request(
            "claude-test",
            Some("You are Pragma.".to_string()),
            messages,
            None,
            None,
            Some(vec![tool("read_file"), tool("write_file")]),
        );

        let json = serde_json::to_value(&body).expect("serializable request");
        let ephemeral = serde_json::json!({ "type": "ephemeral" });
        assert_eq!(
            json["system"],
            serde_json::json!([
                { "type": "text", "text": "You are Pragma.", "cache_control": ephemeral },
            ])
        );
        assert!(json["tools"][0].get("cache_control").is_none());
        assert_eq!(json["tools"][1]["cache_control"], ephemeral);
        assert_eq!(json["messages"][0]["content"], "read the file");
        assert_eq!(
            json["messages"][1]["content"][0]["cache_control"],
            ephemeral
        );
    }

    #[test]
    fn string_content_becomes_a_cached_text_block() {
        let body = AnthropicRequestBody::from_completion_request(
            "claude-test",
            None,
            vec![AnthropicMessage::from(user_message("hello", Vec::new()))],
            None,
            None,
            None,
        );

        let json = serde_json::to_value(&body).expect("serializable request");
        assert!(json.get("system").is_none());
        assert!(json.get("tools").is_none());
        assert_eq!(
            json["messages"][0]["content"],
            serde_json::json!([
                { "type": "text", "text": "hello", "cache_control": { "type": "ephemeral" } },
            ])
        );
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
