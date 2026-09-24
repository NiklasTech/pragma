use crate::modules::lsp::manager::LspManager;
use crate::modules::lsp::types::DefinitionTarget;
use crate::modules::lsp::uris::{path_to_uri, uri_to_path};
use serde_json::Value;

impl LspManager {
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
}

pub fn definition_target_from_response(value: Value) -> Option<DefinitionTarget> {
    match value {
        Value::Array(items) => items.iter().find_map(definition_target_from_location),
        Value::Null => None,
        single => definition_target_from_location(&single),
    }
}

fn definition_target_from_location(first: &Value) -> Option<DefinitionTarget> {
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

    #[cfg(not(windows))]
    #[test]
    fn definition_target_from_bare_location() {
        let value = json!({
            "uri": "file:///home/x/main.rs",
            "range": { "start": { "line": 1, "character": 2 }, "end": { "line": 1, "character": 6 } }
        });
        let target = definition_target_from_response(value).unwrap();
        assert_eq!(target.file_path, "/home/x/main.rs");
        assert_eq!((target.line, target.character), (1, 2));
    }

    #[cfg(windows)]
    #[test]
    fn definition_target_from_bare_location() {
        let value = json!({
            "uri": "file:///C:/project/main.rs",
            "range": { "start": { "line": 1, "character": 2 }, "end": { "line": 1, "character": 6 } }
        });
        let target = definition_target_from_response(value).unwrap();
        assert_eq!(target.file_path, "C:\\project\\main.rs");
        assert_eq!((target.line, target.character), (1, 2));
    }

    #[test]
    fn definition_target_rejects_malformed_locations() {
        assert!(
            definition_target_from_response(json!({ "uri": "file:///C:/project/main.rs" }))
                .is_none()
        );
        assert!(definition_target_from_response(
            json!({ "range": { "start": { "line": 0, "character": 0 } } })
        )
        .is_none());
        assert!(definition_target_from_response(
            json!([{ "uri": "file:///C:/project/main.rs", "range": { "start": {} } }])
        )
        .is_none());
        assert!(definition_target_from_response(json!(42)).is_none());
    }

    #[cfg(windows)]
    #[test]
    fn definition_target_skips_malformed_entries() {
        let value = json!([
            { "broken": true },
            {
                "uri": "file:///C:/project/main.rs",
                "range": { "start": { "line": 0, "character": 0 }, "end": { "line": 0, "character": 1 } }
            }
        ]);
        let target = definition_target_from_response(value).unwrap();
        assert_eq!(target.file_path, "C:\\project\\main.rs");
        assert_eq!((target.line, target.character), (0, 0));

        assert!(definition_target_from_response(json!([{ "broken": true }])).is_none());
    }
}
