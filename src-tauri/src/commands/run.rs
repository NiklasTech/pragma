use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{BufRead, BufReader};
#[cfg(unix)]
use std::os::unix::process::CommandExt;
use std::path::Path;
use std::process::{Command, Stdio};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

// ─── Data Types ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct RunConfig {
    pub name: String,
    pub command: String,
    pub cwd: Option<String>,
    #[serde(default)]
    pub env: HashMap<String, String>,
    #[serde(default)]
    pub autostart: bool,
}

#[derive(Debug, Deserialize)]
struct RunConfigFile {
    configurations: Vec<RunConfig>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum RunStatus {
    Running,
    Failed,
    Stopped,
}

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

// ─── Run Manager ─────────────────────────────────────────────────────────────

struct RunInstance {
    pgid: i32,
}

pub struct RunManager {
    processes: Mutex<HashMap<String, RunInstance>>,
}

impl RunManager {
    pub fn new() -> Self {
        Self {
            processes: Mutex::new(HashMap::new()),
        }
    }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

fn resolve_cwd(cwd: Option<&str>, workspace_root: &str) -> String {
    match cwd {
        Some(path) if path.contains("${workspaceRoot}") => {
            path.replace("${workspaceRoot}", workspace_root)
        }
        Some(path) => path.to_string(),
        None => workspace_root.to_string(),
    }
}

fn parse_command(command: &str) -> (String, Vec<String>) {
    let trimmed = command.trim();
    if trimmed.is_empty() {
        return (String::new(), Vec::new());
    }

    let mut chars = trimmed.chars().peekable();
    let mut parts: Vec<String> = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;
    let mut quote_char = '\0';

    while let Some(c) = chars.next() {
        if in_quotes {
            if c == quote_char {
                in_quotes = false;
            } else {
                current.push(c);
            }
        } else if c == '"' || c == '\'' {
            in_quotes = true;
            quote_char = c;
        } else if c.is_whitespace() {
            if !current.is_empty() {
                parts.push(std::mem::take(&mut current));
            }
        } else {
            current.push(c);
        }
    }

    if !current.is_empty() {
        parts.push(current);
    }

    if parts.is_empty() {
        return (String::new(), Vec::new());
    }
    let program = parts.remove(0);
    (program, parts)
}

fn emit_output(app: &AppHandle, process_id: &str, data: String) {
    let _ = app.emit(
        "run_output",
        RunOutputEvent {
            process_id: process_id.to_string(),
            data,
        },
    );
}

fn emit_status(app: &AppHandle, process_id: &str, status: RunStatus, exit_code: Option<i32>) {
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
fn set_process_group() -> std::io::Result<()> {
    unsafe {
        libc::setpgid(0, 0);
    }
    Ok(())
}

#[cfg(windows)]
fn set_process_group() {
    // On Windows we rely on job objects via the CREATE_BREAKAWAY_FROM_JOB flag
    // For simplicity, we just spawn without special handling here
    // A full implementation would use windows::Win32::System::JobObjects
}

#[cfg(unix)]
fn kill_process_group(pgid: i32) {
    unsafe {
        libc::killpg(pgid, libc::SIGTERM);
        std::thread::sleep(std::time::Duration::from_millis(200));
        libc::killpg(pgid, libc::SIGKILL);
    }
}

#[cfg(windows)]
fn kill_process_group(_pgid: i32) {
    // Windows implementation would use JobObject to kill the process tree
    // For now, this is a no-op fallback
}

// ─── Commands ────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn run_list_configs(workspace_root: String) -> Result<Vec<RunConfig>, String> {
    let config_path = Path::new(&workspace_root).join(".pragma").join("run.json");

    if !config_path.exists() {
        return Ok(Vec::new());
    }

    let content = std::fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read run config: {e}"))?;

    let config_file: RunConfigFile =
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse run config: {e}"))?;

    Ok(config_file.configurations)
}

#[tauri::command]
pub fn run_start(
    app: AppHandle,
    state: State<'_, RunManager>,
    workspace_root: String,
    config: RunConfig,
) -> Result<String, String> {
    let process_id = uuid::Uuid::new_v4().to_string();
    let cwd = resolve_cwd(config.cwd.as_deref(), &workspace_root);
    let (program, args) = parse_command(&config.command);

    if program.is_empty() {
        return Err("Empty command".to_string());
    }

    let mut cmd = Command::new(&program);
    cmd.args(&args)
        .current_dir(&cwd)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::null());

    // Set up process group so we can kill the whole tree later
    #[cfg(unix)]
    unsafe {
        cmd.pre_exec(set_process_group);
    }

    for (key, value) in &config.env {
        cmd.env(key, value);
    }

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to start process: {e}"))?;

    // Get the process group ID (same as child PID on Unix since we called setpgid)
    #[cfg(unix)]
    let pgid = child.id() as i32;
    #[cfg(windows)]
    let pgid = child.id() as i32;

    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;

    let pid = process_id.clone();
    let app_handle = app.clone();
    std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            if let Ok(line) = line {
                emit_output(&app_handle, &pid, format!("{line}\n"));
            }
        }
    });

    let pid = process_id.clone();
    let app_handle = app.clone();
    std::thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines() {
            if let Ok(line) = line {
                emit_output(&app_handle, &pid, format!("{line}\n"));
            }
        }
    });

    let pid = process_id.clone();
    let app_handle = app.clone();
    std::thread::spawn(move || {
        let status = child.wait();
        match status {
            Ok(code) => {
                let exit_code = code.code();
                let run_status = if exit_code == Some(0) {
                    RunStatus::Stopped
                } else {
                    RunStatus::Failed
                };
                emit_status(&app_handle, &pid, run_status, exit_code);
            }
            Err(_) => {
                emit_status(&app_handle, &pid, RunStatus::Failed, None);
            }
        }
    });

    let mut processes = state.processes.lock().map_err(|e| e.to_string())?;
    processes.insert(process_id.clone(), RunInstance { pgid });

    emit_status(&app, &process_id, RunStatus::Running, None);

    Ok(process_id)
}

#[tauri::command]
pub fn run_stop(state: State<'_, RunManager>, process_id: String) -> Result<(), String> {
    let instance = {
        let mut processes = state.processes.lock().map_err(|e| e.to_string())?;
        processes.remove(&process_id)
    };

    if let Some(instance) = instance {
        kill_process_group(instance.pgid);
    }
    Ok(())
}

#[tauri::command]
pub fn run_restart(
    app: AppHandle,
    state: State<'_, RunManager>,
    workspace_root: String,
    process_id: String,
    config: RunConfig,
) -> Result<String, String> {
    {
        let mut processes = state.processes.lock().map_err(|e| e.to_string())?;
        if let Some(instance) = processes.remove(&process_id) {
            kill_process_group(instance.pgid);
        }
    }
    run_start(app, state, workspace_root, config)
}
