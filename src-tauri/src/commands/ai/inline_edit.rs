use serde::Deserialize;

use crate::ai::{
    config::ProviderConfig,
    provider::{CompletionRequest, Message, Role},
};

use super::completion::complete_with_provider;

const MAX_SELECTION_LEN: usize = 20_000;
const MAX_CONTEXT_LEN: usize = 8_000;
const MAX_INSTRUCTION_LEN: usize = 2_000;

#[derive(Debug, Deserialize)]
pub struct InlineEditRequest {
    pub file_path: String,
    /// Code right before the selection, for context.
    pub before: String,
    pub selection: String,
    /// Code right after the selection, for context.
    pub after: String,
    pub instruction: String,
    pub provider: String,
    pub model: String,
    pub base_url: Option<String>,
}

fn validate(req: &InlineEditRequest) -> Result<(), String> {
    if req.provider.is_empty() || req.model.is_empty() {
        return Err("provider and model are required".to_string());
    }
    if req.instruction.trim().is_empty() {
        return Err("say what should change".to_string());
    }
    if req.instruction.len() > MAX_INSTRUCTION_LEN {
        return Err("the instruction is too long".to_string());
    }
    if req.selection.len() > MAX_SELECTION_LEN {
        return Err("the selection is too large for an inline edit".to_string());
    }
    if req.before.len() > MAX_CONTEXT_LEN || req.after.len() > MAX_CONTEXT_LEN {
        return Err("the surrounding code is too large".to_string());
    }
    Ok(())
}

fn build_prompt(req: &InlineEditRequest) -> String {
    format!(
        "File: {}\n\nCode before the selection:\n<before>\n{}\n</before>\n\nSelection:\n<selection>\n{}\n</selection>\n\nCode after the selection:\n<after>\n{}\n</after>\n\nInstruction: {}\n\nReply with only the code that replaces the selection. Keep its indentation and style. No explanation, no markdown fences, no tags.",
        req.file_path, req.before, req.selection, req.after, req.instruction
    )
}

/// The model's code without markdown fences or tags, ending with a newline exactly when the selection did.
fn fit_reply(reply: &str, selection: &str) -> String {
    let mut text = reply.trim_matches('\n').to_string();
    for tag in ["<selection>", "</selection>"] {
        text = text.replace(tag, "");
    }
    let lines: Vec<&str> = text.lines().collect();
    if lines.len() >= 2
        && lines[0].trim_start().starts_with("```")
        && lines[lines.len() - 1].trim() == "```"
    {
        text = lines[1..lines.len() - 1].join("\n");
    }
    let text = text.trim_matches('\n');
    if selection.ends_with('\n') {
        format!("{text}\n")
    } else {
        text.to_string()
    }
}

/// Rewrites the selection as the instruction says and returns the new code.
#[tauri::command]
pub async fn ai_inline_edit(req: InlineEditRequest) -> Result<String, String> {
    validate(&req)?;
    let messages = vec![
        Message {
            role: Role::System,
            content:
                "You rewrite the selected code as instructed and reply with the new code only."
                    .to_string(),
            tool_calls: None,
            tool_call_id: None,
            images: Vec::new(),
        },
        Message {
            role: Role::User,
            content: build_prompt(&req),
            tool_calls: None,
            tool_call_id: None,
            images: Vec::new(),
        },
    ];
    let config = ProviderConfig {
        base_url: req.base_url.clone().unwrap_or_default(),
        model: req.model.clone(),
        timeout_seconds: 90,
        api_key: None,
        extra_headers: None,
    };
    let completion_req = CompletionRequest {
        messages,
        temperature: Some(0.2),
        max_tokens: Some(4096),
        stream: false,
        tools: None,
    };
    let reply = complete_with_provider(&req.provider, config, completion_req).await?;
    Ok(fit_reply(&reply, &req.selection))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request(instruction: &str, selection: &str) -> InlineEditRequest {
        InlineEditRequest {
            file_path: "a.rs".to_string(),
            before: String::new(),
            selection: selection.to_string(),
            after: String::new(),
            instruction: instruction.to_string(),
            provider: "openai".to_string(),
            model: "m".to_string(),
            base_url: None,
        }
    }

    #[test]
    fn rejects_an_empty_instruction_and_a_huge_selection() {
        assert!(validate(&request("  ", "x")).is_err());
        assert!(validate(&request("shorten", &"x".repeat(MAX_SELECTION_LEN + 1))).is_err());
        assert!(validate(&request("shorten", "let a = 1;")).is_ok());
    }

    #[test]
    fn strips_fences_and_matches_the_trailing_newline() {
        let reply = "```rust\nlet a = b.unwrap_or(1);\n```";
        assert_eq!(
            fit_reply(reply, "let a = x;\n"),
            "let a = b.unwrap_or(1);\n"
        );
        assert_eq!(fit_reply("let a = 1;\n\n", "let a = 2;"), "let a = 1;");
    }

    #[test]
    fn keeps_the_indentation_of_the_first_line() {
        assert_eq!(
            fit_reply("    foo();\n    bar();", "    x();\n"),
            "    foo();\n    bar();\n"
        );
    }

    #[test]
    fn prompt_holds_the_selection_and_the_instruction() {
        let prompt = build_prompt(&request("use a match", "if a { b }"));
        assert!(prompt.contains("<selection>\nif a { b }\n</selection>"));
        assert!(prompt.contains("Instruction: use a match"));
    }
}
