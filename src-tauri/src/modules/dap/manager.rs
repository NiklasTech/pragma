use crate::modules::dap::client::{DapClient, DapEventMessage};
use crate::modules::dap::types::{
    build_launch_arguments, DapAdapterConfig, DapAdapterInfo, DapBreakpoint, DapEvaluateResult,
    DapEvent, DapFileBreakpoints, DapInitializeArguments, DapInstallResult, DapScope,
    DapSessionStatus, DapStackFrame, DapStartRequest, DapStatusEvent, DapVariable,
};
use crate::modules::run::{parse_command, resolve_cwd};
use crate::platform::resolve_program;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::process::Child;
use tokio::sync::{Mutex, RwLock};

const INITIALIZED_WAIT_TIMEOUT: Duration = Duration::from_secs(3);
const DISCONNECT_TIMEOUT_MS: u64 = 2_000;
const EXIT_WAIT_TIMEOUT: Duration = Duration::from_secs(1);
const INSTALL_TIMEOUT: Duration = Duration::from_secs(180);

struct InstallCommand {
    program: &'static str,
    args: &'static [&'static str],
}

// Windows resolves `python` reliably via resolve_program, while a bare `pip`
// is often missing from PATH; elsewhere `pip` is the conventional entrypoint.
#[cfg(target_os = "windows")]
const PYTHON_INSTALL: InstallCommand = InstallCommand {
    program: "python",
    args: &["-m", "pip", "install", "debugpy"],
};
#[cfg(not(target_os = "windows"))]
const PYTHON_INSTALL: InstallCommand = InstallCommand {
    program: "pip",
    args: &["install", "debugpy"],
};

const NODE_INSTALL: InstallCommand = InstallCommand {
    program: "npm",
    args: &["install", "-g", "vscode-js-debug"],
};

struct AdapterEntry {
    id: &'static str,
    label: &'static str,
    dap_id: &'static str,
    install_hint: Option<&'static str>,
    install: Option<&'static InstallCommand>,
}

const ADAPTERS: &[AdapterEntry] = &[
    AdapterEntry {
        id: "node",
        label: "Node.js (vscode-js-debug)",
        dap_id: "pwa-node",
        install_hint: Some("npm install -g vscode-js-debug"),
        install: Some(&NODE_INSTALL),
    },
    AdapterEntry {
        id: "python",
        label: "Python (debugpy)",
        dap_id: "python",
        install_hint: Some("pip install debugpy"),
        install: Some(&PYTHON_INSTALL),
    },
];

/// Resolves an adapter id to a spawnable command.
///
/// Node: `PRAGMA_JS_DEBUG_PATH` may point at the vscode-js-debug
/// `dapDebugServer.js` entry (run through `node`); otherwise the
/// `js-debug-dap` binary from the `vscode-js-debug` npm package is used.
/// Python: `python -m debugpy.adapter` from the `debugpy` package.
fn resolve_adapter(id: &str) -> Option<DapAdapterConfig> {
    match id {
        "node" => {
            if let Ok(path) = std::env::var("PRAGMA_JS_DEBUG_PATH") {
                if !path.is_empty() {
                    return Some(DapAdapterConfig {
                        command: "node".to_string(),
                        args: vec![path],
                    });
                }
            }
            Some(DapAdapterConfig {
                command: "js-debug-dap".to_string(),
                args: Vec::new(),
            })
        }
        "python" => Some(DapAdapterConfig {
            command: "python".to_string(),
            args: vec!["-m".to_string(), "debugpy.adapter".to_string()],
        }),
        _ => None,
    }
}

async fn check_adapter_available(id: &str) -> bool {
    match id {
        "node" => {
            if let Ok(path) = std::env::var("PRAGMA_JS_DEBUG_PATH") {
                if !path.is_empty() {
                    return std::path::Path::new(&path).is_file()
                        && resolve_program("node").is_ok();
                }
            }
            resolve_program("js-debug-dap").is_ok()
        }
        "python" => {
            let program = match resolve_program("python") {
                Ok(p) => p,
                Err(_) => return false,
            };
            let output = crate::platform::new_tokio_command(&program)
                .args(["-c", "import debugpy"])
                .output()
                .await;
            matches!(output, Ok(out) if out.status.success())
        }
        _ => false,
    }
}

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

struct RunningSession {
    client: DapClient,
    child: Arc<Mutex<Child>>,
    event_handle: tokio::task::JoinHandle<()>,
    log_handle: tokio::task::JoinHandle<()>,
}

type SessionSlot = Arc<RwLock<Option<Arc<RunningSession>>>>;

