use crate::modules::mcp::client::{McpClient, McpClientConfig, Notification};
use crate::modules::mcp::error::McpError;
use crate::modules::mcp::{config_path, McpServerConfig};
use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};
use tokio::process::Child;
use tokio::sync::{mpsc, Mutex};

const DEBOUNCE_MS: u64 = 500;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum McpServerStatus {
    Stopped,
    Starting,
    Running,
    Error,
}

#[derive(Debug, Clone, Serialize)]
pub struct McpServerState {
    pub config: McpServerConfig,
    pub status: McpServerStatus,
}

#[derive(Debug, Clone, Serialize)]
struct McpStatusEvent {
    server_id: String,
    status: McpServerStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
struct McpNotificationEvent {
    server_id: String,
    method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    params: Option<Value>,
}

struct RunningServer {
    #[allow(dead_code)]
    client: McpClient,
    child: Arc<Mutex<Child>>,
    status: Arc<Mutex<McpServerStatus>>,
    #[allow(dead_code)]
    notification_handle: tokio::task::JoinHandle<()>,
    #[allow(dead_code)]
    supervisor_handle: tokio::task::JoinHandle<()>,
}

pub struct McpManager {
    app_handle: AppHandle,
    servers: Mutex<HashMap<String, RunningServer>>,
    config: Mutex<Vec<McpServerConfig>>,
    watcher: Mutex<RecommendedWatcher>,
    watcher_rx: Mutex<mpsc::Receiver<()>>,
}

impl McpManager {
    pub async fn initialize(app_handle: AppHandle) -> crate::modules::mcp::error::Result<()> {
        let manager = Self::new(app_handle.clone()).await?;
        app_handle.manage(manager);

        let handle = app_handle.clone();
        tauri::async_runtime::spawn(async move {
            if let Some(manager) = handle.try_state::<McpManager>() {
                manager.run().await;
            }
        });

        Ok(())
    }

    async fn new(app_handle: AppHandle) -> crate::modules::mcp::error::Result<Self> {
        let (watcher_tx, watcher_rx) = mpsc::channel::<()>(1);
        let watcher = create_config_watcher(watcher_tx)?;

        let manager = Self {
            app_handle: app_handle.clone(),
            servers: Mutex::new(HashMap::new()),
            config: Mutex::new(Vec::new()),
            watcher: Mutex::new(watcher),
            watcher_rx: Mutex::new(watcher_rx),
        };

        manager.reload_config().await?;

        let path = config_path(&app_handle).map_err(|e| McpError::Config(e))?;
        if let Some(parent) = path.parent() {
            let mut watcher = manager.watcher.lock().await;
            watcher
                .watch(parent, RecursiveMode::NonRecursive)
                .map_err(|e| McpError::Watcher(e.to_string()))?;
        }

        Ok(manager)
    }

    pub async fn run(&self) {
        let mut rx = self.watcher_rx.lock().await;
        while rx.recv().await.is_some() {
            tokio::time::sleep(Duration::from_millis(DEBOUNCE_MS)).await;
            while rx.try_recv().is_ok() {}

            if let Err(e) = self.reload_config().await {
                log::error!("Failed to reload MCP config: {e}");
            }
        }
    }

    pub async fn reload_config(&self) -> crate::modules::mcp::error::Result<()> {
        let path = config_path(&self.app_handle).map_err(|e| McpError::Config(e))?;
        let content = if path.exists() {
            tokio::fs::read_to_string(&path)
                .await
                .map_err(|e| McpError::Config(e.to_string()))?
        } else {
            String::new()
        };

        let file: crate::modules::mcp::McpConfigFile = if content.trim().is_empty() {
            crate::modules::mcp::McpConfigFile {
                servers: Vec::new(),
            }
        } else {
            serde_json::from_str(&content).map_err(|e| McpError::Config(e.to_string()))?
        };

        self.apply_config(file.servers).await;
        Ok(())
    }

    async fn apply_config(&self, new_config: Vec<McpServerConfig>) {
        {
            let mut servers = self.servers.lock().await;
            for (_, server) in servers.drain() {
                Self::stop_running_server(server).await;
            }
        }

        *self.config.lock().await = new_config.clone();

        for config in new_config {
            if config.autostart {
                if let Err(e) = self.start_server_internal(&config).await {
                    log::error!("Failed to autostart MCP server {}: {e}", config.id);
                }
            }
        }
    }

    pub async fn list_servers(&self) -> Vec<McpServerState> {
        let config = self.config.lock().await;
        let servers = self.servers.lock().await;

        config
            .iter()
            .map(|c| {
                let status = if let Some(server) = servers.get(&c.id) {
                    *server.status.blocking_lock()
                } else {
                    McpServerStatus::Stopped
                };
                McpServerState {
                    config: c.clone(),
                    status,
                }
            })
            .collect()
    }

    pub async fn server_status(&self, id: &str) -> Option<McpServerStatus> {
        let servers = self.servers.lock().await;
        if let Some(server) = servers.get(id) {
            Some(*server.status.lock().await)
        } else {
            None
        }
    }

