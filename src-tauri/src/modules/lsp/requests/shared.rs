use crate::modules::lsp::types::{LspFileEdit, LspLocation, LspRange, LspTextEdit};
use crate::modules::lsp::uris::uri_to_path;
use serde_json::Value;

pub fn location_from_value(value: &Value) -> Option<LspLocation> {
    let (uri, range) = if let Some(target_uri) = value.get("targetUri") {
        (
            target_uri.as_str()?,
            value.get("targetSelectionRange")?.clone(),
        )
    } else {
        (value.get("uri")?.as_str()?, value.get("range")?.clone())
    };
    let range = serde_json::from_value::<LspRange>(range).ok()?;
    Some(LspLocation {
        file_path: uri_to_path(uri),
        range,
    })
}

pub(super) fn marked_string_to_text(value: &Value) -> Option<String> {
    match value {
        Value::String(text) => (!text.is_empty()).then(|| text.clone()),
        Value::Object(_) => {
            let text = value.get("value")?.as_str()?;
            if text.is_empty() {
                return None;
            }
            match value.get("language").and_then(|lang| lang.as_str()) {
                Some(language) => Some(format!("```{language}\n{text}\n```")),
                None => Some(text.to_string()),
            }
        }
        _ => None,
    }
}

pub fn normalize_workspace_edit(value: &Value) -> Vec<LspFileEdit> {
    let mut out: Vec<LspFileEdit> = Vec::new();

    if let Some(changes) = value.get("changes").and_then(|c| c.as_object()) {
        for (uri, edits_value) in changes {
            let edits = edits_value
                .as_array()
                .map(|items| {
                    items
                        .iter()
                        .filter_map(|item| serde_json::from_value::<LspTextEdit>(item.clone()).ok())
                        .collect()
                })
                .unwrap_or_default();
            out.push(LspFileEdit {
                file_path: uri_to_path(uri),
                edits,
            });
        }
    }

    if let Some(document_changes) = value.get("documentChanges").and_then(|c| c.as_array()) {
        for change in document_changes {
            let Some(uri) = change
                .get("textDocument")
                .and_then(|doc| doc.get("uri"))
                .and_then(|uri| uri.as_str())
            else {
                continue;
            };
            let edits = change
                .get("edits")
                .and_then(|e| e.as_array())
                .map(|items| {
                    items
                        .iter()
                        .filter_map(|item| serde_json::from_value::<LspTextEdit>(item.clone()).ok())
                        .collect()
                })
                .unwrap_or_default();
            out.push(LspFileEdit {
                file_path: uri_to_path(uri),
                edits,
            });
        }
    }

    out
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;
    use serde_json::json;

    #[cfg(windows)]
    #[test]
    fn workspace_edit_normalize_changes_and_document_changes() {
        let changes_form = json!({
            "changes": {
                "file:///C:/project/a.ts": [
                    {
                        "range": { "start": { "line": 0, "character": 0 }, "end": { "line": 0, "character": 3 } },
                        "newText": "newName"
                    }
                ]
            }
        });
        let edits = normalize_workspace_edit(&changes_form);
        assert_eq!(edits.len(), 1);
        assert_eq!(edits[0].file_path, "C:\\project\\a.ts");
        assert_eq!(edits[0].edits[0].new_text, "newName");

        let document_changes_form = json!({
            "documentChanges": [
                {
                    "textDocument": { "uri": "file:///C:/project/b.ts", "version": 3 },
                    "edits": [
                        {
                            "range": { "start": { "line": 2, "character": 1 }, "end": { "line": 2, "character": 4 } },
                            "newText": "renamed"
                        }
                    ]
                }
            ]
        });
        let edits = normalize_workspace_edit(&document_changes_form);
        assert_eq!(edits.len(), 1);
        assert_eq!(edits[0].file_path, "C:\\project\\b.ts");
        assert_eq!(edits[0].edits[0].new_text, "renamed");
    }
}
