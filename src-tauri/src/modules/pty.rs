use portable_pty::{ChildKiller, CommandBuilder, MasterPty, NativePtySystem, PtySize, PtySystem};
use serde::Serialize;
use std::collections::HashMap;
use std::io::{Read, Write};
#[cfg(windows)]
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, State};

#[derive(Serialize, Clone)]
struct PtyOutputEvent {
    id: String,
    data: String,
}

struct PtyInstance {
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
    killer: Arc<Mutex<Box<dyn ChildKiller + Send + Sync>>>,
    master: Arc<Mutex<Box<dyn MasterPty + Send>>>,
    #[allow(dead_code)]
    child: Box<dyn portable_pty::Child + Send + Sync>,
}

pub struct PtyManager {
    ptys: Mutex<HashMap<String, PtyInstance>>,
}

impl Default for PtyManager {
    fn default() -> Self {
        Self::new()
    }
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            ptys: Mutex::new(HashMap::new()),
        }
    }
}

#[cfg(windows)]
fn which_in_path(name: &str) -> Option<PathBuf> {
    let path = std::env::var_os("PATH")?;
    for dir in std::env::split_paths(&path) {
        let candidate = dir.join(name);
        if candidate.is_file() {
            return Some(candidate);
        }
    }
    None
}

#[cfg(windows)]
fn windows_shell_path() -> PathBuf {
    if let Some(p) = which_in_path("pwsh.exe") {
        return p;
    }

    if let Some(pf) = std::env::var_os("ProgramFiles").map(PathBuf::from) {
        let candidate = pf.join("PowerShell").join("7").join("pwsh.exe");
        if candidate.is_file() {
            return candidate;
        }
    }

    let system32 = std::env::var_os("SystemRoot")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(r"C:\Windows"))
        .join("System32");
    let ps5 = system32
        .join("WindowsPowerShell")
        .join("v1.0")
        .join("powershell.exe");
    if ps5.is_file() {
        return ps5;
    }

    system32.join("cmd.exe")
}

#[cfg(windows)]
pub fn default_shell() -> String {
    windows_shell_path().to_string_lossy().into_owned()
}

#[cfg(not(windows))]
pub fn default_shell() -> String {
    std::env::var("SHELL")
        .ok()
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "/bin/zsh".to_string())
}

fn resolve_shell(shell: Option<String>) -> String {
    let shell = shell.filter(|s| !s.is_empty());
    match shell {
        Some(s) => s,
        None => default_shell(),
    }
}

fn build_command(shell: &str, cwd: Option<&str>) -> CommandBuilder {
    let mut cmd = CommandBuilder::new(shell);

    #[cfg(not(windows))]
    {
        cmd.env("TERM", "xterm-256color");
        cmd.env("COLORTERM", "truecolor");
        // Tell fish not to probe for color support; otherwise it sends a DA1
        // query that xterm.js does not answer and prints a compatibility warning.
        cmd.env("fish_term24bit", "1");
        cmd.env("fish_term256", "1");
    }

    if let Some(cwd) = cwd {
        let path = std::path::PathBuf::from(cwd);
        if path.is_dir() {
            cmd.cwd(path);
        }
    } else if let Ok(cwd) = std::env::current_dir() {
        cmd.cwd(cwd);
    }

    let shell_lower = shell.to_ascii_lowercase();
    if shell_lower.ends_with("pwsh.exe") || shell_lower.ends_with("powershell.exe") {
        cmd.arg("-NoLogo");
        cmd.arg("-NoExit");
        cmd.arg("-NoProfile");
    }

    cmd
}

#[tauri::command]
pub fn resolve_terminal_shell(shell: Option<String>) -> Result<String, String> {
    let shell = shell.filter(|s| !s.is_empty());
    let resolved = resolve_shell(shell);

    if std::path::Path::new(&resolved).is_file() {
        return Ok(resolved);
    }

    Ok(default_shell())
}