    pub async fn start_server(&self, id: &str) -> crate::modules::mcp::error::Result<()> {
        let config = self
            .config
            .lock()
            .await
            .iter()
            .find(|c| c.id == id)
            .cloned();

        match config {
            Some(config) => self.start_server_internal(&config).await,
            None => Err(McpError::ServerNotFound(id.to_string())),
        }
    }

    pub async fn stop_server(&self, id: &str) -> crate::modules::mcp::error::Result<()> {
        let server = {
            let mut servers = self.servers.lock().await;
            servers.remove(id)
        };

        if let Some(server) = server {
            Self::stop_running_server(server).await;
            self.emit_status(id, McpServerStatus::Stopped, None);
            Ok(())
        } else {
            Err(McpError::ServerNotFound(id.to_string()))
        }
    }

    pub async fn restart_server(&self, id: &str) -> crate::modules::mcp::error::Result<()> {
        let _ = self.stop_server(id).await;
        self.start_server(id).await
    }

    async fn start_server_internal(
        &self,
        config: &McpServerConfig,
    ) -> crate::modules::mcp::error::Result<()> {
        {
            let servers = self.servers.lock().await;
            if servers.contains_key(&config.id) {
                return Err(McpError::AlreadyRunning(config.id.clone()));
            }
        }

        let client_config = McpClientConfig {
            command: config.command.clone(),
            args: config.args.clone(),
            env: config.env.clone(),
            request_timeout_ms: None,
        };

        self.emit_status(&config.id, McpServerStatus::Starting, None);

        let (client, child, notifications) = McpClient::start(client_config).await?;
        let child = Arc::new(Mutex::new(child));
        let status = Arc::new(Mutex::new(McpServerStatus::Running));

        let notification_handle = tokio::spawn(Self::forward_notifications(
            self.app_handle.clone(),
            config.id.clone(),
            notifications,
        ));
        let supervisor_handle = tokio::spawn(Self::supervise(
            self.app_handle.clone(),
            config.id.clone(),
            Arc::clone(&child),
            Arc::clone(&status),
        ));

        {
            let mut servers = self.servers.lock().await;
            servers.insert(
                config.id.clone(),
                RunningServer {
                    client,
                    child,
                    status,
                    notification_handle,
                    supervisor_handle,
                },
            );
        }

        self.emit_status(&config.id, McpServerStatus::Running, None);
        Ok(())
    }

    async fn stop_running_server(server: RunningServer) {
        {
            let mut child = server.child.lock().await;
            let _ = child.kill().await;
        }
        server.notification_handle.abort();
        server.supervisor_handle.abort();
    }

    async fn supervise(
        app_handle: AppHandle,
        id: String,
        child: Arc<Mutex<Child>>,
        status: Arc<Mutex<McpServerStatus>>,
    ) {
        let exit = {
            let mut child = child.lock().await;
            child.wait().await
        };

        let (new_status, error) = match exit {
            Ok(code) if code.success() => (McpServerStatus::Stopped, None),
            Ok(code) => {
                let message = format!("exited with code {}", code.code().unwrap_or(-1));
                log::error!("MCP server {id} crashed: {message}");
                (McpServerStatus::Error, Some(message))
            }
            Err(err) => {
                let message = format!("wait failed: {err}");
                log::error!("MCP server {id} crashed: {message}");
                (McpServerStatus::Error, Some(message))
            }
        };

        {
            let mut s = status.lock().await;
            *s = new_status;
        }

        let _ = app_handle.emit(
            "mcp_status_changed",
            McpStatusEvent {
                server_id: id,
                status: new_status,
                error,
            },
        );
    }

    async fn forward_notifications(
        app_handle: AppHandle,
        id: String,
        mut rx: mpsc::UnboundedReceiver<Notification>,
    ) {
        while let Some(notification) = rx.recv().await {
            let event = McpNotificationEvent {
                server_id: id.clone(),
                method: notification.method,
                params: notification.params,
            };
            let _ = app_handle.emit("mcp_notification", event);
        }
    }

    fn emit_status(&self, id: &str, status: McpServerStatus, error: Option<String>) {
        let _ = self.app_handle.emit(
            "mcp_status_changed",
            McpStatusEvent {
                server_id: id.to_string(),
                status,
                error,
            },
        );
    }
}

fn create_config_watcher(
    tx: mpsc::Sender<()>,
) -> crate::modules::mcp::error::Result<RecommendedWatcher> {
    RecommendedWatcher::new(
        move |res: notify::Result<Event>| {
            if let Ok(event) = res {
                if event.kind.is_modify() || event.kind.is_create() {
                    let _ = tx.try_send(());
                }
            }
        },
        Config::default(),
    )
    .map_err(|e| McpError::Watcher(e.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn status_serializes_to_lowercase() {
        assert_eq!(
            serde_json::to_string(&McpServerStatus::Running).unwrap(),
            "\"running\""
        );
        assert_eq!(
            serde_json::to_string(&McpServerStatus::Stopped).unwrap(),
            "\"stopped\""
        );
        assert_eq!(
            serde_json::to_string(&McpServerStatus::Error).unwrap(),
            "\"error\""
        );
    }
}
