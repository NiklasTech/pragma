use crate::modules::lsp::manager::LspManager;
use crate::modules::lsp::types::{DidCloseTextDocumentParams, TextDocumentIdentifier};
use crate::modules::lsp::uris::path_to_uri;

impl LspManager {
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
}
