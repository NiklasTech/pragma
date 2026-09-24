use crate::modules::lsp::manager::LspManager;
use crate::modules::lsp::types::{LspCompletionItem, LspCompletionList};
use crate::modules::lsp::uris::path_to_uri;
use serde_json::Value;

impl LspManager {
    pub async fn completion(
        &self,
        language: &str,
        project_root: &str,
        file_path: &str,
        line: u32,
        character: u32,
    ) -> std::result::Result<Vec<LspCompletionItem>, String> {
        let client = self.get_client(language, project_root).await?;
        let params = serde_json::json!({
            "textDocument": { "uri": path_to_uri(file_path) },
            "position": { "line": line, "character": character },
        });
        let result = client
            .request("textDocument/completion", Some(params), None)
            .await
            .map_err(|e| e.to_string())?;
        Ok(normalize_completion_response(result))
    }

    pub async fn resolve_completion(
        &self,
        language: &str,
        project_root: &str,
        item: Value,
    ) -> std::result::Result<Value, String> {
        let client = self.get_client(language, project_root).await?;
        client
            .request("completionItem/resolve", Some(item), None)
            .await
            .map_err(|e| e.to_string())
    }
}

pub fn normalize_completion_response(value: Value) -> Vec<LspCompletionItem> {
    match value {
        Value::Array(_) => serde_json::from_value(value).unwrap_or_default(),
        Value::Object(_) => serde_json::from_value::<LspCompletionList>(value)
            .map(|list| list.items)
            .unwrap_or_default(),
        _ => Vec::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn normalize_accepts_bare_item_array() {
        let value = json!([{ "label": "alpha" }, { "label": "beta", "kind": 6 }]);
        let items = normalize_completion_response(value);
        assert_eq!(items.len(), 2);
        assert_eq!(items[1].kind, Some(6));
    }

    #[test]
    fn normalize_accepts_completion_list() {
        let value = json!({ "isIncomplete": false, "items": [{ "label": "alpha" }] });
        assert_eq!(normalize_completion_response(value).len(), 1);
    }

    #[test]
    fn normalize_handles_null_and_garbage() {
        assert!(normalize_completion_response(Value::Null).is_empty());
        assert!(normalize_completion_response(json!(42)).is_empty());
    }
}
