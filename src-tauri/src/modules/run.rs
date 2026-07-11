use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{BufRead, BufReader};
#[cfg(unix)]
use std::os::unix::process::CommandExt;
use std::path::Path;
use std::process::{Child, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use crate::platform::{new_std_command, new_std_command_for_program, resolve_program};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

// -- Data Types ----------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunConfig {
    #[serde(default)]
    pub id: Option<String>,
    pub name: String,
    pub command: String,
    pub cwd: Option<String>,
    #[serde(default)]
    pub env: HashMap<String, String>,
    #[serde(default)]
    pub autostart: bool,
    #[serde(default, alias = "auto_restart")]
    pub auto_restart: bool,
    #[serde(default)]
    pub icon: Option<String>,
    #[serde(default)]
    pub detect: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
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

// -- Run Manager ---------------------------------------------------------------

struct RunInstance {
    pgid: i32,
    stop_requested: Arc<AtomicBool>,
}

pub struct RunManager {
    processes: Mutex<HashMap<String, RunInstance>>,
}

impl Default for RunManager {
    fn default() -> Self {
        Self::new()
    }
}

impl RunManager {
    pub fn new() -> Self {
        Self {
            processes: Mutex::new(HashMap::new()),
        }
    }

    pub fn stop_all(&self) {
        let processes = self.processes.lock().unwrap_or_else(|e| e.into_inner());
        for (_, instance) in processes.iter() {
            instance.stop_requested.store(true, Ordering::SeqCst);
            kill_process_group(instance.pgid);
        }
    }
}

// -- Helpers -------------------------------------------------------------------

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

    let chars = trimmed.chars();
    let mut parts: Vec<String> = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;
    let mut quote_char = '\0';

    for c in chars {
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

#[cfg(unix)]
fn kill_process_group(pgid: i32) {
    unsafe {
        libc::killpg(pgid, libc::SIGTERM);
        std::thread::sleep(std::time::Duration::from_millis(200));
        libc::killpg(pgid, libc::SIGKILL);
    }
}

#[cfg(windows)]
fn kill_process_group(pgid: i32) {
    // Use taskkill to terminate the process tree rooted at the given PID.
    // This is a pragmatic fallback until a JobObject-based implementation
    // is added for cleaner process-tree management.
    let _ = new_std_command("taskkill")
        .args(["/T", "/F", "/PID", &pgid.to_string()])
        .output();
}

fn spawn_output_reader(app: AppHandle, process_id: String, output: std::process::ChildStdout) {
    std::thread::spawn(move || {
        let reader = BufReader::new(output);
        for line in reader.lines().map_while(Result::ok) {
            emit_output(&app, &process_id, format!("{line}\n"));
        }
    });
}

fn spawn_error_reader(app: AppHandle, process_id: String, output: std::process::ChildStderr) {
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

fn wait_loop(
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

// -- Detection -----------------------------------------------------------------

fn resolve_package_manager(workspace_root: &str) -> &'static str {
    let root = Path::new(workspace_root);
    if root.join("pnpm-lock.yaml").exists() {
        "pnpm"
    } else if root.join("yarn.lock").exists() {
        "yarn"
    } else if root.join("bun.lockb").exists() || root.join("bun.lock").exists() {
        "bun"
    } else {
        "npm"
    }
}

fn detect_package_json_suggestions(workspace_root: &str) -> Vec<RunConfig> {
    let path = Path::new(workspace_root).join("package.json");
    if !path.exists() {
        return Vec::new();
    }

    let content = match std::fs::read_to_string(&path) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };

    let package: serde_json::Value = match serde_json::from_str(&content) {
        Ok(v) => v,
        Err(_) => return Vec::new(),
    };

    let scripts = package.get("scripts").and_then(|s| s.as_object());
    let scripts = match scripts {
        Some(s) => s,
        None => return Vec::new(),
    };

    let pm = resolve_package_manager(workspace_root);
    let mut suggestions = Vec::new();

    for script in ["dev", "start", "serve"] {
        if scripts.contains_key(script) {
            suggestions.push(RunConfig {
                id: None,
                name: script.to_string(),
                command: format!("{pm} run {script}"),
                cwd: None,
                env: HashMap::new(),
                autostart: false,
                auto_restart: false,
                icon: Some("terminal".to_string()),
                detect: Some("package.json".to_string()),
            });
        }
    }

    suggestions
}

fn detect_vite_suggestion(workspace_root: &str) -> Option<RunConfig> {
    let root = Path::new(workspace_root);
    let has_vite_config = std::fs::read_dir(root)
        .ok()?
        .filter_map(|e| e.ok())
        .any(|e| {
            let name = e.file_name();
            let name = name.to_string_lossy();
            name.starts_with("vite.config.")
        });

    if !has_vite_config {
        return None;
    }

    let pm = resolve_package_manager(workspace_root);
    Some(RunConfig {
        id: None,
        name: "vite".to_string(),
        command: format!("{pm} exec vite"),
        cwd: None,
        env: HashMap::new(),
        autostart: false,
        auto_restart: false,
        icon: Some("lightning".to_string()),
        detect: Some("vite.config.*".to_string()),
    })
}

fn detect_tauri_suggestion(workspace_root: &str) -> Option<RunConfig> {
    let root = Path::new(workspace_root);
    if !root.join("src-tauri").join("Cargo.toml").exists() {
        return None;
    }

    let pm = resolve_package_manager(workspace_root);
    Some(RunConfig {
        id: None,
        name: "tauri dev".to_string(),
        command: format!("{pm} tauri dev"),
        cwd: None,
        env: HashMap::new(),
        autostart: false,
        auto_restart: false,
        icon: Some("desktop".to_string()),
        detect: Some("src-tauri/Cargo.toml".to_string()),
    })
}

fn detect_python_suggestion(workspace_root: &str) -> Option<RunConfig> {
    let root = Path::new(workspace_root);
    let has_python_project =
        root.join("requirements.txt").exists() || root.join("pyproject.toml").exists();

    if !has_python_project {
        return None;
    }

    if root.join("manage.py").exists() {
        return Some(RunConfig {
            id: None,
            name: "django".to_string(),
            command: "python manage.py runserver".to_string(),
            cwd: None,
            env: HashMap::new(),
            autostart: false,
            auto_restart: false,
            icon: Some("snake".to_string()),
            detect: Some("manage.py".to_string()),
        });
    }

    None
}

// -- Commands ------------------------------------------------------------------

#[tauri::command]
pub fn run_list_configs(workspace_root: String) -> Result<Vec<RunConfig>, String> {
    let config_path = Path::new(&workspace_root).join(".pragma").join("run.json");

    if !config_path.exists() {
        return Ok(Vec::new());
    }

    let content = std::fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read run config: {e}"))?;

    let mut config_file: RunConfigFile =
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse run config: {e}"))?;

    // One-time migration: ensure every saved config has a stable id.
    let mut changed = false;
    for config in &mut config_file.configurations {
        if config.id.is_none() || config.id.as_ref().is_some_and(|id| id.is_empty()) {
            config.id = Some(uuid::Uuid::new_v4().to_string());
            changed = true;
        }
    }

    if changed {
        let content = serde_json::to_string_pretty(&config_file)
            .map_err(|e| format!("Failed to serialize run config: {e}"))?;
        let _ = std::fs::write(&config_path, content);
    }

    Ok(config_file.configurations)
}

#[tauri::command]
pub fn run_detect_configs(workspace_root: String) -> Result<Vec<RunConfig>, String> {
    let root = Path::new(&workspace_root);
    if !root.exists() || !root.is_dir() {
        return Ok(Vec::new());
    }

    let mut suggestions = Vec::new();
    suggestions.extend(detect_package_json_suggestions(&workspace_root));

    if let Some(s) = detect_vite_suggestion(&workspace_root) {
        suggestions.push(s);
    }
    if let Some(s) = detect_tauri_suggestion(&workspace_root) {
        suggestions.push(s);
    }
    if let Some(s) = detect_python_suggestion(&workspace_root) {
        suggestions.push(s);
    }

    Ok(suggestions)
}

#[tauri::command]
pub fn run_save_configs(workspace_root: String, mut configs: Vec<RunConfig>) -> Result<(), String> {
    let pragma_dir = Path::new(&workspace_root).join(".pragma");
    if !pragma_dir.exists() {
        std::fs::create_dir_all(&pragma_dir)
            .map_err(|e| format!("Failed to create .pragma directory: {e}"))?;
    }

    for config in &mut configs {
        if config.id.is_none() || config.id.as_ref().is_some_and(|id| id.is_empty()) {
            config.id = Some(uuid::Uuid::new_v4().to_string());
        }
    }

    let config_path = pragma_dir.join("run.json");
    let file = RunConfigFile {
        configurations: configs,
    };
    let content = serde_json::to_string_pretty(&file)
        .map_err(|e| format!("Failed to serialize run config: {e}"))?;

    std::fs::write(&config_path, content)
        .map_err(|e| format!("Failed to write run config: {e}"))?;

    Ok(())
}

#[tauri::command]
pub fn check_port_in_use(port: u16) -> Result<bool, String> {
    Ok(crate::platform::check_port_in_use(port))
}

#[tauri::command]
pub fn kill_process_by_port(port: u16) -> Result<(), String> {
    crate::platform::kill_process_by_port(port)
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

    let resolved_program =
        resolve_program(&program).map_err(|e| format!("{e}. Command: {}", config.command))?;

    let mut cmd = new_std_command_for_program(&resolved_program);
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

    let mut child = cmd.spawn().map_err(|e| {
        let path = std::env::var("PATH").unwrap_or_else(|_| String::from("<not set>"));
        format!(
            "Failed to start process: {e}\nResolved program: {}\nPATH: {path}",
            resolved_program.display()
        )
    })?;

    // Get the process group ID (same as child PID on Unix since we called setpgid)
    #[cfg(unix)]
    let pgid = child.id() as i32;
    #[cfg(windows)]
    let pgid = child.id() as i32;

    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;

    let stop_requested = Arc::new(AtomicBool::new(false));

    {
        let mut processes = state.processes.lock().map_err(|e| e.to_string())?;
        processes.insert(
            process_id.clone(),
            RunInstance {
                pgid,
                stop_requested: stop_requested.clone(),
            },
        );
    }

    spawn_output_reader(app.clone(), process_id.clone(), stdout);
    spawn_error_reader(app.clone(), process_id.clone(), stderr);

    emit_status(&app, &process_id, RunStatus::Running, None);
    emit_output(
        &app,
        &process_id,
        format!("> {} (in {})\n", resolved_program.display(), cwd),
    );

    let app_handle = app.clone();
    let pid = process_id.clone();
    let ws = workspace_root.clone();
    let cfg = config.clone();
    std::thread::spawn(move || {
        wait_loop(app_handle, ws, cfg, pid, child, stop_requested);
    });

    Ok(process_id)
}

#[tauri::command]
pub fn run_stop(state: State<'_, RunManager>, process_id: String) -> Result<(), String> {
    let instance = {
        let mut processes = state.processes.lock().map_err(|e| e.to_string())?;
        processes.remove(&process_id)
    };

    if let Some(instance) = instance {
        instance.stop_requested.store(true, Ordering::SeqCst);
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
            instance.stop_requested.store(true, Ordering::SeqCst);
            kill_process_group(instance.pgid);
        }
    }
    run_start(app, state, workspace_root, config)
}

// -- Tests ---------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn parse_command_respects_quotes() {
        let (program, args) = parse_command("node --foo \"bar baz\"");
        assert_eq!(program, "node");
        assert_eq!(args, vec!["--foo", "bar baz"]);
    }

    #[test]
    fn parse_command_empty_returns_empty() {
        let (program, args) = parse_command("   ");
        assert!(program.is_empty());
        assert!(args.is_empty());
    }

    #[test]
    fn restart_delay_ms_caps_at_30s() {
        assert_eq!(restart_delay_ms(0), 1000);
        assert_eq!(restart_delay_ms(1), 2000);
        assert_eq!(restart_delay_ms(4), 16000);
        assert_eq!(restart_delay_ms(5), 30000);
        assert_eq!(restart_delay_ms(10), 30000);
    }

    #[test]
    fn detect_package_json_suggestions_finds_dev_script() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path().join("package.json");
        let mut file = std::fs::File::create(&path).unwrap();
        file.write_all(br#"{"scripts": {"dev": "vite", "build": "tsc"}}"#)
            .unwrap();

        let suggestions = detect_package_json_suggestions(tmp.path().to_str().unwrap());
        assert_eq!(suggestions.len(), 1);
        assert_eq!(suggestions[0].name, "dev");
        assert_eq!(suggestions[0].command, "npm run dev");
        assert_eq!(suggestions[0].detect, Some("package.json".to_string()));
    }

    #[test]
    fn detect_vite_suggestion_uses_package_manager() {
        let tmp = tempfile::tempdir().unwrap();
        std::fs::File::create(tmp.path().join("vite.config.ts")).unwrap();
        std::fs::File::create(tmp.path().join("pnpm-lock.yaml")).unwrap();

        let suggestion = detect_vite_suggestion(tmp.path().to_str().unwrap()).unwrap();
        assert_eq!(suggestion.command, "pnpm exec vite");
    }

    #[test]
    fn detect_tauri_suggestion_requires_cargo_toml() {
        let tmp = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(tmp.path().join("src-tauri")).unwrap();
        std::fs::File::create(tmp.path().join("src-tauri").join("Cargo.toml")).unwrap();

        let suggestion = detect_tauri_suggestion(tmp.path().to_str().unwrap()).unwrap();
        assert_eq!(suggestion.name, "tauri dev");
        assert_eq!(suggestion.command, "npm tauri dev");
    }

    #[test]
    fn detect_python_suggestion_finds_django() {
        let tmp = tempfile::tempdir().unwrap();
        std::fs::File::create(tmp.path().join("requirements.txt")).unwrap();
        std::fs::File::create(tmp.path().join("manage.py")).unwrap();

        let suggestion = detect_python_suggestion(tmp.path().to_str().unwrap()).unwrap();
        assert_eq!(suggestion.command, "python manage.py runserver");
    }

    #[test]
    fn detect_configs_returns_empty_for_missing_workspace() {
        let suggestions =
            run_detect_configs("/nonexistent/path/that/should/not/exist".to_string()).unwrap();
        assert!(suggestions.is_empty());
    }
}
