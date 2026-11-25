//! Ends everything Pragma started before the app exits.

use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{AppHandle, Manager};

use crate::ai::acp::AcpSessionManager;
use crate::modules::dap::DapManager;
use crate::modules::lsp::LspManager;
use crate::modules::process_end::end_groups;
use crate::modules::pty::PtyManager;
use crate::modules::run::RunManager;

static STOPPED: AtomicBool = AtomicBool::new(false);

/// Runs once: closing the last window asks for the exit first, while quitting on macOS only reports
/// the exit itself.
pub fn stop_children(app: &AppHandle) {
    if STOPPED.swap(true, Ordering::SeqCst) {
        return;
    }
    if let Some(run_manager) = app.try_state::<RunManager>() {
        run_manager.stop_all();
    }
    let mut groups = Vec::new();
    if let Some(pty_manager) = app.try_state::<PtyManager>() {
        groups.extend(pty_manager.take_groups());
    }
    if let Some(acp_manager) = app.try_state::<AcpSessionManager>() {
        groups.extend(tauri::async_runtime::block_on(acp_manager.take_groups()));
    }
    end_groups(&groups);
    if let Some(lsp_manager) = app.try_state::<LspManager>() {
        tauri::async_runtime::block_on(lsp_manager.shutdown_all());
    }
    if let Some(dap_manager) = app.try_state::<DapManager>() {
        tauri::async_runtime::block_on(dap_manager.shutdown_all());
    }
}
