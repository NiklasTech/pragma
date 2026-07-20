use serde::{Deserialize, Serialize};

use crate::ai::{
    config::ProviderConfig,
    provider::{AIProvider, CompletionRequest, Message, Role},
    providers::{
        anthropic::AnthropicProvider, copilot::CopilotProvider, custom::CustomProvider,
        gemini::GeminiProvider, ollama::OllamaProvider, openai::OpenAIProvider,
    },
};

use super::types::{ChatChoice, ChatRequest, ChatResponse, ChatResponseMessage};

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
                "tool" => Role::Tool,
                _ => Role::User,
            },
            content: m.content,
            tool_calls: m.tool_calls,
            tool_call_id: m.tool_call_id,
        })
        .collect();

    let completion_req = CompletionRequest {
        messages,
        temperature: req.temperature,
        max_tokens: req.max_tokens,
        stream: false,
        tools: req.tools,
    };

    let response = match req.provider.as_str() {
        "openai" | "deepseek" | "kimi" | "openrouter" => {
            let provider = OpenAIProvider::new_for_provider(config, &req.provider)
                .map_err(|e| e.to_string())?;
            provider
                .complete(completion_req)
                .await
                .map_err(|e| e.to_string())?
        }
        "custom" => {
            let provider = CustomProvider::new(config).map_err(|e| e.to_string())?;
            provider
                .complete(completion_req)
                .await
                .map_err(|e| e.to_string())?
        }
        "gemini" => {
            let provider = GeminiProvider::new(config).map_err(|e| e.to_string())?;
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
        "copilot" => {
            let provider = CopilotProvider::new(config).map_err(|e| e.to_string())?;
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

// ─── Test Connection ─────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct TestConnectionResponse {
    pub ok: bool,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn ai_test_connection(req: ChatRequest) -> Result<TestConnectionResponse, String> {
    if req.provider.is_empty() {
        return Ok(TestConnectionResponse {
            ok: false,
            error: Some("provider is required".to_string()),
        });
    }
    if req.model.is_empty() {
        return Ok(TestConnectionResponse {
            ok: false,
            error: Some("model is required".to_string()),
        });
    }

    let config = ProviderConfig {
        base_url: req.base_url.unwrap_or_default(),
        model: req.model,
        timeout_seconds: 30,
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
                "tool" => Role::Tool,
                _ => Role::User,
            },
            content: m.content,
            tool_calls: m.tool_calls,
            tool_call_id: m.tool_call_id,
        })
        .collect();

    // Ensure at least one user message exists; use a tiny prompt.
    let messages = if messages.is_empty() {
        vec![Message {
            role: Role::User,
            content: "hi".to_string(),
            tool_calls: None,
            tool_call_id: None,
        }]
    } else {
        messages
    };

    let completion_req = CompletionRequest {
        messages,
        temperature: Some(0.1),
        max_tokens: Some(8),
        stream: false,
        tools: None,
    };

    let result = match req.provider.as_str() {
        "openai" | "deepseek" | "kimi" | "openrouter" => {
            let provider = OpenAIProvider::new_for_provider(config, &req.provider)
                .map_err(|e| e.to_string())?;
            provider.complete(completion_req).await
        }
        "custom" => {
            let provider = CustomProvider::new(config).map_err(|e| e.to_string())?;
            provider.complete(completion_req).await
        }
        "gemini" => {
            let provider = GeminiProvider::new(config).map_err(|e| e.to_string())?;
            provider.complete(completion_req).await
        }
        "anthropic" => {
            let provider = AnthropicProvider::new(config).map_err(|e| e.to_string())?;
            provider.complete(completion_req).await
        }
        "ollama" => {
            let provider = OllamaProvider::new(config).map_err(|e| e.to_string())?;
            provider.complete(completion_req).await
        }
        "copilot" => {
            let provider = CopilotProvider::new(config).map_err(|e| e.to_string())?;
            provider.complete(completion_req).await
        }
        _ => {
            return Ok(TestConnectionResponse {
                ok: false,
                error: Some(format!("unsupported provider: {}", req.provider)),
            })
        }
    };

    match result {
        Ok(_) => Ok(TestConnectionResponse {
            ok: true,
            error: None,
        }),
        Err(e) => Ok(TestConnectionResponse {
            ok: false,
            error: Some(e.to_string()),
        }),
    }
}

// ─── List Models ─────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListModelsRequest {
    pub provider: String,
    pub base_url: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ModelInfoResponse {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context_window: Option<usize>,
    pub supports_streaming: bool,
    pub supports_vision: bool,
}

#[tauri::command]
pub async fn ai_list_models(req: ListModelsRequest) -> Result<Vec<ModelInfoResponse>, String> {
    if req.provider.is_empty() {
        return Err("provider is required".to_string());
    }

    let config = ProviderConfig {
        base_url: req.base_url.unwrap_or_default(),
        model: String::new(),
        timeout_seconds: 30,
        api_key: None,
        extra_headers: None,
    };

    let models = match req.provider.as_str() {
        "openai" | "deepseek" | "kimi" | "openrouter" => {
            let provider = OpenAIProvider::new_for_provider(config, &req.provider)
                .map_err(|e| e.to_string())?;
            provider.list_models().await
        }
        "custom" => {
            let provider = CustomProvider::new(config).map_err(|e| e.to_string())?;
            provider.list_models().await
        }
        "gemini" => {
            let provider = GeminiProvider::new(config).map_err(|e| e.to_string())?;
            provider.list_models().await
        }
        "anthropic" => {
            let provider = AnthropicProvider::new(config).map_err(|e| e.to_string())?;
            provider.list_models().await
        }
        "ollama" => {
            let provider = OllamaProvider::new(config).map_err(|e| e.to_string())?;
            provider.list_models().await
        }
        "copilot" => {
            let provider = CopilotProvider::new(config).map_err(|e| e.to_string())?;
            provider.list_models().await
        }
        _ => return Err(format!("unsupported provider: {}", req.provider)),
    }
    .map_err(|e| e.to_string())?;

    Ok(models
        .into_iter()
        .map(|m| ModelInfoResponse {
            id: m.id,
            name: m.name,
            context_window: m.context_window,
            supports_streaming: m.supports_streaming,
            supports_vision: m.supports_vision,
        })
        .collect())
}

// ─── Chat Title Generation ───────────────────────────────────────────────────

fn strip_reasoning_tags(text: &str) -> String {
    let tags = [
        ("<thinking>", "</thinking>"),
        ("<reasoning>", "</reasoning>"),
        ("<think>", "</think>"),
    ];
    let mut result = text.to_string();
    for (open, close) in tags {
        let mut cleaned = String::with_capacity(result.len());
        let mut rest = result.as_str();
        while let Some(start) = rest.find(open) {
            cleaned.push_str(&rest[..start]);
            if let Some(end) = rest[start..].find(close) {
                rest = &rest[start + end + close.len()..];
            } else {
                rest = &rest[start + open.len()..];
                break;
            }
        }
        cleaned.push_str(rest);
        result = cleaned;
    }
    result.trim().to_string()
}

#[derive(Debug, Deserialize)]
pub struct GenerateChatTitleRequest {
    pub provider: String,
    pub model: String,
    pub base_url: Option<String>,
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct GenerateChatTitleResponse {
    pub title: String,
}

const MAX_TITLE_INPUT_LEN: usize = 800;
const MAX_TITLE_OUTPUT_LEN: usize = 60;

#[tauri::command]
pub async fn ai_generate_chat_title(
    req: GenerateChatTitleRequest,
) -> Result<GenerateChatTitleResponse, String> {
    if req.provider.is_empty() {
        return Err("provider is required".to_string());
    }
    if req.model.is_empty() {
        return Err("model is required".to_string());
    }

    let message = req.message.trim();
    if message.is_empty() {
        return Ok(GenerateChatTitleResponse {
            title: "New Chat".to_string(),
        });
    }

    let truncated_message = if message.len() > MAX_TITLE_INPUT_LEN {
        format!("{}…", &message[..MAX_TITLE_INPUT_LEN])
    } else {
        message.to_string()
    };

    let system_message = "You are a helpful assistant that creates concise chat titles. Given the user's first message, produce a very short title (3-6 words) that summarizes the topic. Output ONLY the title. No quotes, no markdown, no explanations, no reasoning tags, no thinking blocks.".to_string();

    let user_message = format!(
        "Create a short title for this chat:\n\n{}",
        truncated_message
    );

    let messages = vec![
        Message {
            role: Role::System,
            content: system_message,
            tool_calls: None,
            tool_call_id: None,
        },
        Message {
            role: Role::User,
            content: user_message,
            tool_calls: None,
            tool_call_id: None,
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
        temperature: Some(0.3),
        max_tokens: Some(32),
        stream: false,
        tools: None,
    };

    let response = match req.provider.as_str() {
        "openai" | "deepseek" | "kimi" | "openrouter" => {
            let provider = OpenAIProvider::new_for_provider(config, &req.provider)
                .map_err(|e| e.to_string())?;
            provider.complete(completion_req).await
        }
        "custom" => {
            let provider = CustomProvider::new(config).map_err(|e| e.to_string())?;
            provider.complete(completion_req).await
        }
        "gemini" => {
            let provider = GeminiProvider::new(config).map_err(|e| e.to_string())?;
            provider.complete(completion_req).await
        }
        "anthropic" => {
            let provider = AnthropicProvider::new(config).map_err(|e| e.to_string())?;
            provider.complete(completion_req).await
        }
        "ollama" => {
            let provider = OllamaProvider::new(config).map_err(|e| e.to_string())?;
            provider.complete(completion_req).await
        }
        "copilot" => {
            let provider = CopilotProvider::new(config).map_err(|e| e.to_string())?;
            provider.complete(completion_req).await
        }
        _ => return Err(format!("unsupported provider: {}", req.provider)),
    }
    .map_err(|e| e.to_string())?;

    let cleaned_content = strip_reasoning_tags(&response.content);

    let title = cleaned_content
        .lines()
        .find(|line| !line.trim().is_empty())
        .unwrap_or("")
        .trim()
        .trim_matches(|c| c == '"' || c == '\'' || c == '`' || c == '*' || c == '#' || c == '-')
        .to_string();

    let title = if title.len() > MAX_TITLE_OUTPUT_LEN {
        format!("{}…", &title[..MAX_TITLE_OUTPUT_LEN])
    } else {
        title
    };

    let title = if title.is_empty() {
        "New Chat".to_string()
    } else {
        title
    };

    Ok(GenerateChatTitleResponse { title })
}
