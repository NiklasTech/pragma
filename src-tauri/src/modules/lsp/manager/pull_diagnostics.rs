use super::LspManager;
use crate::modules::lsp::types::{LspDiagnostic, LspDiagnosticsEvent, ServerCapabilities};
use crate::modules::lsp::uris::{path_to_uri, uri_to_path};
use serde_json::Value;
use std::sync::Arc;
use tauri::Emitter;

impl LspManager {
    /// Requests diagnostics from servers that never publish them and emits them like pushed ones.
    pub(super) async fn pull_diagnostics(
        &self,
        language: &str,
        project_root: &str,
        file_path: &str,
    ) {
        let client = {
            let servers = self.servers.read().await;
            let key = (language.to_string(), project_root.to_string());
            match servers.get(&key) {
                Some(server) if uses_pull_diagnostics(language, &server.capabilities) => {
                    server.client.clone()
                }
                _ => return,
            }
        };

        let uri = path_to_uri(file_path);
        let version = self.document_versions.lock().await.get(&uri).copied();
        let versions = Arc::clone(&self.document_versions);
        let app_handle = self.app_handle.clone();
        let language = language.to_string();

        tokio::spawn(async move {
            let params = serde_json::json!({ "textDocument": { "uri": uri } });
            let Ok(result) = client
                .request("textDocument/diagnostic", Some(params), None)
                .await
            else {
                return;
            };
            // A newer edit or a close has its own request in flight, so this result is stale.
            if versions.lock().await.get(&uri).copied() != version {
                return;
            }
            let Some(diagnostics) = full_report_items(result) else {
                return;
            };
            let _ = app_handle.emit(
                "lsp_diagnostics",
                LspDiagnosticsEvent {
                    language,
                    file_path: uri_to_path(&uri),
                    diagnostics,
                },
            );
        });
    }
}

/// The TypeScript 7 native server only answers pull requests, while typescript-language-server
/// and servers that also advertise pull support keep publishing to this client.
fn uses_pull_diagnostics(language: &str, capabilities: &ServerCapabilities) -> bool {
    matches!(language, "typescript" | "javascript")
        && capabilities.extra.contains_key("diagnosticProvider")
}

/// An "unchanged" report keeps the diagnostics the editor already shows.
fn full_report_items(result: Value) -> Option<Vec<LspDiagnostic>> {
    if result.get("kind")?.as_str()? != "full" {
        return None;
    }
    serde_json::from_value(result.get("items")?.clone()).ok()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn capabilities(value: Value) -> ServerCapabilities {
        serde_json::from_value(value).unwrap()
    }

    #[test]
    fn pulls_only_for_typescript_servers_that_advertise_it() {
        let pull = capabilities(json!({ "diagnosticProvider": { "interFileDependencies": true } }));
        let push = capabilities(json!({ "hoverProvider": true }));

        assert!(uses_pull_diagnostics("typescript", &pull));
        assert!(uses_pull_diagnostics("javascript", &pull));
        assert!(!uses_pull_diagnostics("typescript", &push));
        assert!(!uses_pull_diagnostics("rust", &pull));
    }

    #[test]
    fn full_reports_yield_their_items() {
        let items = full_report_items(json!({
            "kind": "full",
            "items": [{
                "range": {
                    "start": { "line": 0, "character": 6 },
                    "end": { "line": 0, "character": 7 }
                },
                "severity": 1,
                "code": 2322,
                "source": "ts",
                "message": "Type 'string' is not assignable to type 'number'."
            }]
        }))
        .unwrap();

        assert_eq!(items.len(), 1);
        assert_eq!(items[0].severity, Some(1));
    }

    #[test]
    fn unchanged_and_malformed_reports_are_ignored() {
        assert!(full_report_items(json!({ "kind": "unchanged", "resultId": "1" })).is_none());
        assert!(full_report_items(json!({ "kind": "full" })).is_none());
        assert!(full_report_items(Value::Null).is_none());
    }
}
