use crate::modules::dap::client::DapClient;
use crate::modules::dap::types::{
    build_launch_arguments, DapFileBreakpoints, DapInitializeArguments, DapSessionStatus,
    DapStartRequest, DapStatusEvent,
};
use crate::modules::run::{parse_command, resolve_cwd};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::process::Child;
use tokio::sync::{Mutex, RwLock};

use super::adapters::{adapters_dir, check_adapter_available, resolve_adapter, ADAPTERS};

const INITIALIZED_WAIT_TIMEOUT: Duration = Duration::from_secs(3);
const DISCONNECT_TIMEOUT_MS: u64 = 2_000;
const EXIT_WAIT_TIMEOUT: Duration = Duration::from_secs(1);

struct LaunchParams<'a> {
    adapter: &'a str,
    dap_id: &'a str,
    request: &'a str,
    name: &'a str,
    program: &'a str,
    args: &'a [String],
    cwd: &'a str,
    env: &'a HashMap<String, String>,
}

pub(super) struct RunningSession {
    client: DapClient,
    child: Arc<Mutex<Child>>,
    event_handle: tokio::task::JoinHandle<()>,
    log_handle: tokio::task::JoinHandle<()>,
}

pub(super) type SessionSlot = Arc<RwLock<Option<Arc<RunningSession>>>>;

pub struct DapManager {
    pub(super) app_handle: AppHandle,
    pub(super) session: SessionSlot,
    pub(super) start_lock: Mutex<()>,
}

