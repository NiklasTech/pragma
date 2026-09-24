use super::shared::location_from_value;
use crate::modules::lsp::manager::LspManager;
use crate::modules::lsp::types::{LspDocumentSymbolItem, LspRange, LspWorkspaceSymbolItem};
use crate::modules::lsp::uris::path_to_uri;
use serde_json::Value;

impl LspManager {
    pub async fn document_symbol(
        &self,
        language: &str,
        project_root: &str,
        file_path: &str,
    ) -> std::result::Result<Vec<LspDocumentSymbolItem>, String> {
        let client = self.get_client(language, project_root).await?;
        let params = serde_json::json!({
            "textDocument": { "uri": path_to_uri(file_path) },
        });
        let result = client
            .request("textDocument/documentSymbol", Some(params), None)
            .await
            .map_err(|e| e.to_string())?;
        Ok(normalize_document_symbols_response(result))
    }

    pub async fn workspace_symbol(
        &self,
        language: &str,
        project_root: &str,
        query: &str,
    ) -> std::result::Result<Vec<LspWorkspaceSymbolItem>, String> {
        let client = self.get_client(language, project_root).await?;
        let params = serde_json::json!({ "query": query });
        let result = client
            .request("workspace/symbol", Some(params), None)
            .await
            .map_err(|e| e.to_string())?;
        Ok(normalize_workspace_symbols_response(result))
    }
}

fn flatten_document_symbols(symbols: &[Value], depth: u32, out: &mut Vec<LspDocumentSymbolItem>) {
    for symbol in symbols {
        let Some(name) = symbol.get("name").and_then(|n| n.as_str()) else {
            continue;
        };
        let Some(range) = symbol
            .get("range")
            .and_then(|r| serde_json::from_value::<LspRange>(r.clone()).ok())
        else {
            continue;
        };
        let kind = symbol.get("kind").and_then(|k| k.as_u64()).unwrap_or(1) as u32;
        let detail = symbol
            .get("detail")
            .and_then(|d| d.as_str())
            .map(String::from);
        out.push(LspDocumentSymbolItem {
            name: name.to_string(),
            kind,
            detail,
            range,
            depth,
            container_name: None,
        });
        if let Some(children) = symbol.get("children").and_then(|c| c.as_array()) {
            flatten_document_symbols(children, depth + 1, out);
        }
    }
}

pub fn normalize_document_symbols_response(value: Value) -> Vec<LspDocumentSymbolItem> {
    let Value::Array(items) = value else {
        return Vec::new();
    };

    let is_symbol_information = items
        .first()
        .map(|first| first.get("location").is_some())
        .unwrap_or(false);
    if is_symbol_information {
        return items
            .iter()
            .filter_map(|item| {
                let name = item.get("name")?.as_str()?.to_string();
                let kind = item.get("kind")?.as_u64()? as u32;
                let location = location_from_value(item.get("location")?)?;
                let container_name = item
                    .get("containerName")
                    .and_then(|c| c.as_str())
                    .map(String::from);
                Some(LspDocumentSymbolItem {
                    name,
                    kind,
                    detail: None,
                    range: location.range,
                    depth: 0,
                    container_name,
                })
            })
            .collect();
    }

    let mut out = Vec::new();
    flatten_document_symbols(&items, 0, &mut out);
    out
}

pub fn normalize_workspace_symbols_response(value: Value) -> Vec<LspWorkspaceSymbolItem> {
    let Value::Array(items) = value else {
        return Vec::new();
    };
    items
        .iter()
        .filter_map(|item| {
            let name = item.get("name")?.as_str()?.to_string();
            let kind = item.get("kind")?.as_u64()? as u32;
            let location = location_from_value(item.get("location")?)?;
            let container_name = item
                .get("containerName")
                .and_then(|c| c.as_str())
                .map(String::from);
            Some(LspWorkspaceSymbolItem {
                name,
                kind,
                location,
                container_name,
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn document_symbols_flatten_hierarchy() {
        let value = json!([
            {
                "name": "MyClass",
                "kind": 5,
                "range": { "start": { "line": 0, "character": 0 }, "end": { "line": 10, "character": 1 } },
                "selectionRange": { "start": { "line": 0, "character": 6 }, "end": { "line": 0, "character": 13 } },
                "children": [
                    {
                        "name": "method",
                        "kind": 6,
                        "detail": "()",
                        "range": { "start": { "line": 2, "character": 2 }, "end": { "line": 4, "character": 3 } },
                        "selectionRange": { "start": { "line": 2, "character": 2 }, "end": { "line": 2, "character": 8 } }
                    }
                ]
            }
        ]);
        let symbols = normalize_document_symbols_response(value);
        assert_eq!(symbols.len(), 2);
        assert_eq!(symbols[0].name, "MyClass");
        assert_eq!(symbols[0].depth, 0);
        assert_eq!(symbols[1].name, "method");
        assert_eq!(symbols[1].depth, 1);
        assert_eq!(symbols[1].detail.as_deref(), Some("()"));
    }

    #[cfg(windows)]
    #[test]
    fn document_symbols_accept_symbol_information() {
        let value = json!([
            {
                "name": "helper",
                "kind": 12,
                "location": {
                    "uri": "file:///C:/project/util.ts",
                    "range": { "start": { "line": 5, "character": 0 }, "end": { "line": 5, "character": 6 } }
                },
                "containerName": "utils"
            }
        ]);
        let symbols = normalize_document_symbols_response(value);
        assert_eq!(symbols.len(), 1);
        assert_eq!(symbols[0].name, "helper");
        assert_eq!(symbols[0].container_name.as_deref(), Some("utils"));
        assert_eq!(symbols[0].range.start.line, 5);
    }

    #[cfg(windows)]
    #[test]
    fn workspace_symbols_normalize() {
        let value = json!([
            {
                "name": "LanguageClient",
                "kind": 5,
                "location": {
                    "uri": "file:///C:/project/client.ts",
                    "range": { "start": { "line": 10, "character": 0 }, "end": { "line": 10, "character": 14 } }
                }
            }
        ]);
        let symbols = normalize_workspace_symbols_response(value);
        assert_eq!(symbols.len(), 1);
        assert_eq!(symbols[0].name, "LanguageClient");
        assert_eq!(symbols[0].location.file_path, "C:\\project\\client.ts");
        assert!(normalize_workspace_symbols_response(Value::Null).is_empty());
    }
}
