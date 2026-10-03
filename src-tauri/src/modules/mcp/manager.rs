use crate::modules::mcp::client::Notification;
use crate::modules::mcp::connection::{McpConnection, McpServerCapabilities};
use crate::modules::mcp::error::McpError;
use crate::modules::mcp::start::connect;
use crate::modules::mcp::tools::{call_tool, list_tools, McpTool, McpToolCallResult};
use crate::modules::mcp::{
    config_path, load_tools_cache, save_tools_cache, secrets, write_config_file, McpServerConfig,
    CONFIG_VERSION,
};
use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use serde_json::Value;
use std::collections::{HashMap, HashSet};
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
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    auth_required: bool,
}

#[derive(Debug, Clone, Serialize)]
struct McpListChangedEvent {
    server_id: String,
    kind: &'static str,
}

/// The list a `notifications/*/list_changed` method refers to.
fn list_changed_kind(method: &str) -> Option<&'static str> {
    match method {
        "notifications/tools/list_changed" => Some("tools"),
        "notifications/resources/list_changed" => Some("resources"),
        "notifications/prompts/list_changed" => Some("prompts"),
        _ => None,
    }
}

#[derive(Debug, Clone, Serialize)]
struct McpNotificationEvent {
    server_id: String,
    method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    params: Option<Value>,
}

#[derive(Debug, Clone, Serialize)]
struct McpLogEvent {
    server_id: String,
    timestamp: String,
    line: String,
}

struct RunningServer {
    client: McpConnection,
    child: Option<Arc<Mutex<Child>>>,
    status: Arc<Mutex<McpServerStatus>>,
    capabilities: McpServerCapabilities,
    tasks: Vec<tokio::task::JoinHandle<()>>,
}

