use std::future::Future;
use std::pin::Pin;

use serde::{Deserialize, Serialize};
use tokio::sync::mpsc;
use tokio_util::sync::CancellationToken;

use super::config::ProviderConfig;
use super::error::AIError;

pub type BoxFuture<'a, T> = Pin<Box<dyn Future<Output = T> + Send + 'a>>;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub context_window: Option<usize>,
    pub supports_streaming: bool,
    pub supports_vision: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FunctionDefinition {
    pub name: String,
    pub description: String,
    pub parameters: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ToolDefinition {
    pub r#type: String,
    pub function: FunctionDefinition,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FunctionCall {
    pub name: String,
    pub arguments: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ToolCall {
    pub id: String,
    pub r#type: String,
    pub function: FunctionCall,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Message {
    pub role: Role,
    pub content: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCall>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Role {
    System,
    User,
    Assistant,
    Tool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CompletionRequest {
    pub messages: Vec<Message>,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
    pub stream: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tools: Option<Vec<ToolDefinition>>,
}

impl CompletionRequest {
    pub fn new(messages: Vec<Message>) -> Self {
        Self {
            messages,
            temperature: None,
            max_tokens: None,
            stream: false,
            tools: None,
        }
    }

    pub fn with_temperature(mut self, temp: f32) -> Self {
        self.temperature = Some(temp);
        self
    }

    pub fn with_max_tokens(mut self, tokens: u32) -> Self {
        self.max_tokens = Some(tokens);
        self
    }

    pub fn with_stream(mut self, stream: bool) -> Self {
        self.stream = stream;
        self
    }

    pub fn with_tools(mut self, tools: Vec<ToolDefinition>) -> Self {
        self.tools = Some(tools);
        self
    }
}

/// Fold every system message into one leading system message (Qwen chat templates).
pub fn coalesce_system_messages(messages: Vec<Message>) -> Vec<Message> {
    let mut system_contents: Vec<String> = Vec::new();
    let mut rest: Vec<Message> = Vec::new();

    for message in messages {
        match message.role {
            Role::System => {
                if !message.content.trim().is_empty() {
                    system_contents.push(message.content);
                }
            }
            _ => rest.push(message),
        }
    }

    let mut coalesced = Vec::with_capacity(rest.len() + 1);
    if !system_contents.is_empty() {
        coalesced.push(Message {
            role: Role::System,
            content: system_contents.join("\n\n"),
            tool_calls: None,
            tool_call_id: None,
        });
    }
    coalesced.extend(rest);
    coalesced
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CompletionResponse {
    pub content: String,
    pub model: String,
    pub usage: Option<Usage>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCall>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub finish_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CompletionChunk {
    pub content: String,
    pub finish_reason: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCall>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Usage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

pub trait AIProvider: Send + Sync {
    fn name(&self) -> &'static str;

    fn config(&self) -> &ProviderConfig;

    fn models(&self) -> Vec<ModelInfo>;

    fn list_models(&self) -> BoxFuture<'_, Result<Vec<ModelInfo>, AIError>>;

    fn complete(
        &self,
        req: CompletionRequest,
    ) -> BoxFuture<'_, Result<CompletionResponse, AIError>>;

    fn stream(
        &self,
        req: CompletionRequest,
    ) -> BoxFuture<'_, Result<Vec<CompletionChunk>, AIError>>;

    /// Stream completion chunks in real-time. The returned receiver yields
    /// either a chunk or an error. It closes once the stream is finished.
    fn stream_chunks(
        &self,
        req: CompletionRequest,
    ) -> BoxFuture<'_, Result<mpsc::Receiver<Result<CompletionChunk, AIError>>, AIError>>;

    /// Stream completion chunks with optional cancellation support.
    /// Providers that do not override this default will simply ignore the token.
    fn stream_chunks_with_cancel(
        &self,
        req: CompletionRequest,
        cancel_token: Option<CancellationToken>,
    ) -> BoxFuture<'_, Result<mpsc::Receiver<Result<CompletionChunk, AIError>>, AIError>> {
        let _ = cancel_token;
        self.stream_chunks(req)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn msg(role: Role, content: &str) -> Message {
        Message {
            role,
            content: content.to_string(),
            tool_calls: None,
            tool_call_id: None,
        }
    }

    fn roles(messages: &[Message]) -> Vec<Role> {
        messages
            .iter()
            .map(|message| message.role.clone())
            .collect()
    }

    #[test]
    fn coalesce_empty_input_stays_empty() {
        assert!(coalesce_system_messages(Vec::new()).is_empty());
    }

    #[test]
    fn coalesce_without_system_messages_is_unchanged() {
        let messages = vec![
            msg(Role::User, "hello"),
            msg(Role::Assistant, "hi"),
            msg(Role::User, "bye"),
        ];
        assert_eq!(coalesce_system_messages(messages.clone()), messages);
    }

    #[test]
    fn coalesce_merges_two_leading_system_messages() {
        let messages = vec![
            msg(Role::System, "You are Pragma."),
            msg(Role::System, "Follow AGENTS.md."),
            msg(Role::User, "hello"),
        ];

        let result = coalesce_system_messages(messages);

        assert_eq!(roles(&result), vec![Role::System, Role::User]);
        assert_eq!(result[0].content, "You are Pragma.\n\nFollow AGENTS.md.");
        assert_eq!(result[1].content, "hello");
    }

    #[test]
    fn coalesce_moves_late_system_message_to_the_front() {
        let messages = vec![
            msg(Role::System, "first"),
            msg(Role::User, "question"),
            msg(Role::System, "second"),
            msg(Role::Assistant, "answer"),
        ];

        let result = coalesce_system_messages(messages);

        assert_eq!(
            roles(&result),
            vec![Role::System, Role::User, Role::Assistant]
        );
        assert_eq!(result[0].content, "first\n\nsecond");
        assert_eq!(result[1].content, "question");
        assert_eq!(result[2].content, "answer");
    }

    #[test]
    fn coalesce_omits_empty_system_contents() {
        let messages = vec![
            msg(Role::System, ""),
            msg(Role::System, "  "),
            msg(Role::User, "hello"),
        ];

        let result = coalesce_system_messages(messages);

        assert_eq!(roles(&result), vec![Role::User]);
        assert_eq!(result[0].content, "hello");
    }

    #[test]
    fn coalesce_all_empty_system_messages_drops_system_role() {
        let messages = vec![msg(Role::System, ""), msg(Role::System, "")];
        assert!(coalesce_system_messages(messages).is_empty());
    }
}
