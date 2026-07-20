use crate::modules::lsp::manager::LspManager;
use crate::modules::lsp::types::{
    DefinitionTarget, DidCloseTextDocumentParams, LspCodeAction, LspCompletionItem,
    LspCompletionList, LspDiagnostic, LspDocumentSymbolItem, LspFeatureFlags, LspFileEdit,
    LspHover, LspLocation, LspParameterInformation, LspRange, LspSignatureHelp,
    LspSignatureInformation, LspTextEdit, LspWorkspaceSymbolItem, TextDocumentIdentifier,
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

    pub async fn rename(
        &self,
        language: &str,
        project_root: &str,
        file_path: &str,
        line: u32,
        character: u32,
        new_name: &str,
    ) -> std::result::Result<Vec<LspFileEdit>, String> {
        let client = self.get_client(language, project_root).await?;
        let params = serde_json::json!({
            "textDocument": { "uri": path_to_uri(file_path) },
            "position": { "line": line, "character": character },
            "newName": new_name,
        });
        let result = client
            .request("textDocument/rename", Some(params), None)
            .await
            .map_err(|e| e.to_string())?;
        Ok(normalize_workspace_edit(&result))
    }

    pub async fn signature_help(
        &self,
        language: &str,
        project_root: &str,
        file_path: &str,
        line: u32,
        character: u32,
    ) -> std::result::Result<Option<LspSignatureHelp>, String> {
        let client = self.get_client(language, project_root).await?;
        let params = serde_json::json!({
            "textDocument": { "uri": path_to_uri(file_path) },
            "position": { "line": line, "character": character },
        });
        let result = client
            .request("textDocument/signatureHelp", Some(params), None)
            .await
            .map_err(|e| e.to_string())?;
        Ok(normalize_signature_help_response(result))
    }

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

fn marked_string_to_text(value: &Value) -> Option<String> {
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

pub fn normalize_references_response(value: Value) -> Vec<LspLocation> {
    match value {
        Value::Array(items) => items.iter().filter_map(location_from_value).collect(),
        _ => Vec::new(),
    }
}

pub fn normalize_formatting_response(value: Value) -> Vec<LspTextEdit> {
    serde_json::from_value(value).unwrap_or_default()
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

fn parameter_label(param: &Value, signature_label: &str) -> Option<String> {
    match param.get("label")? {
        Value::String(label) => Some(label.clone()),
        Value::Array(offsets) => {
            let start = offsets.first()?.as_u64()? as usize;
            let end = offsets.get(1)?.as_u64()? as usize;
            let chars: Vec<char> = signature_label.chars().collect();
            if start > end || end > chars.len() {
                return None;
            }
            Some(chars[start..end].iter().collect())
        }
        _ => None,
    }
}

pub fn normalize_signature_help_response(value: Value) -> Option<LspSignatureHelp> {
    let signatures_value = value.get("signatures")?.as_array()?;
    let signatures: Vec<LspSignatureInformation> = signatures_value
        .iter()
        .filter_map(|sig| {
            let label = sig.get("label")?.as_str()?.to_string();
            let documentation = sig.get("documentation").and_then(marked_string_to_text);
            let parameters = sig
                .get("parameters")
                .and_then(|params| params.as_array())
                .map(|params| {
                    params
                        .iter()
                        .filter_map(|param| {
                            let label = parameter_label(param, &label)?;
                            let documentation =
                                param.get("documentation").and_then(marked_string_to_text);
                            Some(LspParameterInformation {
                                label,
                                documentation,
                            })
                        })
                        .collect()
                })
                .unwrap_or_default();
            Some(LspSignatureInformation {
                label,
                documentation,
                parameters,
            })
        })
        .collect();
    if signatures.is_empty() {
        return None;
    }

    let active_signature = value
        .get("activeSignature")
        .and_then(|a| a.as_u64())
        .unwrap_or(0) as u32;
    let active_parameter = value
        .get("activeParameter")
        .and_then(|a| a.as_u64())
        .unwrap_or(0) as u32;
    Some(LspSignatureHelp {
        signatures,
        active_signature,
        active_parameter,
    })
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

    #[test]
    fn definition_target_from_empty_response() {
        assert!(definition_target_from_response(json!([])).is_none());
        assert!(definition_target_from_response(Value::Null).is_none());
    }

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

    #[test]
    fn signature_help_normalize_with_offset_labels() {
        let value = json!({
            "signatures": [
                {
                    "label": "foo(a: number, b: string): void",
                    "documentation": { "kind": "markdown", "value": "docs" },
                    "parameters": [
                        { "label": [4, 13] },
                        { "label": "b: string", "documentation": "second" }
                    ]
                }
            ],
            "activeSignature": 0,
            "activeParameter": 1
        });
        let help = normalize_signature_help_response(value).unwrap();
        assert_eq!(help.signatures.len(), 1);
        assert_eq!(help.signatures[0].documentation.as_deref(), Some("docs"));
        assert_eq!(help.signatures[0].parameters[0].label, "a: number");
        assert_eq!(help.signatures[0].parameters[1].label, "b: string");
        assert_eq!(help.active_parameter, 1);

        assert!(normalize_signature_help_response(json!({ "signatures": [] })).is_none());
        assert!(normalize_signature_help_response(Value::Null).is_none());
    }

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
