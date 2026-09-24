use super::LspManager;
use crate::modules::lsp::client::LspClient;
use crate::modules::lsp::types::{
    DidChangeTextDocumentParams, DidOpenTextDocumentParams, DidSaveTextDocumentParams, LspRange,
    TextDocumentContentChangeEvent, TextDocumentIdentifier, TextDocumentItem,
    VersionedTextDocumentIdentifier,
};
use crate::modules::lsp::uris::path_to_uri;

impl LspManager {
    pub async fn did_open(
        &self,
        language: &str,
        project_root: &str,
        file_path: &str,
        content: &str,
    ) -> std::result::Result<(), String> {
        self.start_server(language, project_root).await?;

        let client = self.get_client(language, project_root).await?;
        let uri = path_to_uri(file_path);

        {
            let mut versions = self.document_versions.lock().await;
            versions.insert(uri.clone(), 1);
        }

        let params = DidOpenTextDocumentParams {
            text_document: TextDocumentItem {
                uri,
                language_id: language_id_for_path(file_path, language),
                version: 1,
                text: content.to_string(),
            },
        };

        client
            .notify(
                "textDocument/didOpen",
                Some(serde_json::to_value(params).map_err(|e| e.to_string())?),
            )
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn did_change(
        &self,
        language: &str,
        project_root: &str,
        file_path: &str,
        content: &str,
        incremental: Option<(LspRange, String)>,
    ) -> std::result::Result<(), String> {
        let client = self.get_client(language, project_root).await?;
        let uri = path_to_uri(file_path);

        let next_version = {
            let mut versions = self.document_versions.lock().await;
            let version = versions.get(&uri).copied().unwrap_or(1) + 1;
            versions.insert(uri.clone(), version);
            version
        };

        let sync_kind = {
            let servers = self.servers.read().await;
            let key = (language.to_string(), project_root.to_string());
            servers.get(&key).map(|s| s.capabilities.sync_kind())
        };

        let change_event = match (sync_kind, incremental) {
            (Some(2), Some((range, text))) => TextDocumentContentChangeEvent {
                range: Some(range),
                range_length: None,
                text,
            },
            _ => TextDocumentContentChangeEvent {
                range: None,
                range_length: None,
                text: content.to_string(),
            },
        };

        let params = DidChangeTextDocumentParams {
            text_document: VersionedTextDocumentIdentifier {
                uri,
                version: next_version,
            },
            content_changes: vec![change_event],
        };

        client
            .notify(
                "textDocument/didChange",
                Some(serde_json::to_value(params).map_err(|e| e.to_string())?),
            )
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn did_save(
        &self,
        language: &str,
        project_root: &str,
        file_path: &str,
    ) -> std::result::Result<(), String> {
        let client = self.get_client(language, project_root).await?;
        let uri = path_to_uri(file_path);

        let params = DidSaveTextDocumentParams {
            text_document: TextDocumentIdentifier { uri },
        };

        client
            .notify(
                "textDocument/didSave",
                Some(serde_json::to_value(params).map_err(|e| e.to_string())?),
            )
            .await
            .map_err(|e| e.to_string())
    }

    pub(crate) async fn get_client(
        &self,
        language: &str,
        project_root: &str,
    ) -> std::result::Result<LspClient, String> {
        let servers = self.servers.read().await;
        let key = (language.to_string(), project_root.to_string());
        servers
            .get(&key)
            .map(|s| s.client.clone())
            .ok_or_else(|| format!("LSP server for {language} in {project_root} is not running"))
    }
}

fn language_id_for_path(file_path: &str, language: &str) -> String {
    if language != "typescript" && language != "javascript" {
        return language.to_string();
    }

    let lower = file_path.to_lowercase();
    if lower.ends_with(".tsx") {
        return "typescriptreact".to_string();
    }
    if lower.ends_with(".jsx") {
        return "javascriptreact".to_string();
    }
    if lower.ends_with(".mts") {
        return "typescript".to_string();
    }
    if lower.ends_with(".cts") {
        return "typescript".to_string();
    }
    if lower.ends_with(".mjs") {
        return "javascript".to_string();
    }
    if lower.ends_with(".cjs") {
        return "javascript".to_string();
    }

    language.to_string()
}
