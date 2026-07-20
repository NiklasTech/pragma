use std::collections::HashMap;
use std::sync::Mutex;

use serde::Deserialize;

use tauri::ipc::Channel;
use tokio_util::sync::CancellationToken;

use crate::ai::{
    config::ProviderConfig,
    provider::{AIProvider, CompletionChunk, CompletionRequest, Message, Role},
    providers::{
        anthropic::AnthropicProvider, copilot::CopilotProvider, custom::CustomProvider,
        gemini::GeminiProvider, ollama::OllamaProvider, openai::OpenAIProvider,
    },
};

use super::types::{ChatRequest, StreamChunk};

static ACTIVE_STREAM_CANCELLATIONS: Mutex<Option<HashMap<String, CancellationToken>>> =
    Mutex::new(None);

fn lock_cancellations() -> std::sync::MutexGuard<'static, Option<HashMap<String, CancellationToken>>>
{
    match ACTIVE_STREAM_CANCELLATIONS.lock() {
        Ok(g) => g,
        Err(e) => e.into_inner(),
    }
}

fn register_stream_cancellation(stream_id: &str) -> CancellationToken {
    let token = CancellationToken::new();
    let mut guard = lock_cancellations();
    let map = guard.get_or_insert_with(HashMap::new);
    map.insert(stream_id.to_string(), token.clone());
    token
}

fn unregister_stream_cancellation(stream_id: &str) {
    let mut guard = lock_cancellations();
    if let Some(map) = guard.as_mut() {
        map.remove(stream_id);
    }
}

#[tauri::command]
pub async fn ai_chat_stream(req: ChatRequest, channel: Channel<StreamChunk>) -> Result<(), String> {
    if req.provider.is_empty() {
        return Err("provider is required".to_string());
    }
    if req.model.is_empty() {
        return Err("model is required".to_string());
    }
    if req.messages.is_empty() {
        return Err("messages are required".to_string());
    }

    let config = ProviderConfig {
        base_url: req.base_url.unwrap_or_default(),
        model: req.model,
        timeout_seconds: 60,
        api_key: None,
        extra_headers: None,
    };

    const SYSTEM_PROMPT: &str = "You are Pragma, a helpful coding assistant. \
Use Markdown formatting in your answers: bold, italic, lists, and fenced code blocks. \
Always wrap code in markdown code fences with the correct language tag, e.g. ```typescript ... ```. \
When showing file contents, preserve the full code and include the language tag.";

    let messages: Vec<Message> = req
        .messages
        .into_iter()
        .map(|m| Message {
            role: match m.role.as_str() {
                "system" => Role::System,
                "assistant" => Role::Assistant,
                "tool" => Role::Tool,
                _ => Role::User,
            },
            content: m.content,
            tool_calls: m.tool_calls,
            tool_call_id: m.tool_call_id,
        })
        .collect();

    let mut messages_with_system = Vec::with_capacity(messages.len() + 1);
    messages_with_system.push(Message {
        role: Role::System,
        content: SYSTEM_PROMPT.to_string(),
        tool_calls: None,
        tool_call_id: None,
    });
    messages_with_system.extend(messages);

    let completion_req = CompletionRequest {
        messages: messages_with_system,
        temperature: req.temperature,
        max_tokens: req.max_tokens,
        stream: true,
        tools: req.tools,
    };

    let provider: Box<dyn AIProvider> = match req.provider.as_str() {
        "openai" | "deepseek" | "kimi" | "openrouter" => Box::new(
            OpenAIProvider::new_for_provider(config, &req.provider).map_err(|e| e.to_string())?,
        ),
        "custom" => Box::new(CustomProvider::new(config).map_err(|e| e.to_string())?),
        "gemini" => Box::new(GeminiProvider::new(config).map_err(|e| e.to_string())?),
        "anthropic" => Box::new(AnthropicProvider::new(config).map_err(|e| e.to_string())?),
        "ollama" => Box::new(OllamaProvider::new(config).map_err(|e| e.to_string())?),
        "copilot" => Box::new(CopilotProvider::new(config).map_err(|e| e.to_string())?),
        _ => return Err(format!("unsupported provider: {}", req.provider)),
    };

    let stream_id = req.stream_id.clone().unwrap_or_default();
    let cancel_token = if stream_id.is_empty() {
        None
    } else {
        Some(register_stream_cancellation(&stream_id))
    };

    let result: Result<(), String> = async {
        let mut rx = provider
            .stream_chunks_with_cancel(completion_req, cancel_token.clone())
            .await
            .map_err(|e| e.to_string())?;

        while let Some(result) = rx.recv().await {
            if cancel_token.as_ref().is_some_and(|t| t.is_cancelled()) {
                break;
            }
            match result {
                Ok(CompletionChunk {
                    content,
                    finish_reason,
                    tool_calls,
                }) => {
                    let done = finish_reason.as_deref() == Some("stop");
                    let text = if content.is_empty() && !done {
                        None
                    } else {
                        Some(content)
                    };
                    let chunk = StreamChunk {
                        text,
                        error: None,
                        done,
                        reasoning: None,
                        tool_calls,
                        tool_results: None,
                    };
                    if channel.send(chunk).is_err() {
                        break;
                    }
                    if done || finish_reason.as_deref() == Some("tool_calls") {
                        break;
                    }
                }
                Err(e) => {
                    let _ = channel.send(StreamChunk {
                        text: None,
                        error: Some(e.to_string()),
                        done: false,
                        reasoning: None,
                        tool_calls: None,
                        tool_results: None,
                    });
                    break;
                }
            }
        }

        Ok(())
    }
    .await;

    if !stream_id.is_empty() {
        unregister_stream_cancellation(&stream_id);
    }

    result
}

#[derive(Debug, Deserialize)]
pub struct CancelChatStreamRequest {
    pub stream_id: String,
}

#[tauri::command]
pub fn cancel_ai_chat_stream(req: CancelChatStreamRequest) -> Result<(), String> {
    let mut guard = lock_cancellations();
    if let Some(map) = guard.as_mut() {
        if let Some(token) = map.get(&req.stream_id) {
            token.cancel();
        }
    }
    Ok(())
}
