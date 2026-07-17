use crate::modules::lsp::manager::LspManager;
use crate::modules::lsp::types::{
    DefinitionTarget, DidCloseTextDocumentParams, LspCompletionItem, LspCompletionList,
    LspFeatureFlags, TextDocumentIdentifier,
};
use crate::modules::lsp::uris::{path_to_uri, uri_to_path};
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

    pub async fn definition(
        &self,
        language: &str,
        project_root: &str,
        file_path: &str,
        line: u32,
        character: u32,
    ) -> std::result::Result<Option<DefinitionTarget>, String> {
        let client = self.get_client(language, project_root).await?;
        let params = serde_json::json!({
            "textDocument": { "uri": path_to_uri(file_path) },
            "position": { "line": line, "character": character },
        });
        let result = client
            .request("textDocument/definition", Some(params), None)
            .await
            .map_err(|e| e.to_string())?;
        Ok(definition_target_from_response(result))
    }

    pub async fn did_close(
        &self,
        language: &str,
        project_root: &str,
        file_path: &str,
    ) -> std::result::Result<(), String> {
        let client = match self.get_client(language, project_root).await {
            Ok(client) => client,
            Err(_) => return Ok(()),
        };
        let uri = path_to_uri(file_path);

        {
            let mut versions = self.document_versions.lock().await;
            versions.remove(&uri);
        }

        let params = DidCloseTextDocumentParams {
            text_document: TextDocumentIdentifier { uri },
        };

        client
            .notify(
                "textDocument/didClose",
                Some(serde_json::to_value(params).map_err(|e| e.to_string())?),
            )
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn feature_flags(
        &self,
        language: &str,
        project_root: &str,
    ) -> std::result::Result<LspFeatureFlags, String> {
        self.start_server(language, project_root).await?;
        let servers = self.servers.read().await;
        let key = (language.to_string(), project_root.to_string());
        servers
            .get(&key)
            .map(|server| server.capabilities.feature_flags())
            .ok_or_else(|| format!("LSP server for {language} in {project_root} is not running"))
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

pub fn definition_target_from_response(value: Value) -> Option<DefinitionTarget> {
    let first = match value {
        Value::Array(mut items) => {
            if items.is_empty() {
                return None;
            }
            items.remove(0)
        }
        Value::Null => return None,
        single => single,
    };

    let (uri, range) = if let Some(target_uri) = first.get("targetUri") {
        (
            target_uri.as_str()?.to_string(),
            first.get("targetSelectionRange")?.clone(),
        )
    } else {
        (
            first.get("uri")?.as_str()?.to_string(),
            first.get("range")?.clone(),
        )
    };

    let start = range.get("start")?;
    Some(DefinitionTarget {
        file_path: uri_to_path(&uri),
        line: start.get("line")?.as_u64()? as u32,
        character: start.get("character")?.as_u64()? as u32,
    })
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

    #[cfg(not(windows))]
    #[test]
    fn definition_target_from_location_array() {
        let value = json!([{
            "uri": "file:///home/x/main.rs",
            "range": { "start": { "line": 4, "character": 9 }, "end": { "line": 4, "character": 14 } }
        }]);
        let target = definition_target_from_response(value).unwrap();
        assert_eq!(target.file_path, "/home/x/main.rs");
        assert_eq!((target.line, target.character), (4, 9));
    }

    #[cfg(windows)]
    #[test]
    fn definition_target_from_location_array() {
        let value = json!([{
            "uri": "file:///C:/project/main.rs",
            "range": { "start": { "line": 4, "character": 9 }, "end": { "line": 4, "character": 14 } }
        }]);
        let target = definition_target_from_response(value).unwrap();
        assert_eq!(target.file_path, "C:\\project\\main.rs");
        assert_eq!((target.line, target.character), (4, 9));
    }

    #[cfg(windows)]
    #[test]
    fn definition_target_from_location_link() {
        let value = json!([{
            "targetUri": "file:///C:/project/lib.rs",
            "targetRange": { "start": { "line": 0, "character": 0 }, "end": { "line": 10, "character": 0 } },
            "targetSelectionRange": { "start": { "line": 2, "character": 4 }, "end": { "line": 2, "character": 8 } }
        }]);
        let target = definition_target_from_response(value).unwrap();
        assert_eq!(target.file_path, "C:\\project\\lib.rs");
        assert_eq!((target.line, target.character), (2, 4));
    }

    #[test]
    fn definition_target_from_empty_response() {
        assert!(definition_target_from_response(json!([])).is_none());
        assert!(definition_target_from_response(Value::Null).is_none());
    }
}
