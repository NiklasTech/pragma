pub mod client;
pub mod manager;
pub mod types;

pub use manager::DapManager;
pub use types::{
    DapAdapterInfo, DapBreakpoint, DapEvaluateResult, DapFileBreakpoints, DapScope, DapStackFrame,
    DapStartRequest, DapVariable,
};

#[tauri::command]
pub async fn dap_list_adapters() -> Result<Vec<DapAdapterInfo>, String> {
    Ok(DapManager::list_adapters().await)
}

#[tauri::command]
pub async fn dap_start(
    state: tauri::State<'_, DapManager>,
    params: DapStartRequest,
) -> Result<(), String> {
    if params.workspace_root.is_empty() {
        return Err("workspace_root is required".to_string());
    }
    if params.adapter.is_empty() {
        return Err("adapter is required".to_string());
    }
    if params.command.is_empty() {
        return Err("command is required".to_string());
    }

    if let Some(request) = params.request.as_deref() {
        if request != "launch" && request != "attach" {
            return Err(format!("Invalid debug request type '{request}'"));
        }
    }

    state.start_session(params).await
}

#[tauri::command]
pub async fn dap_stop(state: tauri::State<'_, DapManager>) -> Result<(), String> {
    state.stop_session().await
}

#[tauri::command]
pub async fn dap_set_breakpoints(
    state: tauri::State<'_, DapManager>,
    file_path: String,
    lines: Vec<u32>,
) -> Result<Vec<DapBreakpoint>, String> {
    if file_path.is_empty() {
        return Err("file_path is required".to_string());
    }
    state.set_breakpoints(&file_path, &lines).await
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
) -> Result<DapEvaluateResult, String> {
    if expression.is_empty() {
        return Err("expression is required".to_string());
    }
    state.evaluate(&expression, frame_id).await
}
