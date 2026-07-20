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
        timeout_seconds: 5,
        api_key: None,
        extra_headers: None,
    };

    let completion_req = CompletionRequest {
        messages,
        temperature: Some(0.1),
        max_tokens: Some(64),
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
