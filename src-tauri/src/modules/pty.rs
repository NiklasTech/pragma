use portable_pty::{ChildKiller, CommandBuilder, MasterPty, NativePtySystem, PtySize, PtySystem};
use serde::Serialize;
use std::collections::HashMap;
use std::io::{Read, Write};
#[cfg(windows)]
use std::path::PathBuf;
use std::sync::mpsc::{self, Receiver, TryRecvError};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, State};

use super::pty_utf8::Utf8StreamDecoder;
use super::shell_integration;

#[derive(Serialize, Clone)]
struct PtyOutputEvent {
    id: String,
    data: String,
}

#[derive(Serialize, Clone)]
struct PtyExitEvent {
    id: String,
    exit_code: i32,
}

struct PtyInstance {
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
    killer: Arc<Mutex<Box<dyn ChildKiller + Send + Sync>>>,
    master: Arc<Mutex<Box<dyn MasterPty + Send>>>,
}

fn spawn_exit_watcher(
    app: AppHandle,
    id: String,
    mut child: Box<dyn portable_pty::Child + Send + Sync>,
    output_done: Receiver<()>,
) {
    std::thread::spawn(move || {
        let exit_code = match child.wait() {
            Ok(status) => status.exit_code() as i32,
            Err(_) => -1,
        };
        // Drop the finished PTY so its master and writer handles do not outlive the process.
        let removed = app
            .state::<PtyManager>()
            .ptys
            .lock()
            .ok()
            .and_then(|mut ptys| ptys.remove(&id));
        drop(removed);
        // Let the emitter flush the last output so pty_exit never overtakes it.
        let _ = output_done.recv_timeout(OUTPUT_DRAIN_TIMEOUT);
        let _ = app.emit("pty_exit", PtyExitEvent { id, exit_code });
    });
}

const READ_BUFFER_SIZE: usize = 32 * 1024;
const BURST_THRESHOLD: usize = 4096;
const COALESCE_WINDOW: Duration = Duration::from_millis(4);
const MAX_COALESCED_BYTES: usize = 256 * 1024;
const OUTPUT_DRAIN_TIMEOUT: Duration = Duration::from_millis(250);

/// Merges queued chunks into one string, waiting briefly for more only while output is bursting.
fn coalesce_output(rx: &Receiver<String>, first: String) -> String {
    let mut data = first;
    while data.len() < MAX_COALESCED_BYTES {
        match rx.try_recv() {
            Ok(chunk) => data.push_str(&chunk),
            Err(TryRecvError::Empty) if data.len() >= BURST_THRESHOLD => {
                match rx.recv_timeout(COALESCE_WINDOW) {
                    Ok(chunk) => data.push_str(&chunk),
                    Err(_) => break,
                }
            }
            Err(_) => break,
        }
    }
    data
}

