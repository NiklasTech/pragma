use super::shared::marked_string_to_text;
use crate::modules::lsp::manager::LspManager;
use crate::modules::lsp::types::{LspHover, LspRange};
use crate::modules::lsp::uris::path_to_uri;
use serde_json::Value;

impl LspManager {
    pub async fn hover(
        &self,
        language: &str,
        project_root: &str,
        file_path: &str,
        line: u32,
        character: u32,
    ) -> std::result::Result<Option<LspHover>, String> {
        let client = self.get_client(language, project_root).await?;
        let params = serde_json::json!({
            "textDocument": { "uri": path_to_uri(file_path) },
            "position": { "line": line, "character": character },
        });
        let result = client
            .request("textDocument/hover", Some(params), None)
            .await
            .map_err(|e| e.to_string())?;
        Ok(normalize_hover_response(result))
    }
}

pub fn normalize_hover_response(value: Value) -> Option<LspHover> {
    let contents_value = value.get("contents")?;
    let contents = match contents_value {
        Value::Array(items) => {
            let parts: Vec<String> = items.iter().filter_map(marked_string_to_text).collect();
            if parts.is_empty() {
                return None;
            }
            parts.join("\n\n")
        }
        single => marked_string_to_text(single)?,
    };
    let range = value
        .get("range")
        .and_then(|r| serde_json::from_value::<LspRange>(r.clone()).ok());
    Some(LspHover { contents, range })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn normalize_hover_accepts_markup_content() {
        let value = json!({
            "contents": { "kind": "markdown", "value": "**const** x: number" },
            "range": { "start": { "line": 1, "character": 2 }, "end": { "line": 1, "character": 5 } }
        });
        let hover = normalize_hover_response(value).unwrap();
        assert_eq!(hover.contents, "**const** x: number");
        let range = hover.range.unwrap();
        assert_eq!((range.start.line, range.start.character), (1, 2));
        assert_eq!((range.end.line, range.end.character), (1, 5));
    }

    #[test]
    fn normalize_hover_accepts_plain_marked_string() {
        let value = json!({ "contents": "simple doc string" });
        let hover = normalize_hover_response(value).unwrap();
        assert_eq!(hover.contents, "simple doc string");
        assert!(hover.range.is_none());
    }

    #[test]
    fn normalize_hover_fences_language_marked_strings() {
        let value = json!({
            "contents": [
                { "language": "typescript", "value": "const x: number" },
                "extra docs"
            ]
        });
        let hover = normalize_hover_response(value).unwrap();
        assert_eq!(
            hover.contents,
            "```typescript\nconst x: number\n```\n\nextra docs"
        );
    }

    #[test]
    fn normalize_hover_rejects_null_and_empty_contents() {
        assert!(normalize_hover_response(Value::Null).is_none());
        assert!(normalize_hover_response(json!({ "contents": Value::Null })).is_none());
        assert!(normalize_hover_response(json!({ "contents": "" })).is_none());
        assert!(normalize_hover_response(json!({ "contents": [] })).is_none());
    }
}
