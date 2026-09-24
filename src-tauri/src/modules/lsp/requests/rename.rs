use super::shared::normalize_workspace_edit;
use crate::modules::lsp::manager::LspManager;
use crate::modules::lsp::types::LspFileEdit;
use crate::modules::lsp::uris::path_to_uri;

impl LspManager {
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
}