pub struct McpManager {
    app_handle: AppHandle,
    servers: Mutex<HashMap<String, RunningServer>>,
    tools: Mutex<HashMap<String, Vec<McpTool>>>,
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
            tools: Mutex::new(HashMap::new()),
            config: Mutex::new(Vec::new()),
            watcher: Mutex::new(watcher),
            watcher_rx: Mutex::new(watcher_rx),
        };

        manager.reload_config().await?;
        if let Err(_e) = manager.hydrate_tools_cache().await {}

        let path = config_path(&app_handle).map_err(McpError::Config)?;
        if let Some(parent) = path.parent() {
            tokio::fs::create_dir_all(parent)
                .await
                .map_err(|e| McpError::Config(format!("Failed to create config directory: {e}")))?;
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

            if let Err(_e) = self.reload_config().await {}
        }
    }

    pub async fn reload_config(&self) -> crate::modules::mcp::error::Result<()> {
        let path = config_path(&self.app_handle).map_err(McpError::Config)?;
        let content = if path.exists() {
            tokio::fs::read_to_string(&path)
                .await
                .map_err(|e| McpError::Config(e.to_string()))?
        } else {
            String::new()
        };

        let mut file: crate::modules::mcp::McpConfigFile = if content.trim().is_empty() {
            crate::modules::mcp::McpConfigFile {
                version: CONFIG_VERSION,
                servers: Vec::new(),
            }
        } else {
            serde_json::from_str(&content).map_err(|e| McpError::Config(e.to_string()))?
        };

        if file.version < CONFIG_VERSION {
            secrets::migrate_plain_secrets(&mut file.servers);
            write_config_file(&path, file.servers.clone())
                .await
                .map_err(McpError::Config)?;
        }

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

        {
            let previous_ids: Vec<String> = {
                let tools = self.tools.lock().await;
                tools.keys().cloned().collect()
            };
            let new_ids: HashSet<String> = new_config.iter().map(|c| c.id.clone()).collect();
            let mut tools = self.tools.lock().await;
            for id in previous_ids {
                if !new_ids.contains(&id) {
                    tools.remove(&id);
                }
            }
        }

        for config in new_config {
            if config.autostart {
                if let Err(_e) = self.start_server_internal(&config).await {}
            }
        }
    }

    pub async fn list_servers(&self) -> Vec<McpServerState> {
        let configs = self.config.lock().await.clone();
        let servers = self.servers.lock().await;

        let mut statuses: HashMap<String, McpServerStatus> = HashMap::new();
        for (id, server) in servers.iter() {
            statuses.insert(id.clone(), *server.status.lock().await);
        }

        configs
            .into_iter()
            .map(|c| {
                let status = statuses
                    .get(&c.id)
                    .copied()
                    .unwrap_or(McpServerStatus::Stopped);
                McpServerState { config: c, status }
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

        self.emit_status(&config.id, McpServerStatus::Starting, None);

        let connected = match connect(config).await {
            Ok(connected) => connected,
            Err(err) => {
                let auth_required = matches!(err, McpError::AuthRequired(_));
                self.emit(
                    &config.id,
                    McpServerStatus::Error,
                    Some(err.to_string()),
                    auth_required,
                );
                return Err(err);
            }
        };

        let status = Arc::new(Mutex::new(McpServerStatus::Running));
        let mut tasks = vec![tokio::spawn(Self::forward_notifications(
            self.app_handle.clone(),
            config.id.clone(),
            connected.notifications,
        ))];
        let child = connected.child.map(|child| Arc::new(Mutex::new(child)));
        if let Some(child) = &child {
            tasks.push(tokio::spawn(Self::supervise(
                self.app_handle.clone(),
                config.id.clone(),
                Arc::clone(child),
                Arc::clone(&status),
            )));
        }
        if let Some(stderr) = connected.stderr {
            tasks.push(tokio::spawn(Self::forward_logs(
                self.app_handle.clone(),
                config.id.clone(),
                stderr,
            )));
        }
        tasks.extend(connected.event_stream);

        {
            let mut servers = self.servers.lock().await;
            servers.insert(
                config.id.clone(),
                RunningServer {
                    client: connected.connection,
                    child,
                    status,
                    capabilities: connected.capabilities,
                    tasks,
                },
            );
        }

        self.refresh_tools(&config.id).await;
        self.emit_status(&config.id, McpServerStatus::Running, None);
        Ok(())
    }

    /// The live connection of a running server.
    pub(super) async fn connection(
        &self,
        id: &str,
    ) -> crate::modules::mcp::error::Result<McpConnection> {
        let servers = self.servers.lock().await;
        servers
            .get(id)
            .map(|server| server.client.clone())
            .ok_or_else(|| McpError::ServerNotFound(id.to_string()))
    }

    pub async fn capabilities(&self, id: &str) -> Option<McpServerCapabilities> {
        let servers = self.servers.lock().await;
        servers.get(id).map(|server| server.capabilities.clone())
    }

    pub async fn config_for(&self, id: &str) -> Option<McpServerConfig> {
        self.config
            .lock()
            .await
            .iter()
            .find(|c| c.id == id)
            .cloned()
    }

    pub async fn get_tools(&self, id: &str) -> Vec<McpTool> {
        let tools = self.tools.lock().await;
        tools.get(id).cloned().unwrap_or_default()
    }

    async fn hydrate_tools_cache(&self) -> crate::modules::mcp::error::Result<()> {
        let cache = load_tools_cache(&self.app_handle)
            .await
            .map_err(McpError::Config)?;
        let mut tools = self.tools.lock().await;
        for (id, server_tools) in cache {
            tools.entry(id).or_insert(server_tools);
        }
        Ok(())
    }

    async fn persist_tools_cache(&self) {
        let cache = self.tools.lock().await.clone();
        if let Err(_e) = save_tools_cache(&self.app_handle, &cache).await {}
    }

    pub async fn refresh_tools(&self, id: &str) {
        let client = {
            let servers = self.servers.lock().await;
            servers.get(id).map(|server| server.client.clone())
        };

        if let Some(client) = client {
            match list_tools(&client).await {
                Ok(tools) => {
                    let mut cache = self.tools.lock().await;
                    cache.insert(id.to_string(), tools);
                    drop(cache);
                    self.persist_tools_cache().await;
                }
                Err(_e) => {}
            }
        }
    }

    pub async fn call_tool(
        &self,
        id: &str,
        tool_name: &str,
        arguments: Option<Value>,
    ) -> crate::modules::mcp::error::Result<McpToolCallResult> {
        let client = {
            let servers = self.servers.lock().await;
            servers.get(id).map(|server| server.client.clone())
        };

        let client = client.ok_or_else(|| McpError::ServerNotFound(id.to_string()))?;

        let result = call_tool(&client, tool_name, arguments)
            .await
            .map_err(|e| McpError::ToolCallFailed(e.to_string()))?;

        Ok(result)
    }

    async fn stop_running_server(server: RunningServer) {
        if let Some(child) = &server.child {
            let mut child = child.lock().await;
            let _ = child.kill().await;
        }
        if let McpConnection::Http(client) = &server.client {
            client.close().await;
        }
        for task in server.tasks {
            task.abort();
        }
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
                (McpServerStatus::Error, Some(message))
            }
            Err(err) => {
                let message = format!("wait failed: {err}");
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
                auth_required: false,
            },
        );
    }

    async fn forward_notifications(
        app_handle: AppHandle,
        id: String,
        mut rx: mpsc::UnboundedReceiver<Notification>,
    ) {
        while let Some(notification) = rx.recv().await {
            if let Some(kind) = list_changed_kind(&notification.method) {
                if kind == "tools" {
                    if let Some(manager) = app_handle.try_state::<McpManager>() {
                        manager.refresh_tools(&id).await;
                    }
                }
                let _ = app_handle.emit(
                    "mcp_list_changed",
                    McpListChangedEvent {
                        server_id: id.clone(),
                        kind,
                    },
                );
            }
            let event = McpNotificationEvent {
                server_id: id.clone(),
                method: notification.method,
                params: notification.params,
            };
            let _ = app_handle.emit("mcp_notification", event);
        }
    }

    async fn forward_logs(
        app_handle: AppHandle,
        id: String,
        mut rx: mpsc::UnboundedReceiver<String>,
    ) {
        while let Some(line) = rx.recv().await {
            let event = McpLogEvent {
                server_id: id.clone(),
                timestamp: chrono::Utc::now().to_rfc3339(),
                line,
            };
            let _ = app_handle.emit("mcp_log", event);
        }
    }

    fn emit_status(&self, id: &str, status: McpServerStatus, error: Option<String>) {
        self.emit(id, status, error, false);
    }

    fn emit(&self, id: &str, status: McpServerStatus, error: Option<String>, auth_required: bool) {
        let _ = self.app_handle.emit(
            "mcp_status_changed",
            McpStatusEvent {
                server_id: id.to_string(),
                status,
                error,
                auth_required,
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

    #[test]
    fn list_changed_methods_map_to_their_list() {
        assert_eq!(
            list_changed_kind("notifications/tools/list_changed"),
            Some("tools")
        );
        assert_eq!(
            list_changed_kind("notifications/prompts/list_changed"),
            Some("prompts")
        );
        assert_eq!(list_changed_kind("notifications/message"), None);
    }
}
