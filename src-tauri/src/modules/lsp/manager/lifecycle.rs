use super::capabilities::client_capabilities;
use super::config::server_config_for_language;
use super::{LspManager, RunningServer};
use crate::modules::lsp::client::{is_expected_start_error, LspClient};
use crate::modules::lsp::types::{InitializeParams, LspServerStatus, LspStatusEvent};
use crate::modules::lsp::uris::path_to_uri;
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::process::Child;
use tokio::sync::Mutex;

const SUPERVISE_POLL_INTERVAL: Duration = Duration::from_millis(500);
const EXIT_WAIT_TIMEOUT: Duration = Duration::from_secs(1);
const SHUTDOWN_ALL_TIMEOUT: Duration = Duration::from_secs(3);

impl LspManager {
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

        let _guard = self.start_lock.lock().await;

        {
            let servers = self.servers.read().await;
            if servers.contains_key(&key) {
                return Ok(());
            }
        }

        let config = server_config_for_language(language)
            .ok_or_else(|| format!("No LSP server configured for language '{language}'"))?;

        self.emit_status(
            language,
            project_root,
            LspServerStatus::Starting,
            None,
            None,
        );

        let (client, child, notifications, stderr_lines) = match LspClient::start(config).await {
            Ok(started) => started,
            Err(e) => {
                let expected = is_expected_start_error(&e);
                self.emit_status(
                    language,
                    project_root,
                    if expected {
                        LspServerStatus::Stopped
                    } else {
                        LspServerStatus::Error
                    },
                    Some(e.to_string()),
                    Some(expected),
                );
                return Err(e.to_string());
            }
        };

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
            capabilities: client_capabilities(),
        };

        let initialize_result = match client.initialize(params).await {
            Ok(result) => result,
            Err(e) => {
                let _ = child.lock().await.start_kill();
                notification_handle.abort();
                supervisor_handle.abort();
                log_handle.abort();
                self.emit_status(
                    language,
                    project_root,
                    LspServerStatus::Error,
                    Some(e.to_string()),
                    Some(false),
                );
                return Err(e.to_string());
            }
        };

        if let Err(e) = client.initialized().await {
            let _ = child.lock().await.start_kill();
            notification_handle.abort();
            supervisor_handle.abort();
            log_handle.abort();
            self.emit_status(
                language,
                project_root,
                LspServerStatus::Error,
                Some(e.to_string()),
                Some(false),
            );
            return Err(e.to_string());
        }

        {
            let mut servers = self.servers.write().await;
            servers.insert(
                key,
                RunningServer {
                    client,
                    capabilities: initialize_result.capabilities,
                    child,
                    status,
                    notification_handle,
                    supervisor_handle,
                    log_handle,
                },
            );
        }

        self.emit_status(language, project_root, LspServerStatus::Running, None, None);
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
            self.emit_status(language, project_root, LspServerStatus::Stopped, None, None);
            Ok(())
        } else {
            Err(format!(
                "No running server for {language} in {project_root}"
            ))
        }
    }

    async fn stop_running_server(server: RunningServer) {
        let _ = server.client.shutdown().await;
        let _ = server.client.exit().await;

        let exited = tokio::time::timeout(EXIT_WAIT_TIMEOUT, async {
            loop {
                {
                    let mut child = server.child.lock().await;
                    match child.try_wait() {
                        Ok(Some(_)) | Err(_) => return,
                        Ok(None) => {}
                    }
                }
                tokio::time::sleep(Duration::from_millis(50)).await;
            }
        })
        .await;

        if exited.is_err() {
            let mut child = server.child.lock().await;
            let _ = child.start_kill();
        }

        server.notification_handle.abort();
        server.supervisor_handle.abort();
        server.log_handle.abort();
    }

    pub async fn shutdown_all(&self) {
        let servers: Vec<RunningServer> = {
            let mut map = self.servers.write().await;
            map.drain().map(|(_, server)| server).collect()
        };

        let mut handles = Vec::with_capacity(servers.len());
        for server in servers {
            handles.push(tokio::spawn(Self::stop_running_server(server)));
        }

        let _ = tokio::time::timeout(SHUTDOWN_ALL_TIMEOUT, async {
            for handle in handles {
                let _ = handle.await;
            }
        })
        .await;

        self.document_versions.lock().await.clear();
    }

    async fn supervise(
        app_handle: AppHandle,
        language: String,
        project_root: String,
        child: Arc<Mutex<Child>>,
        status: Arc<Mutex<LspServerStatus>>,
    ) {
        let exit = loop {
            {
                let mut guard = child.lock().await;
                match guard.try_wait() {
                    Ok(Some(exit_status)) => break Ok(exit_status),
                    Ok(None) => {}
                    Err(err) => break Err(err),
                }
            }
            tokio::time::sleep(SUPERVISE_POLL_INTERVAL).await;
        };

        let (new_status, error) = match exit {
            Ok(code) if code.success() => (LspServerStatus::Stopped, None),
            Ok(code) => {
                let message = format!("exited with code {}", code.code().unwrap_or(-1));
                (LspServerStatus::Error, Some(message))
            }
            Err(err) => {
                let message = format!("wait failed: {err}");
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
                expected: Some(false),
            },
        );
    }
}
