use serde::{Deserialize, Serialize};

use crate::ai::{
    config::ProviderConfig,
    keychain,
    provider::{AIProvider, CompletionRequest, Message, Role},
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
