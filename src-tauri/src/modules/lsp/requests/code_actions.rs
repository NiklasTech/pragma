use super::shared::normalize_workspace_edit;
use crate::modules::lsp::manager::LspManager;
use crate::modules::lsp::types::{LspCodeAction, LspDiagnostic, LspRange};
use crate::modules::lsp::uris::path_to_uri;
use serde_json::Value;

impl LspManager {
    pub async fn code_action(
        &self,
        language: &str,
        project_root: &str,
        file_path: &str,
        range: LspRange,
        diagnostics: Vec<LspDiagnostic>,
    ) -> std::result::Result<Vec<LspCodeAction>, String> {
        let client = self.get_client(language, project_root).await?;
        let params = serde_json::json!({
            "textDocument": { "uri": path_to_uri(file_path) },
            "range": range,
            "context": { "diagnostics": diagnostics },
        });
        let result = client
            .request("textDocument/codeAction", Some(params), None)
            .await
            .map_err(|e| e.to_string())?;
        Ok(normalize_code_actions_response(result))
    }
}

pub fn normalize_code_actions_response(value: Value) -> Vec<LspCodeAction> {
    let Value::Array(items) = value else {
        return Vec::new();
    };
    items
        .iter()
        .filter_map(|item| {
            let title = item.get("title")?.as_str()?.to_string();
            let kind = item.get("kind").and_then(|k| k.as_str()).map(String::from);
            let is_preferred = item
                .get("isPreferred")
                .and_then(|p| p.as_bool())
                .unwrap_or(false);
            let edits = item
                .get("edit")
                .map(normalize_workspace_edit)
                .unwrap_or_default();
            Some(LspCodeAction {
                title,
                kind,
                is_preferred,
                edits,
            })
        })
        .collect()
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;
    use serde_json::json;

    #[cfg(windows)]
    #[test]
    fn code_actions_normalize_titles_kinds_and_edits() {
        let value = json!([
            {
                "title": "Add missing import",
                "kind": "quickfix",
                "isPreferred": true,
                "edit": {
                    "changes": {
                        "file:///C:/project/a.ts": [
                            {
                                "range": { "start": { "line": 0, "character": 0 }, "end": { "line": 0, "character": 0 } },
                                "newText": "import x from \"x\";\n"
                            }
                        ]
                    }
                }
            },
            { "title": "Command only action", "command": { "command": "x.do", "title": "x" } }
        ]);
        let actions = normalize_code_actions_response(value);
        assert_eq!(actions.len(), 2);
        assert_eq!(actions[0].title, "Add missing import");
        assert_eq!(actions[0].kind.as_deref(), Some("quickfix"));
        assert!(actions[0].is_preferred);
        assert_eq!(actions[0].edits.len(), 1);
        assert_eq!(actions[1].title, "Command only action");
        assert!(actions[1].edits.is_empty());
        assert!(normalize_code_actions_response(Value::Null).is_empty());
    }
}
