use crate::platform::resolve_program;
use std::path::PathBuf;

/// Candidate interpreters for the Python adapter, in priority order.
fn python_candidate_names() -> Vec<&'static str> {
    // On Windows the `py` launcher often resolves the latest installed Python
    // even when `python` points at the Microsoft Store stub.
    if cfg!(target_os = "windows") {
        vec!["python", "python3", "py"]
    } else {
        vec!["python3", "python"]
    }
}

/// Find a Python interpreter that can import the given module.
pub(super) async fn python_with_module(module: &str) -> Option<PathBuf> {
    for name in python_candidate_names() {
        if let Ok(path) = resolve_program(name) {
            let output = crate::platform::new_tokio_command(&path)
                .args(["-c", &format!("import {module}")])
                .output()
                .await;
            if output.map(|out| out.status.success()).unwrap_or(false) {
                return Some(path);
            }
        }
    }
    None
}

/// Find a Python interpreter that already has debugpy installed.
pub(super) fn python_with_debugpy() -> Option<PathBuf> {
    // Synchronous variant for resolve_adapter, which is not async.  We use a
    // short-lived std::process::Command here; the async availability check uses
    // the async version below.
    for name in python_candidate_names() {
        if let Ok(path) = resolve_program(name) {
            let output = std::process::Command::new(&path)
                .args(["-c", "import debugpy"])
                .output();
            if output.map(|out| out.status.success()).unwrap_or(false) {
                return Some(path);
            }
        }
    }
    None
}
