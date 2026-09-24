use std::io::{BufRead, BufReader};
#[cfg(unix)]
use std::os::unix::process::CommandExt;
use std::process::{Child, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

#[cfg(windows)]
use crate::platform::new_std_command;
use crate::platform::{new_std_command_for_program, resolve_program};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

use super::cmdline::{parse_command, resolve_cwd};
use super::manager::RunManager;
use super::types::{RunConfig, RunStatus};

#[derive(Debug, Clone, Serialize)]
struct RunOutputEvent {
    process_id: String,
    data: String,
}

#[derive(Debug, Clone, Serialize)]
struct RunStatusEvent {
    process_id: String,
    status: RunStatus,
    exit_code: Option<i32>,
}

pub(super) fn emit_output(app: &AppHandle, process_id: &str, data: String) {
    let _ = app.emit(
        "run_output",
        RunOutputEvent {
            process_id: process_id.to_string(),
            data,
        },
    );
}

pub(super) fn emit_status(
    app: &AppHandle,
    process_id: &str,
    status: RunStatus,
    exit_code: Option<i32>,
) {
    let _ = app.emit(
        "run_status_changed",
        RunStatusEvent {
            process_id: process_id.to_string(),
            status,
            exit_code,
        },
    );
}

#[cfg(unix)]
pub(super) fn set_process_group() -> std::io::Result<()> {
    unsafe {
        libc::setpgid(0, 0);
    }
    Ok(())
}

#[cfg(unix)]
pub(super) fn kill_process_group(pgid: i32) {
    unsafe {
        libc::killpg(pgid, libc::SIGTERM);
        std::thread::sleep(std::time::Duration::from_millis(200));
        libc::killpg(pgid, libc::SIGKILL);
    }
}

#[cfg(windows)]
pub(super) fn kill_process_group(pgid: i32) {
    // Use taskkill to terminate the process tree rooted at the given PID.
    // This is a pragmatic fallback until a JobObject-based implementation
    // is added for cleaner process-tree management.
    let _ = new_std_command("taskkill")
        .args(["/T", "/F", "/PID", &pgid.to_string()])
        .output();
}

pub(super) fn spawn_output_reader(
    app: AppHandle,
    process_id: String,
    output: std::process::ChildStdout,
) {
    std::thread::spawn(move || {
        let reader = BufReader::new(output);
        for line in reader.lines().map_while(Result::ok) {
            emit_output(&app, &process_id, format!("{line}\n"));
        }
    });
}

pub(super) fn spawn_error_reader(
    app: AppHandle,
    process_id: String,
    output: std::process::ChildStderr,
) {
    std::thread::spawn(move || {
        let reader = BufReader::new(output);
        for line in reader.lines().map_while(Result::ok) {
            emit_output(&app, &process_id, format!("{line}\n"));
        }
    });
}

fn build_child_command(config: &RunConfig, cwd: &str) -> Result<std::process::Command, String> {
    let (program, args) = parse_command(&config.command);
    let resolved_program =
        resolve_program(&program).map_err(|e| format!("{e}. Command: {}", config.command))?;
    let mut cmd = new_std_command_for_program(&resolved_program);
    cmd.args(&args)
        .current_dir(cwd)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::null());

    #[cfg(unix)]
    unsafe {
        cmd.pre_exec(set_process_group);
    }

    for (key, value) in &config.env {
        cmd.env(key, value);
    }

    Ok(cmd)
}

fn restart_delay_ms(attempt: u32) -> u64 {
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, ... capped at 30s.
    (1000u64 * 2u64.pow(attempt.min(5))).min(30000)
}

pub(super) fn wait_loop(
    app: AppHandle,
    workspace_root: String,
    config: RunConfig,
    process_id: String,
    mut child: Child,
    stop_requested: Arc<AtomicBool>,
) {
    let mut attempt: u32 = 0;

    loop {
        let status = child.wait();
        let exit_code = status.ok().and_then(|s| s.code());
        let failed = exit_code != Some(0);

        if !failed {
            emit_status(&app, &process_id, RunStatus::Stopped, exit_code);
            break;
        }

        emit_status(&app, &process_id, RunStatus::Failed, exit_code);
        emit_output(
            &app,
            &process_id,
            format!(
                "Process exited with code {}\n",
                exit_code
                    .map(|c| c.to_string())
                    .unwrap_or_else(|| "unknown".to_string())
            ),
        );

        if !config.auto_restart || stop_requested.load(Ordering::SeqCst) || attempt >= 5 {
            break;
        }

        attempt += 1;
        let delay = restart_delay_ms(attempt);
        std::thread::sleep(std::time::Duration::from_millis(delay));

        if stop_requested.load(Ordering::SeqCst) {
            break;
        }

        let cwd = resolve_cwd(config.cwd.as_deref(), &workspace_root);
        let mut cmd = match build_child_command(&config, &cwd) {
            Ok(cmd) => cmd,
            Err(e) => {
                emit_status(&app, &process_id, RunStatus::Failed, None);
                emit_output(
                    &app,
                    &process_id,
                    format!("Failed to restart process: {e}\n"),
                );
                break;
            }
        };

        match cmd.spawn() {
            Ok(mut new_child) => {
                let new_pgid = new_child.id() as i32;
                let state = app.state::<RunManager>();
                let mut processes = state.processes.lock().unwrap_or_else(|e| e.into_inner());
                if let Some(instance) = processes.get_mut(&process_id) {
                    instance.pgid = new_pgid;
                } else {
                    // Process was stopped while sleeping; kill the orphan we just spawned.
                    let _ = new_child.kill();
                    break;
                }
                drop(processes);

                let stdout = match new_child.stdout.take() {
                    Some(out) => out,
                    None => break,
                };
                let stderr = match new_child.stderr.take() {
                    Some(err) => err,
                    None => break,
                };

                emit_status(&app, &process_id, RunStatus::Running, None);
                spawn_output_reader(app.clone(), process_id.clone(), stdout);
                spawn_error_reader(app.clone(), process_id.clone(), stderr);
                child = new_child;
            }
            Err(e) => {
                emit_status(&app, &process_id, RunStatus::Failed, None);
                emit_output(
                    &app,
                    &process_id,
                    format!("Failed to restart process: {e}\n"),
                );
                break;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn restart_delay_ms_caps_at_30s() {
        assert_eq!(restart_delay_ms(0), 1000);
        assert_eq!(restart_delay_ms(1), 2000);
        assert_eq!(restart_delay_ms(4), 16000);
        assert_eq!(restart_delay_ms(5), 30000);
        assert_eq!(restart_delay_ms(10), 30000);
    }
}
