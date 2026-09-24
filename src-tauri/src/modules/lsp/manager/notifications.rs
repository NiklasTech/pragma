use super::LspManager;
use crate::modules::lsp::client::Notification;
use crate::modules::lsp::types::{LspDiagnosticsEvent, PublishDiagnosticsParams};
use crate::modules::lsp::uris::uri_to_path;
use tauri::{AppHandle, Emitter};

impl LspManager {
    pub(super) async fn forward_notifications(
        app_handle: AppHandle,
        language: String,
        mut rx: tokio::sync::mpsc::UnboundedReceiver<Notification>,
    ) {
        while let Some(notification) = rx.recv().await {
            if notification.method == "textDocument/publishDiagnostics" {
                if let Some(params) = notification.params {
                    match serde_json::from_value::<PublishDiagnosticsParams>(params) {
                        Ok(diagnostics) => {
                            let file_path = uri_to_path(&diagnostics.uri);
                            let event = LspDiagnosticsEvent {
                                language: language.clone(),
                                file_path,
                                diagnostics: diagnostics.diagnostics,
                            };
                            let _ = app_handle.emit("lsp_diagnostics", event);
                        }
                        Err(_e) => {}
                    }
                }
            }
        }
    }

    pub(super) async fn forward_logs(
        app_handle: AppHandle,
        language: String,
        mut rx: tokio::sync::mpsc::UnboundedReceiver<String>,
    ) {
        while let Some(line) = rx.recv().await {
            let _ = app_handle.emit(
                "lsp_log",
                serde_json::json!({
                    "language": language,
                    "line": line,
                }),
            );
        }
    }
}
