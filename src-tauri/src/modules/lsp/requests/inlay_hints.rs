use crate::modules::lsp::manager::LspManager;
use crate::modules::lsp::types::{LspInlayHint, LspPosition, LspRange};
use crate::modules::lsp::uris::path_to_uri;
use serde_json::Value;

impl LspManager {
    pub async fn inlay_hint(
        &self,
        language: &str,
        project_root: &str,
        file_path: &str,
        range: LspRange,
    ) -> std::result::Result<Vec<LspInlayHint>, String> {
        let client = self.get_client(language, project_root).await?;
        let params = serde_json::json!({
            "textDocument": { "uri": path_to_uri(file_path) },
            "range": range,
        });
        let result = client
            .request("textDocument/inlayHint", Some(params), None)
            .await
            .map_err(|e| e.to_string())?;
        Ok(normalize_inlay_hints_response(result))
    }
}

fn inlay_hint_label(value: &Value) -> Option<String> {
    match value {
        Value::String(label) => (!label.is_empty()).then(|| label.clone()),
        Value::Array(parts) => {
            let text: String = parts
                .iter()
                .filter_map(|part| part.get("value").and_then(|value| value.as_str()))
                .collect();
            (!text.is_empty()).then_some(text)
        }
        _ => None,
    }
}

pub fn normalize_inlay_hints_response(value: Value) -> Vec<LspInlayHint> {
    let Value::Array(items) = value else {
        return Vec::new();
    };
    items
        .iter()
        .filter_map(|item| {
            let position = item
                .get("position")
                .and_then(|p| serde_json::from_value::<LspPosition>(p.clone()).ok())?;
            let label = inlay_hint_label(item.get("label")?)?;
            let kind = item.get("kind").and_then(|k| k.as_u64()).map(|k| k as u32);
            let padding_left = item
                .get("paddingLeft")
                .and_then(|p| p.as_bool())
                .unwrap_or(false);
            let padding_right = item
                .get("paddingRight")
                .and_then(|p| p.as_bool())
                .unwrap_or(false);
            Some(LspInlayHint {
                position,
                label,
                kind,
                padding_left,
                padding_right,
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn inlay_hints_normalize_string_and_part_labels() {
        let value = json!([
            {
                "position": { "line": 2, "character": 8 },
                "label": ": number",
                "kind": 1,
                "paddingLeft": true
            },
            {
                "position": { "line": 4, "character": 12 },
                "label": [{ "value": "name" }, { "value": ":" }, { "value": " string" }],
                "kind": 2,
                "paddingRight": true
            }
        ]);
        let hints = normalize_inlay_hints_response(value);
        assert_eq!(hints.len(), 2);
        assert_eq!(hints[0].label, ": number");
        assert_eq!(hints[0].kind, Some(1));
        assert!(hints[0].padding_left);
        assert!(!hints[0].padding_right);
        assert_eq!(
            (hints[0].position.line, hints[0].position.character),
            (2, 8)
        );
        assert_eq!(hints[1].label, "name: string");
        assert!(hints[1].padding_right);
    }

    #[test]
    fn inlay_hints_skip_malformed_entries() {
        let value = json!([
            { "label": "no position" },
            { "position": { "line": 0, "character": 0 } },
            { "position": { "line": 1, "character": 1 }, "label": [] },
            { "position": { "line": 1, "character": 1 }, "label": "" },
            {
                "position": { "line": 3, "character": 2 },
                "label": "ok"
            }
        ]);
        let hints = normalize_inlay_hints_response(value);
        assert_eq!(hints.len(), 1);
        assert_eq!(hints[0].label, "ok");
        assert!(!hints[0].padding_left);
        assert!(!hints[0].padding_right);
        assert!(hints[0].kind.is_none());
    }

    #[test]
    fn inlay_hints_handle_null_and_garbage() {
        assert!(normalize_inlay_hints_response(Value::Null).is_empty());
        assert!(normalize_inlay_hints_response(json!({ "position": {} })).is_empty());
        assert!(normalize_inlay_hints_response(json!(42)).is_empty());
    }
}
