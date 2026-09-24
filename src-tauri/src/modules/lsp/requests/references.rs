use super::shared::location_from_value;
use crate::modules::lsp::manager::LspManager;
use crate::modules::lsp::types::LspLocation;
use crate::modules::lsp::uris::path_to_uri;
use serde_json::Value;

impl LspManager {
    pub async fn references(
        &self,
        language: &str,
        project_root: &str,
        file_path: &str,
        line: u32,
        character: u32,
    ) -> std::result::Result<Vec<LspLocation>, String> {
        let client = self.get_client(language, project_root).await?;
        let params = serde_json::json!({
            "textDocument": { "uri": path_to_uri(file_path) },
            "position": { "line": line, "character": character },
            "context": { "includeDeclaration": true },
        });
        let result = client
            .request("textDocument/references", Some(params), None)
            .await
            .map_err(|e| e.to_string())?;
        Ok(normalize_references_response(result))
    }
}

pub fn normalize_references_response(value: Value) -> Vec<LspLocation> {
    match value {
        Value::Array(items) => items.iter().filter_map(location_from_value).collect(),
        _ => Vec::new(),
    }
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;
    use serde_json::json;

    #[cfg(windows)]
    #[test]
    fn references_normalize_locations_and_links() {
        let value = json!([
            {
                "uri": "file:///C:/project/a.ts",
                "range": { "start": { "line": 1, "character": 2 }, "end": { "line": 1, "character": 8 } }
            },
            {
                "targetUri": "file:///C:/project/b.ts",
                "targetRange": { "start": { "line": 0, "character": 0 }, "end": { "line": 3, "character": 0 } },
                "targetSelectionRange": { "start": { "line": 4, "character": 1 }, "end": { "line": 4, "character": 5 } }
            }
        ]);
        let refs = normalize_references_response(value);
        assert_eq!(refs.len(), 2);
        assert_eq!(refs[0].file_path, "C:\\project\\a.ts");
        assert_eq!(
            (refs[0].range.start.line, refs[0].range.start.character),
            (1, 2)
        );
        assert_eq!(refs[1].file_path, "C:\\project\\b.ts");
        assert_eq!(
            (refs[1].range.start.line, refs[1].range.start.character),
            (4, 1)
        );
        assert!(normalize_references_response(Value::Null).is_empty());
    }
}