fn spawn_output_reader(
    app: AppHandle,
    id: String,
    mut reader: Box<dyn Read + Send>,
) -> Receiver<()> {
    let (tx, rx) = mpsc::channel::<String>();
    let (done_tx, done_rx) = mpsc::channel::<()>();
    let emit_id = id.clone();
    std::thread::spawn(move || {
        let _done = done_tx;
        while let Ok(first) = rx.recv() {
            let data = coalesce_output(&rx, first);
            let _ = app.emit(
                "pty_output",
                PtyOutputEvent {
                    id: emit_id.clone(),
                    data,
                },
            );
        }
    });
    std::thread::spawn(move || {
        let mut decoder = Utf8StreamDecoder::default();
        let mut buf = vec![0u8; READ_BUFFER_SIZE];
        let send = |data: String| {
            if !data.is_empty() {
                let _ = tx.send(data);
            }
        };
        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(n) => send(decoder.decode(&buf[..n])),
            }
        }
        send(decoder.finish());
    });
    done_rx
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

    pub fn kill_all(&self) {
        let mut ptys = self.ptys.lock().unwrap_or_else(|e| e.into_inner());
        for (_, instance) in ptys.drain() {
            let _ = instance.killer.lock().map(|mut k| k.kill());
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

const MAX_ENV_VARS: usize = 256;

fn validate_env(env: Option<HashMap<String, String>>) -> Result<Vec<(String, String)>, String> {
    let env = env.unwrap_or_default();
    if env.len() > MAX_ENV_VARS {
        return Err(format!(
            "Too many environment variables (max {MAX_ENV_VARS})"
        ));
    }
    let mut vars: Vec<(String, String)> = env.into_iter().collect();
    for (key, value) in &vars {
        if key.is_empty() || key.contains('=') || key.contains('\0') {
            return Err(format!("Invalid environment variable name: {key:?}"));
        }
        if value.contains('\0') {
            return Err(format!("Invalid value for environment variable {key}"));
        }
    }
    vars.sort();
    Ok(vars)
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

#[tauri::command(async)]
pub fn create_pty(
    app: AppHandle,
    state: State<'_, PtyManager>,
    shell: Option<String>,
    cwd: Option<String>,
    cols: u16,
    rows: u16,
    env: Option<HashMap<String, String>>,
) -> Result<String, String> {
    let env = validate_env(env)?;
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

    let mut cmd = build_command(&shell, cwd.as_deref());
    for (key, value) in env {
        cmd.env(key, value);
    }
    shell_integration::apply(&app, &mut cmd, &shell);
    let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    drop(pair.slave);

    let id = uuid::Uuid::new_v4().to_string();

    let reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;
    let killer = child.clone_killer();

    let output_done = spawn_output_reader(app.clone(), id.clone(), reader);

    spawn_exit_watcher(app, id.clone(), child, output_done);

    let mut ptys = state.ptys.lock().map_err(|e| e.to_string())?;
    ptys.insert(
        id.clone(),
        PtyInstance {
            writer: Arc::new(Mutex::new(writer)),
            killer: Arc::new(Mutex::new(killer)),
            master: Arc::new(Mutex::new(pair.master)),
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

#[tauri::command(async)]
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
        (
            "cmd".to_string(),
            vec!["/c".to_string(), trimmed.to_string()],
        )
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

    let output_done = spawn_output_reader(app.clone(), id.clone(), reader);

    spawn_exit_watcher(app, id.clone(), child, output_done);

    let mut ptys = state.ptys.lock().map_err(|e| e.to_string())?;
    ptys.insert(
        id.clone(),
        PtyInstance {
            writer: Arc::new(Mutex::new(writer)),
            killer: Arc::new(Mutex::new(killer)),
            master: Arc::new(Mutex::new(pair.master)),
        },
    );

    Ok(id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::ffi::OsString;

    #[test]
    fn coalesce_output_merges_queued_chunks() {
        let (tx, rx) = mpsc::channel();
        tx.send("b".to_string()).unwrap();
        tx.send("c".to_string()).unwrap();

        assert_eq!(coalesce_output(&rx, "a".to_string()), "abc");
        assert_eq!(coalesce_output(&rx, "d".to_string()), "d");
    }

    #[test]
    fn resolve_shell_falls_back_to_the_default_shell() {
        assert_eq!(resolve_shell(None), default_shell());
        assert_eq!(resolve_shell(Some(String::new())), default_shell());
        assert_eq!(resolve_shell(Some("/bin/custom".into())), "/bin/custom");
        assert!(!default_shell().is_empty());
    }

    #[test]
    fn resolve_terminal_shell_rejects_missing_executables() {
        let dir = tempfile::tempdir().unwrap();
        let missing = dir.path().join("missing-shell");
        let existing = dir.path().join("shell");
        std::fs::write(&existing, "").unwrap();
        let existing = existing.to_string_lossy().into_owned();

        assert_eq!(
            resolve_terminal_shell(Some(missing.to_string_lossy().into_owned())).unwrap(),
            default_shell()
        );
        assert_eq!(
            resolve_terminal_shell(Some(existing.clone())).unwrap(),
            existing
        );
    }

    #[test]
    fn build_command_uses_an_existing_cwd_only() {
        let dir = tempfile::tempdir().unwrap();
        let cwd = dir.path().to_string_lossy().into_owned();
        let missing = dir.path().join("missing").to_string_lossy().into_owned();

        let with_cwd = build_command("/bin/sh", Some(&cwd));
        let with_missing = build_command("/bin/sh", Some(&missing));

        assert_eq!(with_cwd.get_cwd(), Some(&OsString::from(&cwd)));
        assert_eq!(with_missing.get_cwd(), None);
    }

    #[test]
    fn build_command_adds_powershell_flags() {
        let pwsh = build_command(r"C:\Program Files\PowerShell\7\PWSH.EXE", None);
        let sh = build_command("/bin/sh", None);

        assert_eq!(
            pwsh.get_argv()[1..],
            [
                OsString::from("-NoLogo"),
                OsString::from("-NoExit"),
                OsString::from("-NoProfile")
            ]
        );
        assert_eq!(sh.get_argv().len(), 1);
    }

    #[test]
    fn validate_env_accepts_valid_variables() {
        let env = HashMap::from([
            ("B".to_string(), "2".to_string()),
            ("A".to_string(), "x=y".to_string()),
        ]);

        assert_eq!(
            validate_env(Some(env)).unwrap(),
            vec![
                ("A".to_string(), "x=y".to_string()),
                ("B".to_string(), "2".to_string())
            ]
        );
        assert!(validate_env(None).unwrap().is_empty());
    }

    #[test]
    fn validate_env_rejects_invalid_variables() {
        for key in ["", "A=B", "A\0"] {
            let env = HashMap::from([(key.to_string(), "1".to_string())]);
            assert!(validate_env(Some(env)).is_err());
        }
        let env = HashMap::from([("A".to_string(), "1\0".to_string())]);
        assert!(validate_env(Some(env)).is_err());

        let too_many = (0..=MAX_ENV_VARS)
            .map(|index| (format!("VAR_{index}"), String::new()))
            .collect();
        assert!(validate_env(Some(too_many)).is_err());
    }

    #[cfg(not(windows))]
    #[test]
    fn build_command_sets_terminal_capabilities() {
        let cmd = build_command("/bin/sh", None);

        assert_eq!(
            cmd.get_env("TERM"),
            Some(std::ffi::OsStr::new("xterm-256color"))
        );
        assert_eq!(
            cmd.get_env("COLORTERM"),
            Some(std::ffi::OsStr::new("truecolor"))
        );
    }

    #[cfg(unix)]
    #[test]
    fn kill_all_terminates_running_ptys() {
        let pair = NativePtySystem::default()
            .openpty(PtySize {
                rows: 24,
                cols: 80,
                pixel_width: 0,
                pixel_height: 0,
            })
            .unwrap();
        let mut cmd = CommandBuilder::new("sleep");
        cmd.arg("30");
        let mut child = pair.slave.spawn_command(cmd).unwrap();
        drop(pair.slave);
        let manager = PtyManager::new();
        manager.ptys.lock().unwrap().insert(
            "pty".to_string(),
            PtyInstance {
                writer: Arc::new(Mutex::new(pair.master.take_writer().unwrap())),
                killer: Arc::new(Mutex::new(child.clone_killer())),
                master: Arc::new(Mutex::new(pair.master)),
            },
        );

        manager.kill_all();

        assert!(!child.wait().unwrap().success());
        assert!(manager.ptys.lock().unwrap().is_empty());
    }
}
