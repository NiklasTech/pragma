use crate::ai::{
    error::AIError,
    provider::{CompletionChunk, FunctionCall, ToolCall},
};

pub(super) fn extract_tool_calls_from_content(content: &str) -> Option<Vec<ToolCall>> {
    let mut calls = Vec::new();

    let mut search_from = 0;
    while let Some(start) = content[search_from..].find("<tool_call>") {
        let start_abs = search_from + start + "<tool_call>".len();
        if let Some(end_rel) = content[start_abs..].find("</tool_call>") {
            let end_abs = start_abs + end_rel;
            let json_str = content[start_abs..end_abs].trim();
            if let Ok(value) = serde_json::from_str::<serde_json::Value>(json_str) {
                if let (Some(name), arguments) = (
                    value.get("name").and_then(|v| v.as_str()).map(String::from),
                    value
                        .get("arguments")
                        .cloned()
                        .unwrap_or_else(|| serde_json::Value::Object(serde_json::Map::new())),
                ) {
                    calls.push(ToolCall {
                        id: format!("fallback-{}", calls.len()),
                        r#type: "function".to_string(),
                        function: FunctionCall {
                            name,
                            arguments: arguments.to_string(),
                        },
                    });
                }
            }
            search_from = end_abs + "</tool_call>".len();
        } else {
            break;
        }
    }

    search_from = 0;
    while let Some(start) = content[search_from..].find("[TOOL_REQUEST]") {
        let start_abs = search_from + start + "[TOOL_REQUEST]".len();
        if let Some(end_rel) = content[start_abs..].find("[END_TOOL_REQUEST]") {
            let end_abs = start_abs + end_rel;
            let json_str = content[start_abs..end_abs].trim();
            if let Ok(value) = serde_json::from_str::<serde_json::Value>(json_str) {
                if let (Some(name), arguments) = (
                    value.get("name").and_then(|v| v.as_str()).map(String::from),
                    value
                        .get("arguments")
                        .cloned()
                        .unwrap_or_else(|| serde_json::Value::Object(serde_json::Map::new())),
                ) {
                    calls.push(ToolCall {
                        id: format!("fallback-{}", calls.len()),
                        r#type: "function".to_string(),
                        function: FunctionCall {
                            name,
                            arguments: arguments.to_string(),
                        },
                    });
                }
            }
            search_from = end_abs + "[END_TOOL_REQUEST]".len();
        } else {
            break;
        }
    }

    if calls.is_empty() {
        None
    } else {
        Some(calls)
    }
}

pub(super) async fn send_tool_call_chunk(
    calls: Vec<ToolCall>,
    tx: &tokio::sync::mpsc::Sender<Result<CompletionChunk, AIError>>,
) {
    if !calls.is_empty() {
        let _ = tx
            .send(Ok(CompletionChunk {
                content: String::new(),
                finish_reason: Some("tool_calls".to_string()),
                tool_calls: Some(calls),
            }))
            .await;
    }
}

#[derive(Debug, Default)]
pub(super) struct PartialToolCall {
    pub(super) id: String,
    pub(super) r#type: String,
    pub(super) name: Option<String>,
    pub(super) arguments: String,
}

impl From<PartialToolCall> for ToolCall {
    fn from(partial: PartialToolCall) -> Self {
        Self {
            id: partial.id,
            r#type: if partial.r#type.is_empty() {
                "function".to_string()
            } else {
                partial.r#type
            },
            function: FunctionCall {
                name: partial.name.unwrap_or_default(),
                arguments: partial.arguments,
            },
        }
    }
}