pub struct DapManager {
    app_handle: AppHandle,
    session: SessionSlot,
    start_lock: Mutex<()>,
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

    pub async fn list_adapters() -> Vec<DapAdapterInfo> {
        let mut infos = Vec::with_capacity(ADAPTERS.len());
        for entry in ADAPTERS {
            infos.push(DapAdapterInfo {
                id: entry.id.to_string(),
                label: entry.label.to_string(),
                available: check_adapter_available(entry.id).await,
                install_hint: entry.install_hint.map(|h| h.to_string()),
            });
        }
        infos
    }

    pub async fn install_adapter(
        adapter_id: &str,
    ) -> std::result::Result<DapInstallResult, String> {
        let entry = ADAPTERS
            .iter()
            .find(|a| a.id == adapter_id)
            .ok_or_else(|| format!("No debug adapter registered for '{adapter_id}'"))?;
        let install = entry
            .install
            .ok_or_else(|| format!("No install command for adapter '{adapter_id}'"))?;

        let program = resolve_program(install.program)
            .map_err(|e| format!("Cannot install '{}': {e}", entry.label))?;
        let output = tokio::time::timeout(
            INSTALL_TIMEOUT,
            crate::platform::new_tokio_command(&program)
                .args(install.args)
                .output(),
        )
        .await
        .map_err(|_| {
            format!(
                "Install of '{}' timed out after {}s",
                entry.label,
                INSTALL_TIMEOUT.as_secs()
            )
        })?
        .map_err(|e| format!("Failed to run '{}': {e}", install.program))?;

        Ok(DapInstallResult {
            stdout: String::from_utf8_lossy(&output.stdout).to_string(),
            stderr: String::from_utf8_lossy(&output.stderr).to_string(),
            exit_code: output.status.code().unwrap_or(-1),
        })
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

        let config = resolve_adapter(adapter)
            .ok_or_else(|| format!("No debug adapter registered for '{adapter}'"))?;

        if !check_adapter_available(adapter).await {
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

        // Not every adapter supports configurationDone; ignore its failure.
        let _ = client.request("configurationDone", None, None).await;

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

    async fn get_client(&self) -> std::result::Result<DapClient, String> {
        let session = self.session.read().await;
        session
            .as_ref()
            .map(|s| s.client.clone())
            .ok_or_else(|| "No active debug session".to_string())
    }

    pub async fn set_breakpoints(
        &self,
        file_path: &str,
        lines: &[u32],
    ) -> std::result::Result<Vec<DapBreakpoint>, String> {
        let client = self.get_client().await?;
        let body = client
            .request(
                "setBreakpoints",
                Some(serde_json::json!({
                    "source": { "path": file_path },
                    "breakpoints": lines.iter().map(|line| serde_json::json!({ "line": line })).collect::<Vec<_>>(),
                    "sourceModified": false,
                })),
                None,
            )
            .await
            .map_err(|e| e.to_string())?;

        let breakpoints = body
            .get("breakpoints")
            .cloned()
            .unwrap_or(serde_json::Value::Array(Vec::new()));
        serde_json::from_value(breakpoints).map_err(|e| e.to_string())
    }

    pub async fn continue_(&self, thread_id: u64) -> std::result::Result<(), String> {
        let client = self.get_client().await?;
        client
            .request(
                "continue",
                Some(serde_json::json!({ "threadId": thread_id })),
                None,
            )
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn pause(&self, thread_id: u64) -> std::result::Result<(), String> {
        let client = self.get_client().await?;
        client
            .request(
                "pause",
                Some(serde_json::json!({ "threadId": thread_id })),
                None,
            )
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn next(&self, thread_id: u64) -> std::result::Result<(), String> {
        let client = self.get_client().await?;
        client
            .request(
                "next",
                Some(serde_json::json!({ "threadId": thread_id })),
                None,
            )
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn step_in(&self, thread_id: u64) -> std::result::Result<(), String> {
        let client = self.get_client().await?;
        client
            .request(
                "stepIn",
                Some(serde_json::json!({ "threadId": thread_id })),
                None,
            )
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn step_out(&self, thread_id: u64) -> std::result::Result<(), String> {
        let client = self.get_client().await?;
        client
            .request(
                "stepOut",
                Some(serde_json::json!({ "threadId": thread_id })),
                None,
            )
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn stack_trace(
        &self,
        thread_id: u64,
    ) -> std::result::Result<Vec<DapStackFrame>, String> {
        let client = self.get_client().await?;
        let body = client
            .request(
                "stackTrace",
                Some(serde_json::json!({
                    "threadId": thread_id,
                    "startFrame": 0,
                    "levels": 50,
                })),
                None,
            )
            .await
            .map_err(|e| e.to_string())?;

        let frames = body
            .get("stackFrames")
            .cloned()
            .unwrap_or(serde_json::Value::Array(Vec::new()));
        serde_json::from_value(frames).map_err(|e| e.to_string())
    }

    pub async fn scopes(&self, frame_id: u64) -> std::result::Result<Vec<DapScope>, String> {
        let client = self.get_client().await?;
        let body = client
            .request(
                "scopes",
                Some(serde_json::json!({ "frameId": frame_id })),
                None,
            )
            .await
            .map_err(|e| e.to_string())?;

        let scopes = body
            .get("scopes")
            .cloned()
            .unwrap_or(serde_json::Value::Array(Vec::new()));
        serde_json::from_value(scopes).map_err(|e| e.to_string())
    }

    pub async fn variables(
        &self,
        variables_reference: u64,
    ) -> std::result::Result<Vec<DapVariable>, String> {
        let client = self.get_client().await?;
        let body = client
            .request(
                "variables",
                Some(serde_json::json!({ "variablesReference": variables_reference })),
                None,
            )
            .await
            .map_err(|e| e.to_string())?;

        let variables = body
            .get("variables")
            .cloned()
            .unwrap_or(serde_json::Value::Array(Vec::new()));
        serde_json::from_value(variables).map_err(|e| e.to_string())
    }

    pub async fn evaluate(
        &self,
        expression: &str,
        frame_id: Option<u64>,
    ) -> std::result::Result<DapEvaluateResult, String> {
        let client = self.get_client().await?;
        let mut arguments = serde_json::json!({
            "expression": expression,
            "context": "watch",
        });
        if let Some(frame_id) = frame_id {
            arguments["frameId"] = serde_json::json!(frame_id);
        }

        let body = client
            .request("evaluate", Some(arguments), None)
            .await
            .map_err(|e| e.to_string())?;
        serde_json::from_value(body).map_err(|e| e.to_string())
    }

    async fn forward_events(
        app_handle: AppHandle,
        adapter: String,
        slot: SessionSlot,
        mut rx: tokio::sync::mpsc::UnboundedReceiver<DapEventMessage>,
        mut initialized_tx: Option<tokio::sync::oneshot::Sender<()>>,
    ) {
        while let Some(message) = rx.recv().await {
            if message.event == "initialized" {
                if let Some(tx) = initialized_tx.take() {
                    let _ = tx.send(());
                }
            }
            let _ = app_handle.emit(
                "dap_event",
                DapEvent {
                    event: message.event,
                    body: message.body,
                },
            );
        }

        // The event channel closes when the adapter exits (or crashes): clear
        // the session so a new one can start, and notify the frontend.
        {
            let mut session = slot.write().await;
            session.take();
        }
        let _ = app_handle.emit(
            "dap_status_changed",
            DapStatusEvent {
                status: DapSessionStatus::Stopped,
                adapter: Some(adapter),
                error: None,
            },
        );
    }

    async fn forward_logs(
        app_handle: AppHandle,
        adapter: String,
        mut rx: tokio::sync::mpsc::UnboundedReceiver<String>,
    ) {
        while let Some(line) = rx.recv().await {
            let _ = app_handle.emit(
                "dap_log",
                serde_json::json!({
                    "adapter": adapter,
                    "line": line,
                }),
            );
        }
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_adapter_has_an_install_command() {
        for entry in ADAPTERS {
            let install = entry
                .install
                .unwrap_or_else(|| panic!("adapter '{}' has no install command", entry.id));
            assert!(!install.program.is_empty());
            assert!(!install.args.is_empty());
        }
    }

    #[test]
    fn python_install_matches_platform() {
        let entry = ADAPTERS.iter().find(|a| a.id == "python").unwrap();
        let install = entry.install.unwrap();
        #[cfg(target_os = "windows")]
        {
            assert_eq!(install.program, "python");
            assert_eq!(install.args, &["-m", "pip", "install", "debugpy"]);
        }
        #[cfg(not(target_os = "windows"))]
        {
            assert_eq!(install.program, "pip");
            assert_eq!(install.args, &["install", "debugpy"]);
        }
    }

    #[test]
    fn node_install_uses_npm_global() {
        let entry = ADAPTERS.iter().find(|a| a.id == "node").unwrap();
        let install = entry.install.unwrap();
        assert_eq!(install.program, "npm");
        assert_eq!(install.args, &["install", "-g", "vscode-js-debug"]);
    }

    #[tokio::test]
    async fn install_unknown_adapter_is_error() {
        let result = DapManager::install_adapter("ruby").await;
        assert!(result.is_err());
    }
}
