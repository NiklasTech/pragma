//! Structured command execution for Agent Mode.
//!
//! Unlike the raw PTY module, this runs a single shell command to completion
//! and returns captured stdout/stderr plus the exit code, with a timeout and
//! a working directory confined to the workspace root.

use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::Duration;

use crate::platform::{kill_process_tree, new_tokio_command};

const DEFAULT_TIMEOUT_MS: u64 = 120_000;
const MAX_TIMEOUT_MS: u64 = 600_000;
const MAX_OUTPUT_CHARS: usize = 200_000;

#[derive(Serialize)]
pub struct AgentCommandResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
    pub timed_out: bool,
}

#[tauri::command]
pub async fn agent_run_command(
    command: String,
    cwd: Option<String>,
    workspace_root: String,
    timeout_ms: Option<u64>,
) -> Result<AgentCommandResult, String> {
    let command = command.trim().to_string();
    if command.is_empty() {
        return Err("command is required".to_string());
    }

    let workdir = resolve_workdir(&workspace_root, cwd.as_deref())?;
    let timeout = Duration::from_millis(
        timeout_ms
            .unwrap_or(DEFAULT_TIMEOUT_MS)
            .clamp(1_000, MAX_TIMEOUT_MS),
    );

    let mut cmd = shell_command(&command);
    cmd.current_dir(&workdir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);

    let child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn command: {e}"))?;
    let pid = child.id();

    match tokio::time::timeout(timeout, child.wait_with_output()).await {
        Ok(Ok(output)) => Ok(AgentCommandResult {
            stdout: truncate_output(&String::from_utf8_lossy(&output.stdout)),
            stderr: truncate_output(&String::from_utf8_lossy(&output.stderr)),
            exit_code: output.status.code().unwrap_or(-1),
            timed_out: false,
        }),
        Ok(Err(e)) => Err(format!("Failed to run command: {e}")),
        Err(_) => {
            if let Some(pid) = pid {
                let _ = kill_process_tree(pid);
            }
            Ok(AgentCommandResult {
                stdout: String::new(),
                stderr: format!("Command timed out after {} ms", timeout.as_millis()),
                exit_code: -1,
                timed_out: true,
            })
        }
    }
}

fn shell_command(command: &str) -> tokio::process::Command {
    #[cfg(target_os = "windows")]
    {
        let mut cmd = new_tokio_command("cmd");
        cmd.arg("/c").arg(command);
        cmd
    }
    #[cfg(not(target_os = "windows"))]
    {
        let mut cmd = new_tokio_command("sh");
        cmd.arg("-c").arg(command);
        cmd
    }
}

fn resolve_workdir(workspace_root: &str, cwd: Option<&str>) -> Result<PathBuf, String> {
    if workspace_root.trim().is_empty() {
        return Err("workspace_root is required".to_string());
    }

    let root = std::fs::canonicalize(workspace_root)
        .map_err(|e| format!("Failed to resolve workspace root: {e}"))?;
    if !root.is_dir() {
        return Err(format!(
            "Workspace root is not a directory: {workspace_root}"
        ));
    }

    let dir = match cwd {
        Some(cwd) if !cwd.trim().is_empty() => {
            let cwd = cwd.trim();
            let path = Path::new(cwd);
            let candidate = if path.is_absolute() {
                path.to_path_buf()
            } else {
                root.join(path)
            };
            std::fs::canonicalize(&candidate)
                .map_err(|e| format!("Failed to resolve working directory: {e}"))?
        }
        _ => root.clone(),
    };

    if !dir.starts_with(&root) {
        return Err("Working directory must be inside the workspace root".to_string());
    }
    if !dir.is_dir() {
        return Err("Working directory is not a directory".to_string());
    }

    Ok(dir)
}

fn truncate_output(output: &str) -> String {
    const SUFFIX: &str = "… [truncated]";
    if output.len() <= MAX_OUTPUT_CHARS {
        return output.to_string();
    }
    let mut end = MAX_OUTPUT_CHARS - SUFFIX.len();
    while !output.is_char_boundary(end) {
        end -= 1;
    }
    format!("{}{SUFFIX}", &output[..end])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolve_workdir_defaults_to_root() {
        let temp = tempfile::tempdir().expect("tempdir");
        let root = temp.path().to_string_lossy().to_string();
        let resolved = resolve_workdir(&root, None).expect("resolve");
        assert_eq!(resolved, std::fs::canonicalize(&root).expect("canonical"));
    }

    #[test]
    fn resolve_workdir_accepts_relative_subdir() {
        let temp = tempfile::tempdir().expect("tempdir");
        std::fs::create_dir(temp.path().join("sub")).expect("mkdir");
        let root = temp.path().to_string_lossy().to_string();
        let resolved = resolve_workdir(&root, Some("sub")).expect("resolve");
        assert!(resolved.ends_with("sub"));
    }

    #[test]
    fn resolve_workdir_rejects_parent_traversal() {
        let temp = tempfile::tempdir().expect("tempdir");
        let root = temp.path().join("workspace");
        std::fs::create_dir(&root).expect("mkdir");
        let result = resolve_workdir(&root.to_string_lossy(), Some(".."));
        assert!(result.is_err());
    }

    #[test]
    fn resolve_workdir_rejects_absolute_path_outside_root() {
        let temp = tempfile::tempdir().expect("tempdir");
        let root = temp.path().join("workspace");
        std::fs::create_dir(&root).expect("mkdir");
        let outside = temp.path().to_string_lossy().to_string();
        let result = resolve_workdir(&root.to_string_lossy(), Some(&outside));
        assert!(result.is_err());
    }

    #[test]
    fn resolve_workdir_rejects_empty_root() {
        assert!(resolve_workdir("", None).is_err());
    }

    #[test]
    fn truncate_output_keeps_short_strings() {
        assert_eq!(truncate_output("hello"), "hello");
    }

    #[test]
    fn truncate_output_truncates_long_strings() {
        let long = "a".repeat(MAX_OUTPUT_CHARS + 10);
        let truncated = truncate_output(&long);
        assert!(truncated.len() < long.len());
        assert!(truncated.ends_with("[truncated]"));
    }
}
