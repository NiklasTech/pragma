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
    /// Earlier suggestions at this position; a non-empty list asks for a different one.
    #[serde(default)]
    pub exclude: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct InlineCompletionResponse {
    pub suggestion: String,
}

const MAX_INLINE_CONTENT_LEN: usize = 50_000;
const MAX_EXCLUDED: usize = 5;
const MAX_EXCLUDED_LEN: usize = 4_000;

fn validate_exclude(exclude: &[String]) -> Result<(), String> {
    if exclude.len() > MAX_EXCLUDED {
        return Err(format!(
            "at most {MAX_EXCLUDED} earlier suggestions can be excluded"
        ));
    }
    if exclude.iter().any(|text| text.len() > MAX_EXCLUDED_LEN) {
        return Err("excluded suggestion too long".to_string());
    }
    Ok(())
}

fn build_prompt(req: &InlineCompletionRequest) -> String {
    let mut prompt = format!(
        "Complete the following code at the cursor position. Only output the raw code that should be inserted at the cursor. Do not wrap in markdown, do not add explanations.\n\nFile: {}\nCursor line: {}\nCursor column: {}\n\n{}",
        req.file_path, req.cursor_line, req.cursor_column, req.content
    );
    if !req.exclude.is_empty() {
        prompt.push_str("\n\nGive a different completion than each of these earlier ones:");
        for earlier in &req.exclude {
            prompt.push_str("\n---\n");
            prompt.push_str(earlier);
        }
        prompt.push_str("\n---");
    }
    prompt
}

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

    validate_exclude(&req.exclude)?;

    let prompt = build_prompt(&req);
    // Alternatives need some randomness, or the model repeats its first answer.
    let temperature = if req.exclude.is_empty() { 0.1 } else { 0.7 };

    let messages = vec![
        Message {
            role: Role::System,
            content: "You are a concise code completion assistant.".to_string(),
            tool_calls: None,
            tool_call_id: None,
            images: Vec::new(),
        },
        Message {
            role: Role::User,
            content: prompt,
            tool_calls: None,
            tool_call_id: None,
            images: Vec::new(),
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
        temperature: Some(temperature),
        max_tokens: Some(256),
        stream: false,
        tools: None,
    };

    let response = match req.provider.as_str() {
        "openai" | "deepseek" | "kimi" | "openrouter" | "grok" => {
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

#[cfg(test)]
mod tests {
    use super::*;

    fn request(exclude: Vec<String>) -> InlineCompletionRequest {
        InlineCompletionRequest {
            file_path: "src/main.rs".to_string(),
            content: "fn main() {".to_string(),
            cursor_line: 1,
            cursor_column: 12,
            provider: "openai".to_string(),
            model: "m".to_string(),
            base_url: None,
            exclude,
        }
    }

    #[test]
    fn prompt_lists_earlier_suggestions_only_for_alternatives() {
        let first = build_prompt(&request(Vec::new()));
        assert!(first.contains("fn main() {"));
        assert!(!first.contains("different completion"));

        let alternative = build_prompt(&request(vec!["println!()".to_string()]));
        assert!(alternative.contains("different completion"));
        assert!(alternative.ends_with("---\nprintln!()\n---"));
    }

    #[test]
    fn excluded_suggestions_are_bounded() {
        assert!(validate_exclude(&[]).is_ok());
        assert!(validate_exclude(&vec!["a".to_string(); MAX_EXCLUDED]).is_ok());
        assert!(validate_exclude(&vec!["a".to_string(); MAX_EXCLUDED + 1]).is_err());
        assert!(validate_exclude(&["x".repeat(MAX_EXCLUDED_LEN + 1)]).is_err());
    }

    #[test]
    fn older_requests_without_exclude_still_parse() {
        let req: InlineCompletionRequest = serde_json::from_value(serde_json::json!({
            "file_path": "a.ts", "content": "", "cursor_line": 1, "cursor_column": 1,
            "provider": "openai", "model": "m"
        }))
        .unwrap();
        assert!(req.exclude.is_empty());
    }
}
