use serde::{Deserialize, Serialize};

use tauri::ipc::Channel;

use crate::ai::{
    config::ProviderConfig,
    keychain,
    provider::{AIProvider, CompletionChunk, CompletionRequest, Message, Role},
    providers::{anthropic::AnthropicProvider, ollama::OllamaProvider, openai::OpenAIProvider},
};

// ─── Chat Request / Response ─────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ChatRequest {
    pub provider: String,
    pub model: String,
    pub base_url: Option<String>,
    pub messages: Vec<ChatMessageInput>,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct ChatMessageInput {
    pub role: String,
    pub content: String,
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

#[derive(Debug, Serialize)]
pub struct KeyStatus {
    pub provider: String,
    pub has_key: bool,
    pub masked: String,
}

#[derive(Debug, Deserialize)]
pub struct StoreKeyRequest {
    pub provider: String,
    pub key: String,
}

#[derive(Debug, Deserialize)]
pub struct ProviderRequest {
    pub provider: String,
}

fn mask_key(key: &str) -> String {
    if key.len() <= 8 {
        return "****".to_string();
    }
    format!("{}...{}", &key[..4], &key[key.len() - 4..])
}

#[tauri::command]
pub async fn ai_store_key(req: StoreKeyRequest) -> Result<(), String> {
    if req.provider.is_empty() {
        return Err("provider is required".to_string());
    }
    if req.key.is_empty() {
        return Err("key is required".to_string());
    }

    keychain::set_api_key(&req.provider, &req.key).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ai_get_key(req: ProviderRequest) -> Result<Option<String>, String> {
    if req.provider.is_empty() {
        return Err("provider is required".to_string());
    }

    keychain::get_api_key(&req.provider).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ai_key_status(req: ProviderRequest) -> Result<KeyStatus, String> {
    if req.provider.is_empty() {
        return Err("provider is required".to_string());
    }

    let (has_key, masked) = match keychain::get_api_key(&req.provider) {
        Ok(Some(key)) => (true, mask_key(&key)),
        _ => (false, String::new()),
    };

    Ok(KeyStatus {
        provider: req.provider,
        has_key,
        masked,
    })
}

#[tauri::command]
pub async fn ai_delete_key(req: ProviderRequest) -> Result<(), String> {
    if req.provider.is_empty() {
        return Err("provider is required".to_string());
    }

    keychain::delete_api_key(&req.provider).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ai_chat(req: ChatRequest) -> Result<ChatResponse, String> {
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

    let messages: Vec<Message> = req
        .messages
        .into_iter()
        .map(|m| Message {
            role: match m.role.as_str() {
                "system" => Role::System,
                "assistant" => Role::Assistant,
                _ => Role::User,
            },
            content: m.content,
        })
        .collect();

    let completion_req = CompletionRequest {
        messages,
        temperature: req.temperature,
        max_tokens: req.max_tokens,
        stream: false,
    };

    let response = match req.provider.as_str() {
        "openai" | "deepseek" | "kimi" | "custom" => {
            let provider = OpenAIProvider::new(config).map_err(|e| e.to_string())?;
            provider
                .complete(completion_req)
                .await
                .map_err(|e| e.to_string())?
        }
        "anthropic" => {
            let provider = AnthropicProvider::new(config).map_err(|e| e.to_string())?;
            provider
                .complete(completion_req)
                .await
                .map_err(|e| e.to_string())?
        }
        "ollama" => {
            let provider = OllamaProvider::new(config).map_err(|e| e.to_string())?;
            provider
                .complete(completion_req)
                .await
                .map_err(|e| e.to_string())?
        }
        _ => return Err(format!("unsupported provider: {}", req.provider)),
    };

    Ok(ChatResponse {
        id: format!("chatcmpl-{}", uuid::Uuid::new_v4()),
        object: "chat.completion".to_string(),
        created: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs(),
        model: response.model,
        choices: vec![ChatChoice {
            index: 0,
            message: ChatResponseMessage {
                role: "assistant".to_string(),
                content: response.content,
            },
            finish_reason: "stop".to_string(),
        }],
    })
}

// ─── Inline Completion ───────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct InlineCompletionRequest {
    pub file_path: String,
    pub content: String,
    pub cursor_line: usize,
    pub cursor_column: usize,
    pub provider: String,
    pub model: String,
    pub base_url: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct InlineCompletionResponse {
    pub suggestion: String,
}

const MAX_INLINE_CONTENT_LEN: usize = 50_000;

#[tauri::command]
pub async fn ai_inline_completion(
    req: InlineCompletionRequest,
) -> Result<InlineCompletionResponse, String> {
    if req.provider.is_empty() {
        return Err("provider is required".to_string());
    }
    if req.model.is_empty() {
        return Err("model is required".to_string());
    }
    if req.content.len() > MAX_INLINE_CONTENT_LEN {
        return Err("content too large for inline completion".to_string());
    }

    let prompt = format!(
        "Complete the following code at the cursor position. Only output the raw code that should be inserted at the cursor. Do not wrap in markdown, do not add explanations.\n\nFile: {}\nCursor line: {}\nCursor column: {}\n\n{}",
        req.file_path, req.cursor_line, req.cursor_column, req.content
    );

    let messages = vec![
        Message {
            role: Role::System,
            content: "You are a concise code completion assistant.".to_string(),
        },
        Message {
            role: Role::User,
            content: prompt,
        },
    ];

    let config = ProviderConfig {
        base_url: req.base_url.unwrap_or_default(),
        model: req.model,
        timeout_seconds: 30,
        api_key: None,
        extra_headers: None,
    };

    let completion_req = CompletionRequest {
        messages,
        temperature: Some(0.1),
        max_tokens: Some(256),
        stream: false,
    };

    let response = match req.provider.as_str() {
        "openai" | "deepseek" | "kimi" | "custom" => {
            let provider = OpenAIProvider::new(config).map_err(|e| e.to_string())?;
            provider
                .complete(completion_req)
                .await
                .map_err(|e| e.to_string())?
        }
        "anthropic" => {
            let provider = AnthropicProvider::new(config).map_err(|e| e.to_string())?;
            provider
                .complete(completion_req)
                .await
                .map_err(|e| e.to_string())?
        }
        "ollama" => {
            let provider = OllamaProvider::new(config).map_err(|e| e.to_string())?;
            provider
                .complete(completion_req)
                .await
                .map_err(|e| e.to_string())?
        }
        _ => return Err(format!("unsupported provider: {}", req.provider)),
    };

    Ok(InlineCompletionResponse {
        suggestion: response.content.trim().to_string(),
    })
}

// ─── Streaming Chat ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, serde::Serialize)]
pub struct StreamChunk {
    pub text: Option<String>,
    pub error: Option<String>,
    pub done: bool,
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
                _ => Role::User,
            },
            content: m.content,
        })
        .collect();

    let mut messages_with_system = Vec::with_capacity(messages.len() + 1);
    messages_with_system.push(Message {
        role: Role::System,
        content: SYSTEM_PROMPT.to_string(),
    });
    messages_with_system.extend(messages);

    let completion_req = CompletionRequest {
        messages: messages_with_system,
        temperature: req.temperature,
        max_tokens: req.max_tokens,
        stream: true,
    };

    let provider: Box<dyn AIProvider> = match req.provider.as_str() {
        "openai" | "deepseek" | "kimi" | "custom" => {
            Box::new(OpenAIProvider::new(config).map_err(|e| e.to_string())?)
        }
        "anthropic" => Box::new(AnthropicProvider::new(config).map_err(|e| e.to_string())?),
        "ollama" => Box::new(OllamaProvider::new(config).map_err(|e| e.to_string())?),
        _ => return Err(format!("unsupported provider: {}", req.provider)),
    };

    let mut rx = provider
        .stream_chunks(completion_req)
        .await
        .map_err(|e| e.to_string())?;

    while let Some(result) = rx.recv().await {
        match result {
            Ok(CompletionChunk {
                content,
                finish_reason,
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
                };
                if channel.send(chunk).is_err() {
                    break;
                }
                if done {
                    break;
                }
            }
            Err(e) => {
                let _ = channel.send(StreamChunk {
                    text: None,
                    error: Some(e.to_string()),
                    done: false,
                });
                break;
            }
        }
    }

    Ok(())
}

// ─── Terminal Command Suggestion ─────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct TerminalSuggestionRequest {
    pub provider: String,
    pub model: String,
    pub base_url: Option<String>,
    pub prompt: String,
    pub cwd: Option<String>,
    pub language: Option<String>,
    pub last_output: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct TerminalSuggestionResponse {
    pub suggestion: String,
}

const MAX_TERMINAL_OUTPUT_LEN: usize = 1_000;
const MAX_TERMINAL_PROMPT_LEN: usize = 512;

#[tauri::command]
pub async fn ai_terminal_suggestion(
    req: TerminalSuggestionRequest,
) -> Result<TerminalSuggestionResponse, String> {
    if req.provider.is_empty() {
        return Err("provider is required".to_string());
    }
    if req.model.is_empty() {
        return Err("model is required".to_string());
    }

    let prompt = req.prompt.trim().to_string();
    if prompt.is_empty() {
        return Ok(TerminalSuggestionResponse {
            suggestion: String::new(),
        });
    }
    if prompt.len() > MAX_TERMINAL_PROMPT_LEN {
        return Err("prompt too long".to_string());
    }

    let system_message = "You are a concise shell command completion assistant. The user is typing a command in a terminal. Given the partial command and context, output ONLY the completed shell command. Do not repeat what the user already typed. Do not add markdown, explanations, quotes, or commentary. Output raw text only.".to_string();

    let mut context_parts: Vec<String> = Vec::new();
    if let Some(cwd) = &req.cwd {
        context_parts.push(format!("Current directory: {cwd}"));
    }
    if let Some(language) = &req.language {
        context_parts.push(format!("Active editor language: {language}"));
    }
    if let Some(last_output) = &req.last_output {
        let truncated = if last_output.len() > MAX_TERMINAL_OUTPUT_LEN {
            &last_output[last_output.len() - MAX_TERMINAL_OUTPUT_LEN..]
        } else {
            last_output.as_str()
        };
        context_parts.push(format!("Last terminal output:\n{truncated}"));
    }

    let context = if context_parts.is_empty() {
        String::new()
    } else {
        format!("\n\nContext:\n{}", context_parts.join("\n"))
    };

    let user_message = format!(
        "Complete the following shell command.{}\n\nPartial command:\n{}",
        context, prompt
    );

    let messages = vec![
        Message {
            role: Role::System,
            content: system_message,
        },
        Message {
            role: Role::User,
            content: user_message,
        },
    ];

    let config = ProviderConfig {
        base_url: req.base_url.unwrap_or_default(),
        model: req.model,
        timeout_seconds: 15,
        api_key: None,
        extra_headers: None,
    };

    let completion_req = CompletionRequest {
        messages,
        temperature: Some(0.1),
        max_tokens: Some(64),
        stream: false,
    };

    let response = match req.provider.as_str() {
        "openai" | "deepseek" | "kimi" | "custom" => {
            let provider = OpenAIProvider::new(config).map_err(|e| e.to_string())?;
            provider
                .complete(completion_req)
                .await
                .map_err(|e| e.to_string())?
        }
        "anthropic" => {
            let provider = AnthropicProvider::new(config).map_err(|e| e.to_string())?;
            provider
                .complete(completion_req)
                .await
                .map_err(|e| e.to_string())?
        }
        "ollama" => {
            let provider = OllamaProvider::new(config).map_err(|e| e.to_string())?;
            provider
                .complete(completion_req)
                .await
                .map_err(|e| e.to_string())?
        }
        _ => return Err(format!("unsupported provider: {}", req.provider)),
    };

    let suggestion = response
        .content
        .lines()
        .next()
        .unwrap_or("")
        .trim()
        .to_string();

    // If the model repeats the prompt prefix, strip it so we only suggest the suffix.
    let suggestion = if suggestion.starts_with(&prompt) {
        suggestion[prompt.len()..].trim_start().to_string()
    } else {
        suggestion
    };

    Ok(TerminalSuggestionResponse { suggestion })
}
