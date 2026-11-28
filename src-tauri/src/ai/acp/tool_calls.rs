use serde_json::Value;

use super::types::{ContentBlock, ToolCallContent};
use crate::ai::provider::{FunctionCall, ToolCall};
use crate::commands::ai::{
    StreamChunk, ToolCallDetails, ToolCallDiff, ToolCallLocation, ToolResult,
};

/// One `tool_call` or `tool_call_update` of an ACP agent.
pub struct ToolCallReport {
    pub id: String,
    pub title: Option<String>,
    pub status: Option<String>,
    pub meta: Option<Value>,
    pub locations: Option<Vec<Value>>,
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

/// The file changes among a tool call's content; a diff without a path is left out.
pub fn diffs(contents: &[ToolCallContent]) -> Vec<ToolCallDiff> {
    contents
        .iter()
        .filter(|content| content.kind == "diff")
        .filter_map(|content| {
            Some(ToolCallDiff {
                path: content.path.clone().filter(|path| !path.is_empty())?,
                old_text: content.old_text.clone(),
                new_text: content.new_text.clone().unwrap_or_default(),
            })
        })
        .collect()
}

fn locations(raw: &[Value]) -> Vec<ToolCallLocation> {
    raw.iter()
        .filter_map(|location| {
            Some(ToolCallLocation {
                path: location
                    .get("path")?
                    .as_str()
                    .filter(|path| !path.is_empty())?
                    .to_string(),
                line: location
                    .get("line")
                    .and_then(Value::as_u64)
                    .and_then(|line| u32::try_from(line).ok()),
            })
        })
        .collect()
}

/// A tool call as stream chunk. A report with a title or input names the call (the name is
/// empty when the agent sends no tool name or title); its title, file changes and files go
/// into the details, also after the call finished. A finished call carries its result.
pub fn tool_call_chunk(report: ToolCallReport) -> StreamChunk {
    let is_completed = report.status.as_deref() == Some("completed");
    let is_failed = report.status.as_deref() == Some("failed");
    let title = report.title.filter(|title| !title.trim().is_empty());
    let mut chunk = StreamChunk::default();

    let details = ToolCallDetails {
        tool_call_id: report.id.clone(),
        title: title.clone(),
        diffs: report.content.as_deref().map(diffs).unwrap_or_default(),
        locations: report
            .locations
            .as_deref()
            .map(locations)
            .unwrap_or_default(),
    };
    if details.title.is_some() || !details.diffs.is_empty() || !details.locations.is_empty() {
        chunk.tool_details = Some(vec![details]);
    }

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
            locations: None,
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
            chunk.tool_details.unwrap(),
            vec![ToolCallDetails {
                tool_call_id: "call-1".to_string(),
                title: Some("ls -la".to_string()),
                ..ToolCallDetails::default()
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

    #[test]
    fn file_changes_and_locations_become_details() {
        let content: Vec<ToolCallContent> = serde_json::from_value(json!([
            { "type": "diff", "path": "/repo/a.ts", "oldText": "let a = 1;", "newText": "let a = 2;" },
            { "type": "diff", "path": "/repo/new.ts", "oldText": null, "newText": "export {};" },
            { "type": "diff", "newText": "no path" },
            { "type": "content", "content": { "type": "text", "text": "note" } }
        ]))
        .unwrap();
        let chunk = tool_call_chunk(ToolCallReport {
            locations: Some(vec![
                json!({ "path": "/repo/a.ts", "line": 3 }),
                json!({ "path": "/repo/b.ts" }),
                json!({ "line": 9 }),
            ]),
            content: Some(content),
            ..report("call-7")
        });

        assert!(
            chunk.tool_calls.is_none(),
            "no title or input, so no new call report"
        );
        let details = &chunk.tool_details.unwrap()[0];
        assert_eq!(
            details.diffs,
            vec![
                ToolCallDiff {
                    path: "/repo/a.ts".to_string(),
                    old_text: Some("let a = 1;".to_string()),
                    new_text: "let a = 2;".to_string(),
                },
                ToolCallDiff {
                    path: "/repo/new.ts".to_string(),
                    old_text: None,
                    new_text: "export {};".to_string(),
                },
            ]
        );
        assert_eq!(
            details.locations,
            vec![
                ToolCallLocation {
                    path: "/repo/a.ts".to_string(),
                    line: Some(3),
                },
                ToolCallLocation {
                    path: "/repo/b.ts".to_string(),
                    line: None,
                },
            ]
        );
    }

    #[test]
    fn a_change_after_the_result_still_reaches_the_chat() {
        let content: Vec<ToolCallContent> = serde_json::from_value(json!([
            { "type": "diff", "path": "/repo/a.ts", "oldText": "a", "newText": "b" }
        ]))
        .unwrap();
        let chunk = tool_call_chunk(ToolCallReport {
            status: Some("completed".to_string()),
            raw_output: Some(json!("The file was updated")),
            content: Some(content),
            ..report("call-8")
        });

        assert_eq!(chunk.tool_details.unwrap()[0].diffs.len(), 1);
        assert_eq!(
            chunk.tool_results.unwrap()[0].output,
            "The file was updated"
        );
    }
}
