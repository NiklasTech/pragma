use crate::modules::lsp::client::{LspClient, Notification};
use crate::modules::lsp::types::{
    ClientCapabilities, DidChangeTextDocumentParams, DidOpenTextDocumentParams,
    DidSaveTextDocumentParams, InitializeParams, LspDiagnosticsEvent, LspServerConfig,
    LspServerStatus, LspStatusEvent, PublishDiagnosticsParams, TextDocumentContentChangeEvent,
    TextDocumentIdentifier, TextDocumentItem, VersionedTextDocumentIdentifier,
};
use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::process::Child;
use tokio::sync::{Mutex, RwLock};

const SERVERS: &[(&str, &str, &[&str])] =
    &[("typescript", "typescript-language-server", &["--stdio"])];

struct RunningServer {
    #[allow(dead_code)]
    client: LspClient,
    child: Arc<Mutex<Child>>,
    #[allow(dead_code)]
    status: Arc<Mutex<LspServerStatus>>,
    #[allow(dead_code)]
    notification_handle: tokio::task::JoinHandle<()>,
    #[allow(dead_code)]
    supervisor_handle: tokio::task::JoinHandle<()>,
    #[allow(dead_code)]
    log_handle: tokio::task::JoinHandle<()>,
}

pub struct LspManager {
    app_handle: AppHandle,
    servers: RwLock<HashMap<(String, String), RunningServer>>,
    document_versions: Mutex<HashMap<String, i32>>,
}