#[tauri::command]
pub fn create_pty(
    app: AppHandle,
    state: State<'_, PtyManager>,
    shell: Option<String>,
    cwd: Option<String>,
    cols: u16,
    rows: u16,
) -> Result<String, String> {
    let shell = resolve_shell(shell);
    let pty_system = NativePtySystem::default();
    let pair = pty_system
        .openpty(PtySize {
            rows: rows.max(2),
            cols: cols.max(10),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    let cmd = build_command(&shell, cwd.as_deref());
    let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    drop(pair.slave);

    let id = uuid::Uuid::new_v4().to_string();

    let reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;
    let killer = child.clone_killer();

    let event_id = id.clone();
    let app_handle = app.clone();
    std::thread::spawn(move || {
        let mut reader = reader;
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    let payload = PtyOutputEvent {
                        id: event_id.clone(),
                        data,
                    };
                    let _ = app_handle.emit("pty_output", payload);
                }
                Err(_) => break,
            }
        }
    });

    let mut ptys = state.ptys.lock().map_err(|e| e.to_string())?;
    ptys.insert(
        id.clone(),
        PtyInstance {
            writer: Arc::new(Mutex::new(writer)),
            killer: Arc::new(Mutex::new(killer)),
            master: Arc::new(Mutex::new(pair.master)),
            child,
        },
    );

    Ok(id)
}

#[tauri::command]
pub fn write_pty(state: State<'_, PtyManager>, id: String, data: String) -> Result<(), String> {
    let ptys = state.ptys.lock().map_err(|e| e.to_string())?;
    let instance = ptys.get(&id).ok_or("PTY not found")?;
    let mut writer = instance.writer.lock().map_err(|e| e.to_string())?;
    writer
        .write_all(data.as_bytes())
        .map_err(|e| e.to_string())?;
    writer.flush().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn resize_pty(
    state: State<'_, PtyManager>,
    id: String,
    rows: u16,
    cols: u16,
) -> Result<(), String> {
    let ptys = state.ptys.lock().map_err(|e| e.to_string())?;
    let instance = ptys.get(&id).ok_or("PTY not found")?;
    instance
        .master
        .lock()
        .map_err(|e| e.to_string())?
        .resize(PtySize {
            rows: rows.max(2),
            cols: cols.max(10),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn kill_pty(state: State<'_, PtyManager>, id: String) -> Result<(), String> {
    let mut ptys = state.ptys.lock().map_err(|e| e.to_string())?;
    if let Some(instance) = ptys.remove(&id) {
        let _ = instance.killer.lock().map_err(|e| e.to_string())?.kill();
    }
    Ok(())
}

#[tauri::command]
pub fn create_pty_command(
    app: AppHandle,
    state: State<'_, PtyManager>,
    command: String,
    cwd: Option<String>,
    cols: u16,
    rows: u16,
) -> Result<String, String> {
    let trimmed = command.trim();
    if trimmed.is_empty() {
        return Err("command is required".to_string());
    }

    // On Windows, run the command through cmd.exe so that PATH resolution,
    // .exe extension handling and paths with spaces work the same way as in a
    // regular terminal. portable-pty's CommandBuilder does not expand .exe or
    // resolve shell wrappers like Docker Desktop's `docker` symlink.
    #[cfg(target_os = "windows")]
    let (program, args): (String, Vec<String>) = {
        ("cmd".to_string(), vec!["/c".to_string(), trimmed.to_string()])
    };

    #[cfg(not(target_os = "windows"))]
    let (program, args): (String, Vec<String>) = {
        let parts = shellwords::split(trimmed).map_err(|e| format!("Invalid command: {e}"))?;
        if parts.is_empty() {
            return Err("command is required".to_string());
        }
        let program = parts[0].clone();
        let args = parts[1..].to_vec();
        (program, args)
    };

    let pty_system = NativePtySystem::default();
    let pair = pty_system
        .openpty(PtySize {
            rows: rows.max(2),
            cols: cols.max(10),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    let mut cmd = CommandBuilder::new(program);
    cmd.args(args);
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");

    if let Some(cwd) = cwd {
        let path = std::path::PathBuf::from(cwd);
        if path.is_dir() {
            cmd.cwd(path);
        }
    }

    let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    drop(pair.slave);

    let id = uuid::Uuid::new_v4().to_string();

    let reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;
    let killer = child.clone_killer();

    let event_id = id.clone();
    let app_handle = app.clone();
    std::thread::spawn(move || {
        let mut reader = reader;
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    let payload = PtyOutputEvent {
                        id: event_id.clone(),
                        data,
                    };
                    let _ = app_handle.emit("pty_output", payload);
                }
                Err(_) => break,
            }
        }
    });

    let mut ptys = state.ptys.lock().map_err(|e| e.to_string())?;
    ptys.insert(
        id.clone(),
        PtyInstance {
            writer: Arc::new(Mutex::new(writer)),
            killer: Arc::new(Mutex::new(killer)),
            master: Arc::new(Mutex::new(pair.master)),
            child,
        },
    );

    Ok(id)
}