impl DapManager {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            app_handle,
            session: Arc::new(RwLock::new(None)),
            start_lock: Mutex::new(()),
        }
    }

    pub fn managed(app_handle: AppHandle) -> Self {
        Self::new(app_handle)
    }

    pub async fn start_session(&self, params: DapStartRequest) -> std::result::Result<(), String> {
        let _guard = self.start_lock.lock().await;

        {
            let session = self.session.read().await;
            if session.is_some() {
                return Err("A debug session is already running. Stop it first.".to_string());
            }
        }

        let adapter = params.adapter.as_str();
        let entry = ADAPTERS
            .iter()
            .find(|a| a.id == adapter)
            .ok_or_else(|| format!("No debug adapter registered for '{adapter}'"))?;

        let adapters_dir = adapters_dir(&self.app_handle).ok();
        let config = resolve_adapter(adapter, adapters_dir.as_deref())
            .ok_or_else(|| format!("No debug adapter registered for '{adapter}'"))?;

        if !check_adapter_available(adapter, adapters_dir.as_deref()).await {
            let hint = entry
                .install_hint
                .map(|h| format!(" Install it with: {h}"))
                .unwrap_or_default();
            return Err(format!(
                "Debug adapter '{}' is not available.{hint}",
                entry.label
            ));
        }

        let request = params.request.as_deref().unwrap_or("launch");
        let (program, args) = parse_command(&params.command);
        if program.is_empty() && request == "launch" {
            return Err("Empty command".to_string());
        }
        let cwd = resolve_cwd(params.cwd.as_deref(), &params.workspace_root);

        self.emit_status(DapSessionStatus::Starting, Some(adapter), None);

        let (client, child, events, stderr_lines) = match DapClient::start(config).await {
            Ok(parts) => parts,
            Err(e) => {
                self.emit_status(DapSessionStatus::Error, Some(adapter), Some(e.to_string()));
                return Err(e.to_string());
            }
        };

        let child = Arc::new(Mutex::new(child));
        let (initialized_tx, initialized_rx) = tokio::sync::oneshot::channel::<()>();
        let event_handle = tokio::spawn(Self::forward_events(
            self.app_handle.clone(),
            adapter.to_string(),
            Arc::clone(&self.session),
            events,
            Some(initialized_tx),
        ));
        let log_handle = tokio::spawn(Self::forward_logs(
            self.app_handle.clone(),
            adapter.to_string(),
            stderr_lines,
        ));

        let launch = LaunchParams {
            adapter,
            dap_id: entry.dap_id,
            request,
            name: params.name.as_deref().unwrap_or(adapter),
            program: &program,
            args: &args,
            cwd: &cwd,
            env: &params.env,
        };
        let result = self
            .handshake(&client, &launch, params.breakpoints, initialized_rx)
            .await;

        if let Err(e) = result {
            let _ = child.lock().await.start_kill();
            event_handle.abort();
            log_handle.abort();
            self.emit_status(DapSessionStatus::Error, Some(adapter), Some(e.clone()));
            return Err(e);
        }

        {
            let mut session = self.session.write().await;
            *session = Some(Arc::new(RunningSession {
                client,
                child,
                event_handle,
                log_handle,
            }));
        }

        self.emit_status(DapSessionStatus::Running, Some(adapter), None);
        Ok(())
    }

    async fn handshake(
        &self,
        client: &DapClient,
        launch: &LaunchParams<'_>,
        breakpoints: Vec<DapFileBreakpoints>,
        initialized_rx: tokio::sync::oneshot::Receiver<()>,
    ) -> std::result::Result<(), String> {
        client
            .request(
                "initialize",
                Some(
                    serde_json::to_value(DapInitializeArguments::new(launch.dap_id))
                        .map_err(|e| e.to_string())?,
                ),
                None,
            )
            .await
            .map_err(|e| e.to_string())?;

        // The adapter signals readiness for configuration requests with the
        // `initialized` event; some adapters accept them right away, so a
        // timeout only delays the start instead of failing it.
        let _ = tokio::time::timeout(INITIALIZED_WAIT_TIMEOUT, initialized_rx).await;

        for file in breakpoints {
            if file.lines.is_empty() {
                continue;
            }
            client
                .request(
                    "setBreakpoints",
                    Some(serde_json::json!({
                        "source": { "path": file.path },
                        "breakpoints": file.lines.iter().map(|line| serde_json::json!({ "line": line })).collect::<Vec<_>>(),
                        "sourceModified": false,
                    })),
                    None,
                )
                .await
                .map_err(|e| e.to_string())?;
        }

        let arguments = build_launch_arguments(
            launch.adapter,
            launch.request,
            launch.name,
            launch.program,
            launch.args,
            launch.cwd,
            launch.env,
        )?;
        client
            .request(launch.request, Some(arguments), None)
            .await
            .map_err(|e| e.to_string())?;

        // Not every adapter supports configurationDone; ignore its failure.
        // It is sent after launch because some adapters (e.g. debugpy) start
        // the debuggee on launch and expect configuration to be complete by
        // the time they run.
        let _ = client.request("configurationDone", None, None).await;

        Ok(())
    }

    pub async fn stop_session(&self) -> std::result::Result<(), String> {
        let session = {
            let mut slot = self.session.write().await;
            slot.take()
        };

        let session = session.ok_or_else(|| "No active debug session".to_string())?;
        Self::stop_running_session(&session).await;
        self.emit_status(DapSessionStatus::Stopped, None, None);
        Ok(())
    }

    pub async fn shutdown_all(&self) {
        let session = {
            let mut slot = self.session.write().await;
            slot.take()
        };

        if let Some(session) = session {
            Self::stop_running_session(&session).await;
        }
    }

    async fn stop_running_session(session: &RunningSession) {
        let _ = session
            .client
            .request(
                "disconnect",
                Some(serde_json::json!({ "terminateDebuggee": true })),
                Some(DISCONNECT_TIMEOUT_MS),
            )
            .await;

        let exited = tokio::time::timeout(EXIT_WAIT_TIMEOUT, async {
            loop {
                {
                    let mut child = session.child.lock().await;
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
            let mut child = session.child.lock().await;
            let _ = child.start_kill();
        }

        session.event_handle.abort();
        session.log_handle.abort();
    }

    pub(super) async fn get_client(&self) -> std::result::Result<DapClient, String> {
        let session = self.session.read().await;
        session
            .as_ref()
            .map(|s| s.client.clone())
            .ok_or_else(|| "No active debug session".to_string())
    }

    fn emit_status(&self, status: DapSessionStatus, adapter: Option<&str>, error: Option<String>) {
        let _ = self.app_handle.emit(
            "dap_status_changed",
            DapStatusEvent {
                status,
                adapter: adapter.map(|a| a.to_string()),
                error,
            },
        );
    }
}
