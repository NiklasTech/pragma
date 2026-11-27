use serde_json::Value;

use super::types::{ContentBlock, ToolCallContent};
use crate::ai::provider::{FunctionCall, ToolCall};
use crate::commands::ai::{StreamChunk, ToolCallTitle, ToolResult};

/// One `tool_call` or `tool_call_update` of an ACP agent.
pub struct ToolCallReport {
    pub id: String,
    pub title: Option<String>,
    pub status: Option<String>,
    pub meta: Option<Value>,
    pub raw_input: Option<Value>,
    pub raw_output: Option<Value>,
    pub content: Option<Vec<ToolCallContent>>,
}

/// The CLI's own tool name, such as `Bash`, which claude-agent-acp sends in `_meta`.
fn meta_tool_name(meta: Option<&Value>) -> Option<String> {
    meta?
        .pointer("/claudeCode/toolName")?
        .as_str()
        .filter(|name| !name.is_empty())
        .map(str::to_string)
}

fn first_text(contents: &[ToolCallContent]) -> Option<String> {
    contents.iter().find_map(|c| match &c.content {
        Some(ContentBlock::Text { text }) => Some(text.clone()),
        _ => None,
    })
}

fn block_text(item: &Value) -> Option<String> {
    let text = match item.get("type")?.as_str()? {
        "text" => item.get("text"),
        "tool_reference" => item.get("tool_name"),
        _ => None,
    }?;
    text.as_str().map(str::to_string)
}

/// Text of a raw output: content blocks become their text, other JSON stays JSON.
fn value_text(value: Value) -> String {
    match value {
        Value::String(text) => text,
        Value::Array(items) => {
            let texts: Option<Vec<String>> = items.iter().map(block_text).collect();
            match texts {
                Some(texts) if !texts.is_empty() => texts.join("\n"),
                _ => Value::Array(items).to_string(),
            }
        }
        other => other.to_string(),
    }
}

/// A tool call as stream chunk when it brings a title or input: its name (empty when the
/// agent sends no tool name or title), input and title. A finished call carries its result.
pub fn tool_call_chunk(report: ToolCallReport) -> StreamChunk {
    let is_completed = report.status.as_deref() == Some("completed");
    let is_failed = report.status.as_deref() == Some("failed");
    let title = report.title.filter(|title| !title.trim().is_empty());
    let mut chunk = StreamChunk::default();

    if title.is_some() || report.raw_input.is_some() {
        let arguments = report
            .raw_input
            .map(value_text)
            .or_else(|| report.content.as_deref().and_then(first_text))
            .unwrap_or_default();
        chunk.tool_calls = Some(vec![ToolCall {
            id: report.id.clone(),
            r#type: "function".to_string(),
            function: FunctionCall {
                name: meta_tool_name(report.meta.as_ref())
                    .or_else(|| title.clone())
                    .unwrap_or_default(),
                arguments,
            },
        }]);
        chunk.tool_titles = title.map(|title| {
            vec![ToolCallTitle {
                tool_call_id: report.id.clone(),
                title,
            }]
        });
    }

    if is_completed || is_failed {
        let output = report
            .raw_output
            .map(value_text)
            .or_else(|| report.content.as_deref().and_then(first_text))
            .unwrap_or_default();
        chunk.tool_results = Some(vec![ToolResult {
            tool_call_id: report.id,
            output,
            is_error: is_failed,
        }]);
    }

    chunk
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn report(id: &str) -> ToolCallReport {
        ToolCallReport {
            id: id.to_string(),
            title: None,
            status: None,
            meta: None,
            raw_input: None,
            raw_output: None,
            content: None,
        }
    }

    #[test]
    fn uses_the_cli_tool_name_and_keeps_the_title() {
        let chunk = tool_call_chunk(ToolCallReport {
            title: Some("ls -la".to_string()),
            meta: Some(json!({ "claudeCode": { "toolName": "Bash" } })),
            raw_input: Some(json!({ "command": "ls -la" })),
            ..report("call-1")
        });

        let call = &chunk.tool_calls.unwrap()[0];
        assert_eq!(call.function.name, "Bash");
        assert_eq!(call.function.arguments, r#"{"command":"ls -la"}"#);
        assert_eq!(
            chunk.tool_titles.unwrap(),
            vec![ToolCallTitle {
                tool_call_id: "call-1".to_string(),
                title: "ls -la".to_string(),
            }]
        );
        assert!(chunk.tool_results.is_none());
    }

    #[test]
    fn falls_back_to_the_title_as_name() {
        let chunk = tool_call_chunk(ToolCallReport {
            title: Some("Read file".to_string()),
            ..report("call-2")
        });

        assert_eq!(chunk.tool_calls.unwrap()[0].function.name, "Read file");
    }

    #[test]
    fn finished_calls_without_new_input_only_report_the_result() {
        let chunk = tool_call_chunk(ToolCallReport {
            status: Some("completed".to_string()),
            raw_output: Some(json!("done")),
            ..report("call-3")
        });

        assert!(chunk.tool_calls.is_none());
        let result = &chunk.tool_results.unwrap()[0];
        assert_eq!(result.output, "done");
        assert!(!result.is_error);
    }

    #[test]
    fn content_blocks_in_the_output_become_text() {
        let tool_search = tool_call_chunk(ToolCallReport {
            status: Some("completed".to_string()),
            raw_output: Some(json!([
                { "type": "tool_reference", "tool_name": "CronList" },
                { "type": "tool_reference", "tool_name": "TaskStop" }
            ])),
            ..report("call-4")
        });
        let text = tool_call_chunk(ToolCallReport {
            status: Some("failed".to_string()),
            raw_output: Some(json!([{ "type": "text", "text": "exit 1" }])),
            ..report("call-5")
        });
        let other = tool_call_chunk(ToolCallReport {
            status: Some("completed".to_string()),
            raw_output: Some(json!([{ "type": "image", "data": "AAAA" }])),
            ..report("call-6")
        });

        assert_eq!(
            tool_search.tool_results.unwrap()[0].output,
            "CronList\nTaskStop"
        );
        let failed = &text.tool_results.unwrap()[0];
        assert_eq!(failed.output, "exit 1");
        assert!(failed.is_error);
        let raw = &other.tool_results.unwrap()[0].output;
        assert!(raw.starts_with("[{") && raw.contains(r#""type":"image""#));
    }
}
