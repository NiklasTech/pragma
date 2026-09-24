use crate::modules::lsp::manager::LspManager;
use crate::modules::lsp::types::LspFeatureFlags;

impl LspManager {
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