impl LspManager {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            app_handle,
            servers: RwLock::new(HashMap::new()),
            document_versions: Mutex::new(HashMap::new()),
        }
    }

    pub fn managed(app_handle: AppHandle) -> Self {
        Self::new(app_handle)
    }

    pub async fn start_server(
        &self,
        language: &str,
        project_root: &str,
    ) -> std::result::Result<(), String> {
        let key = (language.to_string(), project_root.to_string());

        {
            let servers = self.servers.read().await;
            if servers.contains_key(&key) {
                return Ok(());
            }
        }

        let config = server_config_for_language(language)
            .ok_or_else(|| format!("No LSP server configured for language '{language}'"))?;

        self.emit_status(language, project_root, LspServerStatus::Starting, None);

        let (client, child, notifications, stderr_lines) =
            LspClient::start(config).await.map_err(|e| e.to_string())?;

        let child = Arc::new(Mutex::new(child));
        let status = Arc::new(Mutex::new(LspServerStatus::Running));

        let notification_handle = tokio::spawn(Self::forward_notifications(
            self.app_handle.clone(),
            language.to_string(),
            notifications,
        ));
        let supervisor_handle = tokio::spawn(Self::supervise(
            self.app_handle.clone(),
            language.to_string(),
            project_root.to_string(),
            Arc::clone(&child),
            Arc::clone(&status),
        ));
        let log_handle = tokio::spawn(Self::forward_logs(
            self.app_handle.clone(),
            language.to_string(),
            stderr_lines,
        ));

        let root_uri = path_to_uri(project_root);
        let params = InitializeParams {
            process_id: Some(std::process::id()),
            root_path: Some(project_root.to_string()),
            root_uri: Some(root_uri),
            capabilities: ClientCapabilities {
                text_document: Some({
                    let mut map = HashMap::new();
                    map.insert(
                        "synchronization".to_string(),
                        serde_json::json!({ "dynamicRegistration": false, "willSave": false, "willSaveWaitUntil": false, "didSave": true }),
                    );
                    map.insert(
                        "publishDiagnostics".to_string(),
                        serde_json::json!({ "dynamicRegistration": false }),
                    );
                    map
                }),
            },
        };

        if let Err(e) = client.initialize(params).await {
            let _ = child.lock().await.kill().await;
            notification_handle.abort();
            supervisor_handle.abort();
            log_handle.abort();
            self.emit_status(
                language,
                project_root,
                LspServerStatus::Error,
                Some(e.to_string()),
            );
            return Err(e.to_string());
        }

        if let Err(e) = client.initialized().await {
            let _ = child.lock().await.kill().await;
            notification_handle.abort();
            supervisor_handle.abort();
            log_handle.abort();
            self.emit_status(
                language,
                project_root,
                LspServerStatus::Error,
                Some(e.to_string()),
            );
            return Err(e.to_string());
        }

        {
            let mut servers = self.servers.write().await;
            servers.insert(
                key,
                RunningServer {
                    client,
                    child,
                    status,
                    notification_handle,
                    supervisor_handle,
                    log_handle,
                },
            );
        }

        self.emit_status(language, project_root, LspServerStatus::Running, None);
        Ok(())
    }

    pub async fn stop_server(
        &self,
        language: &str,
        project_root: &str,
    ) -> std::result::Result<(), String> {
        let key = (language.to_string(), project_root.to_string());
        let server = {
            let mut servers = self.servers.write().await;
            servers.remove(&key)
        };

        if let Some(server) = server {
            Self::stop_running_server(server).await;
            self.emit_status(language, project_root, LspServerStatus::Stopped, None);
            Ok(())
        } else {
            Err(format!(
                "No running server for {language} in {project_root}"
            ))
        }
    }

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
                language_id: language.to_string(),
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
    ) -> std::result::Result<(), String> {
        let client = self.get_client(language, project_root).await?;
        let uri = path_to_uri(file_path);

        let next_version = {
            let mut versions = self.document_versions.lock().await;
            let version = versions.get(&uri).copied().unwrap_or(1) + 1;
            versions.insert(uri.clone(), version);
            version
        };

        let params = DidChangeTextDocumentParams {
            text_document: VersionedTextDocumentIdentifier {
                uri,
                version: next_version,
            },
            content_changes: vec![TextDocumentContentChangeEvent {
                text: content.to_string(),
            }],
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

    async fn get_client(
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

    async fn stop_running_server(server: RunningServer) {
        {
            let mut child = server.child.lock().await;
            let _ = child.kill().await;
        }
        server.notification_handle.abort();
        server.supervisor_handle.abort();
        server.log_handle.abort();
    }

    async fn supervise(
        app_handle: AppHandle,
        language: String,
        project_root: String,
        child: Arc<Mutex<Child>>,
        status: Arc<Mutex<LspServerStatus>>,
    ) {
        let exit = {
            let mut child = child.lock().await;
            child.wait().await
        };

        let (new_status, error) = match exit {
            Ok(code) if code.success() => (LspServerStatus::Stopped, None),
            Ok(code) => {
                let message = format!("exited with code {}", code.code().unwrap_or(-1));
                log::error!("LSP server {language} crashed: {message}");
                (LspServerStatus::Error, Some(message))
            }
            Err(err) => {
                let message = format!("wait failed: {err}");
                log::error!("LSP server {language} crashed: {message}");
                (LspServerStatus::Error, Some(message))
            }
        };

        {
            let mut s = status.lock().await;
            *s = new_status;
        }

        let _ = app_handle.emit(
            "lsp_status_changed",
            LspStatusEvent {
                language,
                project_root,
                status: new_status,
                error,
            },
        );
    }

    async fn forward_notifications(
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
                        Err(e) => {
                            log::warn!("Failed to parse publishDiagnostics notification: {e}");
                        }
                    }
                }
            }
        }
    }

    async fn forward_logs(
        app_handle: AppHandle,
        language: String,
        mut rx: tokio::sync::mpsc::UnboundedReceiver<String>,
    ) {
        while let Some(line) = rx.recv().await {
            log::debug!("LSP {language} stderr: {line}");
            let _ = app_handle.emit(
                "lsp_log",
                serde_json::json!({
                    "language": language,
                    "line": line,
                }),
            );
        }
    }

    fn emit_status(
        &self,
        language: &str,
        project_root: &str,
        status: LspServerStatus,
        error: Option<String>,
    ) {
        let _ = self.app_handle.emit(
            "lsp_status_changed",
            LspStatusEvent {
                language: language.to_string(),
                project_root: project_root.to_string(),
                status,
                error,
            },
        );
    }
}

fn server_config_for_language(language: &str) -> Option<LspServerConfig> {
    SERVERS
        .iter()
        .find(|(l, _, _)| *l == language)
        .map(|(_, cmd, args)| LspServerConfig {
            command: cmd.to_string(),
            args: args.iter().map(|a| a.to_string()).collect(),
        })
}

pub fn resolve_project_root(file_path: &str) -> Option<String> {
    let path = Path::new(file_path);
    let mut current = path.parent()?;

    loop {
        if current.join("tsconfig.json").exists() || current.join("package.json").exists() {
            return current.to_str().map(|s| s.to_string());
        }

        match current.parent() {
            Some(parent) => current = parent,
            None => break,
        }
    }

    path.parent()
        .and_then(|p| p.to_str())
        .map(|s| s.to_string())
}

fn path_to_uri(path: &str) -> String {
    format!("file://{path}")
}

fn uri_to_path(uri: &str) -> String {
    uri.strip_prefix("file://").unwrap_or(uri).to_string()
}
