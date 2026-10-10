mod attach_args;
mod breakpoints;
pub mod client;
pub mod install;
mod launch_args;
pub mod manager;
mod processes;
pub mod types;

use crate::modules::workspace_trust::require_trusted;
use attach_args::AttachTarget;
pub use processes::DapProcessInfo;

pub use manager::DapManager;
pub use types::{
    DapAdapterInfo, DapBreakpoint, DapEnsureResult, DapEvaluateResult, DapFileBreakpoints,
    DapInstallResult, DapScope, DapSourceBreakpoint, DapStackFrame, DapStartRequest, DapVariable,
};

const EVALUATE_CONTEXTS: &[&str] = &["watch", "repl", "hover", "clipboard"];

#[tauri::command]
pub async fn dap_list_adapters(app: tauri::AppHandle) -> Result<Vec<DapAdapterInfo>, String> {
    Ok(DapManager::list_adapters(&app).await)
}

#[tauri::command]
pub async fn dap_install_adapter(
    app: tauri::AppHandle,
    adapter_id: String,
) -> Result<DapInstallResult, String> {
    if adapter_id.is_empty() {
        return Err("adapter_id is required".to_string());
    }
    DapManager::install_adapter(&app, &adapter_id).await
}

#[tauri::command]
pub async fn dap_ensure_adapter(
    app: tauri::AppHandle,
    language: String,
) -> Result<DapEnsureResult, String> {
    if language.is_empty() {
        return Err("language is required".to_string());
    }
    DapManager::ensure_adapter(&app, &language).await
}

#[tauri::command]
pub async fn dap_start(
    app: tauri::AppHandle,
    state: tauri::State<'_, DapManager>,
    params: DapStartRequest,
) -> Result<(), String> {
    if params.workspace_root.is_empty() {
        return Err("workspace_root is required".to_string());
    }
    require_trusted(&app, &params.workspace_root, "start the debugger")?;
    if params.adapter.is_empty() {
        return Err("adapter is required".to_string());
    }
    let request = params.request.as_deref().unwrap_or("launch");
    if request != "launch" && request != "attach" {
        return Err(format!("Invalid debug request type '{request}'"));
    }
    if request == "launch" && params.command.is_empty() {
        return Err("command is required".to_string());
    }
    attach_args::validate_attach_target(&AttachTarget {
        host: params.host.clone(),
        port: params.port,
        process_id: params.process_id,
    })?;

    state.start_session(params).await
}

#[tauri::command(async)]
pub fn dap_list_processes() -> Result<Vec<DapProcessInfo>, String> {
    Ok(processes::list_processes())
}

#[tauri::command]
pub async fn dap_stop(state: tauri::State<'_, DapManager>) -> Result<(), String> {
    state.stop_session().await
}

#[tauri::command]
pub async fn dap_set_breakpoints(
    state: tauri::State<'_, DapManager>,
    file_path: String,
    breakpoints: Vec<DapSourceBreakpoint>,
) -> Result<Vec<DapBreakpoint>, String> {
    if file_path.is_empty() {
        return Err("file_path is required".to_string());
    }
    breakpoints::validate_breakpoints(&breakpoints)?;
    state.set_breakpoints(&file_path, &breakpoints).await
}

#[tauri::command]
pub async fn dap_continue(
    state: tauri::State<'_, DapManager>,
    thread_id: u64,
) -> Result<(), String> {
    state.continue_(thread_id).await
}

#[tauri::command]
pub async fn dap_pause(state: tauri::State<'_, DapManager>, thread_id: u64) -> Result<(), String> {
    state.pause(thread_id).await
}

#[tauri::command]
pub async fn dap_next(state: tauri::State<'_, DapManager>, thread_id: u64) -> Result<(), String> {
    state.next(thread_id).await
}

#[tauri::command]
pub async fn dap_step_in(
    state: tauri::State<'_, DapManager>,
    thread_id: u64,
) -> Result<(), String> {
    state.step_in(thread_id).await
}

#[tauri::command]
pub async fn dap_step_out(
    state: tauri::State<'_, DapManager>,
    thread_id: u64,
) -> Result<(), String> {
    state.step_out(thread_id).await
}

#[tauri::command]
pub async fn dap_stack_trace(
    state: tauri::State<'_, DapManager>,
    thread_id: u64,
) -> Result<Vec<DapStackFrame>, String> {
    state.stack_trace(thread_id).await
}

#[tauri::command]
pub async fn dap_scopes(
    state: tauri::State<'_, DapManager>,
    frame_id: u64,
) -> Result<Vec<DapScope>, String> {
    state.scopes(frame_id).await
}

#[tauri::command]
pub async fn dap_variables(
    state: tauri::State<'_, DapManager>,
    variables_reference: u64,
) -> Result<Vec<DapVariable>, String> {
    state.variables(variables_reference).await
}

#[tauri::command]
pub async fn dap_evaluate(
    state: tauri::State<'_, DapManager>,
    expression: String,
    frame_id: Option<u64>,
    context: Option<String>,
) -> Result<DapEvaluateResult, String> {
    if expression.is_empty() {
        return Err("expression is required".to_string());
    }
    let context = context.as_deref().unwrap_or("watch");
    if !EVALUATE_CONTEXTS.contains(&context) {
        return Err(format!("Invalid evaluate context '{context}'"));
    }
    state.evaluate(&expression, frame_id, context).await
}
