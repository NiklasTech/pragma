use crate::modules::lsp::manager::LspManager;
use crate::modules::lsp::types::LspTextEdit;
use crate::modules::lsp::uris::path_to_uri;
use serde_json::Value;

impl LspManager {
    pub async fn format_document(
        &self,
        language: &str,
        project_root: &str,
        file_path: &str,
        tab_size: u32,
        insert_spaces: bool,
    ) -> std::result::Result<Vec<LspTextEdit>, String> {
        let client = self.get_client(language, project_root).await?;
        let params = serde_json::json!({
            "textDocument": { "uri": path_to_uri(file_path) },
            "options": { "tabSize": tab_size, "insertSpaces": insert_spaces },
        });
        let result = client
            .request("textDocument/formatting", Some(params), None)
            .await
            .map_err(|e| e.to_string())?;
        Ok(normalize_formatting_response(result))
    }
}

pub fn normalize_formatting_response(value: Value) -> Vec<LspTextEdit> {
    serde_json::from_value(value).unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn formatting_normalize_text_edits() {
        let value = json!([
            {
                "range": { "start": { "line": 0, "character": 0 }, "end": { "line": 0, "character": 4 } },
                "newText": "    "
            }
        ]);
        let edits = normalize_formatting_response(value);
        assert_eq!(edits.len(), 1);
        assert_eq!(edits[0].new_text, "    ");
        assert!(normalize_formatting_response(Value::Null).is_empty());
    }
}
