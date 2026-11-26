use crate::platform::resolve_program;
use std::path::{Path, PathBuf};

/// Holds the interpreter debugpy was installed with; its compiled parts only run on that version.
const INTERPRETER_FILE: &str = "interpreter";

/// `pip install --target` puts debugpy here, outside every interpreter's site-packages.
pub(super) fn managed_debugpy_dir(adapters_dir: &Path) -> PathBuf {
    adapters_dir.join("python")
}

/// The interpreter and the `debugpy/adapter` folder it runs, when Pragma installed debugpy.
pub(super) fn managed_debugpy(adapters_dir: &Path) -> Option<(PathBuf, PathBuf)> {
    let dir = managed_debugpy_dir(adapters_dir);
    let adapter = dir.join("debugpy").join("adapter");
    if !adapter.join("__main__.py").is_file() {
        return None;
    }
    let recorded = std::fs::read_to_string(dir.join(INTERPRETER_FILE)).ok()?;
    let python = PathBuf::from(recorded.trim());
    python.is_file().then_some((python, adapter))
}

pub(super) fn record_interpreter(adapters_dir: &Path, python: &Path) -> Result<(), String> {
    let file = managed_debugpy_dir(adapters_dir).join(INTERPRETER_FILE);
    std::fs::write(&file, python.to_string_lossy().as_bytes())
        .map_err(|e| format!("Cannot write {}: {e}", file.display()))
}

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

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn managed_debugpy_needs_the_adapter_and_its_interpreter() {
        let adapters = std::env::temp_dir().join("pragma-dap-managed-debugpy");
        let _ = fs::remove_dir_all(&adapters);
        let adapter = managed_debugpy_dir(&adapters).join("debugpy/adapter");
        fs::create_dir_all(&adapter).unwrap();
        fs::write(adapter.join("__main__.py"), "").unwrap();
        assert_eq!(managed_debugpy(&adapters), None);

        let python = adapters.join("python3");
        fs::write(&python, "").unwrap();
        record_interpreter(&adapters, &python).unwrap();
        assert_eq!(managed_debugpy(&adapters), Some((python.clone(), adapter)));

        fs::remove_file(&python).unwrap();
        assert_eq!(managed_debugpy(&adapters), None);

        let _ = fs::remove_dir_all(&adapters);
    }
}
