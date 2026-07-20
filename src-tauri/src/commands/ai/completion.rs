use serde::{Deserialize, Serialize};

use crate::ai::{
    config::ProviderConfig,
    provider::{AIProvider, CompletionRequest, Message, Role},
    providers::{
        anthropic::AnthropicProvider, copilot::CopilotProvider, custom::CustomProvider,
        gemini::GeminiProvider, ollama::OllamaProvider, openai::OpenAIProvider,
    },
};

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
            tool_calls: None,
            tool_call_id: None,
        },
        Message {
            role: Role::User,
            content: prompt,
            tool_calls: None,
            tool_call_id: None,
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
        tools: None,
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

    Ok(InlineCompletionResponse {
        suggestion: response.content.trim().to_string(),
    })
}
