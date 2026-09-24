use std::path::Path;
use std::process::Stdio;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use crate::platform::{new_std_command_for_program, resolve_program};
#[cfg(unix)]
use std::os::unix::process::CommandExt;
use tauri::{AppHandle, State};

use super::cmdline::{parse_command, resolve_cwd};
use super::detection::{
    detect_package_json_suggestions, detect_python_suggestion, detect_tauri_suggestion,
    detect_vite_suggestion,
};
use super::manager::{RunInstance, RunManager};
#[cfg(unix)]
use super::process::set_process_group;
use super::process::{
    emit_output, emit_status, kill_process_group, spawn_error_reader, spawn_output_reader,
    wait_loop,
};
use super::types::{RunConfig, RunConfigFile, RunStatus};

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detect_configs_returns_empty_for_missing_workspace() {
        let suggestions =
            run_detect_configs("/nonexistent/path/that/should/not/exist".to_string()).unwrap();
        assert!(suggestions.is_empty());
    }
}
