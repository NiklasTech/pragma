use serde::{Deserialize, Serialize};

use crate::ai::{
    config::ProviderConfig,
    provider::{CompletionRequest, Message, Role},
};

use super::completion::complete_with_provider;

const MAX_CONTENT_LEN: usize = 50_000;
const MAX_RECENT_EDITS: usize = 5;
const MAX_EDIT_TEXT_LEN: usize = 2_000;
const MAX_FIND_LEN: usize = 500;

/// One change the user just made, by line.
#[derive(Debug, Deserialize)]
pub struct RecentEdit {
    pub line: usize,
    pub removed: String,
    pub inserted: String,
}

#[derive(Debug, Deserialize)]
pub struct NextEditRequest {
    pub file_path: String,
    pub content: String,
    pub cursor_line: usize,
    pub recent_edits: Vec<RecentEdit>,
    pub provider: String,
    pub model: String,
    pub base_url: Option<String>,
}

/// Replace `find` on `line` with `replace`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct NextEdit {
    pub line: usize,
    pub find: String,
    pub replace: String,
}

fn validate(req: &NextEditRequest) -> Result<(), String> {
    if req.provider.is_empty() || req.model.is_empty() {
        return Err("provider and model are required".to_string());
    }
    if req.content.len() > MAX_CONTENT_LEN {
        return Err("content too large for next edit prediction".to_string());
    }
    if req.recent_edits.is_empty() || req.recent_edits.len() > MAX_RECENT_EDITS {
        return Err(format!("send 1 to {MAX_RECENT_EDITS} recent edits"));
    }
    if req.recent_edits.iter().any(|edit| {
        edit.line == 0
            || edit.removed.len() > MAX_EDIT_TEXT_LEN
            || edit.inserted.len() > MAX_EDIT_TEXT_LEN
    }) {
        return Err("recent edits must have a line and short text".to_string());
    }
    Ok(())
}

fn build_prompt(req: &NextEditRequest) -> String {
    let numbered: Vec<String> = req
        .content
        .lines()
        .enumerate()
        .map(|(index, line)| format!("{:>5} | {line}", index + 1))
        .collect();
    let mut prompt = format!(
        "File: {}\nCursor line: {}\n\nRecent edits, oldest first:\n",
        req.file_path, req.cursor_line
    );
    for edit in &req.recent_edits {
        prompt.push_str(&format!(
            "- line {}: removed {:?}, inserted {:?}\n",
            edit.line, edit.removed, edit.inserted
        ));
    }
    prompt.push_str(
        "\nPredict the single next edit elsewhere in this file that follows from the recent edits, \
for example the remaining usages of a renamed name or a call site that needs the new argument. \
Reply with JSON only, no markdown: {\"line\": <line number>, \"find\": \"<exact text on that line>\", \
\"replace\": \"<new text>\"}. Reply {\"none\": true} when no edit clearly follows.\n\n",
    );
    prompt.push_str(&numbered.join("\n"));
    prompt
}

/// Reads the model reply; anything that is not one clear, bounded edit is no prediction.
fn parse_reply(reply: &str) -> Option<NextEdit> {
    let trimmed = reply.trim();
    let start = trimmed.find('{')?;
    let end = trimmed.rfind('}')?;
    let edit: NextEdit = serde_json::from_str(trimmed.get(start..=end)?).ok()?;
    let valid = edit.line > 0
        && !edit.find.is_empty()
        && edit.find.len() <= MAX_FIND_LEN
        && edit.replace.len() <= MAX_EDIT_TEXT_LEN
        && edit.find != edit.replace
        && !edit.find.contains('\n')
        && !edit.replace.contains('\n');
    valid.then_some(edit)
}

/// The edit the user most likely makes next, or `None` when nothing clearly follows.
#[tauri::command]
pub async fn ai_next_edit(req: NextEditRequest) -> Result<Option<NextEdit>, String> {
    validate(&req)?;
    let prompt = build_prompt(&req);

    let messages = vec![
        Message {
            role: Role::System,
            content: "You predict a programmer's next code edit and answer with JSON only."
                .to_string(),
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
        temperature: Some(0.1),
        max_tokens: Some(256),
        stream: false,
        tools: None,
    };

    let reply = complete_with_provider(&req.provider, config, completion_req).await?;
    Ok(parse_reply(&reply))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request(edits: Vec<RecentEdit>) -> NextEditRequest {
        NextEditRequest {
            file_path: "a.ts".to_string(),
            content: "const total = 1;\nlog(total);".to_string(),
            cursor_line: 1,
            recent_edits: edits,
            provider: "openai".to_string(),
            model: "m".to_string(),
            base_url: None,
        }
    }

    fn rename() -> RecentEdit {
        RecentEdit {
            line: 1,
            removed: "count".to_string(),
            inserted: "total".to_string(),
        }
    }

    #[test]
    fn prompt_numbers_lines_and_lists_edits() {
        let prompt = build_prompt(&request(vec![rename()]));
        assert!(prompt.contains("    2 | log(total);"));
        assert!(prompt.contains("line 1: removed \"count\", inserted \"total\""));
    }

    #[test]
    fn requests_are_bounded() {
        assert!(validate(&request(vec![rename()])).is_ok());
        assert!(validate(&request(Vec::new())).is_err());
        assert!(validate(&request((0..6).map(|_| rename()).collect())).is_err());
        let mut zero = rename();
        zero.line = 0;
        assert!(validate(&request(vec![zero])).is_err());
    }

    #[test]
    fn replies_become_one_bounded_edit() {
        assert_eq!(
            parse_reply("```json\n{\"line\": 2, \"find\": \"count\", \"replace\": \"total\"}\n```"),
            Some(NextEdit {
                line: 2,
                find: "count".to_string(),
                replace: "total".to_string()
            })
        );
        assert_eq!(parse_reply("{\"none\": true}"), None);
        assert_eq!(parse_reply("no idea"), None);
        assert_eq!(
            parse_reply("{\"line\": 0, \"find\": \"a\", \"replace\": \"b\"}"),
            None
        );
        assert_eq!(
            parse_reply("{\"line\": 3, \"find\": \"a\", \"replace\": \"a\"}"),
            None
        );
        assert_eq!(
            parse_reply("{\"line\": 3, \"find\": \"a\\nb\", \"replace\": \"c\"}"),
            None
        );
    }
}
