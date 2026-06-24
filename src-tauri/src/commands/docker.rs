use bollard::models::ContainerSummaryStateEnum;
use bollard::query_parameters::{
    ListContainersOptionsBuilder, RestartContainerOptionsBuilder, StopContainerOptionsBuilder,
};
use bollard::Docker;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use std::process::{Command, Stdio};

// ─── Request / Response Types ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct DockerContainer {
    pub id: String,
    pub names: Vec<String>,
    pub image: String,
    pub status: String,
    pub state: String,
    pub labels: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct RuntimeInfo {
    pub runtime: String,
    pub binary_path: String,
    pub version: String,
    pub available: bool,
    pub compose_available: bool,
    pub compose_file: Option<String>,
    pub compose_project_name: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ContainerActionRequest {
    pub id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComposeActionRequest {
    pub workspace_root: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeInfoRequest {
    pub workspace_root: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComposeBranchCheckRequest {
    pub repo_path: String,
    pub workspace_root: String,
    pub source_branch: String,
    pub target_branch: String,
}

// ─── Helpers ────────────────────────────────────────────────

fn docker_client() -> Result<Docker, String> {
    Docker::connect_with_local_defaults()
        .map_err(|e| format!("Failed to connect to Docker/Podman: {e}"))
}

fn container_name(names: Option<Vec<String>>) -> Vec<String> {
    names
        .unwrap_or_default()
        .into_iter()
        .map(|n| n.trim_start_matches('/').to_string())
        .collect()
}

fn container_image(image: Option<String>) -> String {
    image.unwrap_or_else(|| "<no image>".to_string())
}

fn container_status(
    status: Option<String>,
    state: Option<ContainerSummaryStateEnum>,
) -> (String, String) {
    let state = state
        .map(|s| format!("{s:?}").to_lowercase())
        .unwrap_or_else(|| "unknown".to_string());
    let status = status.unwrap_or_else(|| state.clone());
    (status, state)
}

fn version_from_output(output: &[u8]) -> String {
    String::from_utf8_lossy(output)
        .lines()
        .next()
        .unwrap_or("")
        .trim()
        .to_string()
}

fn try_binary(path: &str) -> Option<(String, String)> {
    let output = Command::new(path).arg("--version").output().ok()?;
    if !output.status.success() {
        return None;
    }
    let version = version_from_output(&output.stdout);
    if version.is_empty() {
        return None;
    }
    Some((path.to_string(), version))
}

fn shell_command_v(name: &str) -> Option<String> {
    let shell = crate::modules::env_loader::default_shell();
    let output = Command::new(&shell)
        .args(["-ilc", &format!("command -v {name}")])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if path.is_empty() || !Path::new(&path).is_file() {
        return None;
    }
    Some(path)
}

fn detect_runtime_binary() -> (String, String, String) {
    for candidate in ["docker", "podman"] {
        if let Some((path, version)) = try_binary(candidate) {
            return (candidate.to_string(), path, version);
        }
    }

    for candidate in ["docker", "podman"] {
        if let Some(path) = shell_command_v(candidate) {
            if let Some((path, version)) = try_binary(&path) {
                return (candidate.to_string(), path, version);
            }
        }
    }

    let home = std::env::var("HOME").unwrap_or_default();
    let fallback_paths: Vec<String> = [
        "/usr/local/bin/docker",
        "/usr/local/bin/podman",
        "/opt/homebrew/bin/docker",
        "/opt/homebrew/bin/podman",
        "/opt/podman/bin/podman",
        "/usr/bin/docker",
        "/usr/bin/podman",
        "/bin/docker",
        "/bin/podman",
    ]
    .iter()
    .map(|p| p.to_string())
    .chain(
        [
            ".docker/bin/docker",
            ".local/bin/docker",
            ".local/bin/podman",
        ]
        .iter()
        .map(|p| format!("{home}/{p}")),
    )
    .collect();

    for path in fallback_paths {
        if let Some((path, version)) = try_binary(&path) {
            let name = if path.contains("podman") {
                "podman"
            } else {
                "docker"
            };
            return (name.to_string(), path, version);
        }
    }

    ("docker".to_string(), "docker".to_string(), String::new())
}

fn find_compose_file(workspace_root: &str) -> Option<String> {
    for name in [
        "docker-compose.yml",
        "docker-compose.yaml",
        "compose.yml",
        "compose.yaml",
    ] {
        let path = Path::new(workspace_root).join(name);
        if path.is_file() {
            return Some(name.to_string());
        }
    }
    None
}

fn compose_project_name(workspace_root: &str) -> Option<String> {
    let compose_file = find_compose_file(workspace_root)?;
    let path = Path::new(workspace_root).join(&compose_file);
    let content = std::fs::read_to_string(&path).ok()?;

    // Look for an explicit `name:` field at the top level of the compose file.
    for line in content.lines() {
        let trimmed = line.trim();
        if let Some(value) = trimmed.strip_prefix("name:") {
            let name = value
                .trim()
                .trim_matches(|c| c == '\'' || c == '"')
                .to_string();
            if !name.is_empty() {
                return Some(name);
            }
        }
    }

    // Default Docker Compose behavior: use the directory name as the project name.
    Path::new(workspace_root)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
}

fn validate_workspace_root(workspace_root: &str) -> Result<(), String> {
    if workspace_root.is_empty() {
        return Err("workspace_root is required".to_string());
    }
    let path = Path::new(workspace_root);
    if !path.is_dir() {
        return Err(format!("Workspace root does not exist: {workspace_root}"));
    }
    Ok(())
}

fn run_compose(
    workspace_root: &str,
    binary_path: &str,
    action: &str,
    args: &[&str],
) -> Result<String, String> {
    validate_workspace_root(workspace_root)?;
    if find_compose_file(workspace_root).is_none() {
        return Err("No compose file found in workspace root".to_string());
    }

    let mut cmd = Command::new(binary_path);
    cmd.arg("compose")
        .arg(action)
        .args(args)
        .current_dir(workspace_root);

    let output = cmd
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|e| format!("Failed to run docker compose {action}: {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if !output.status.success() {
        let message = if stderr.is_empty() { stdout } else { stderr };
        return Err(format!("docker compose {action} failed: {message}"));
    }

    Ok(if stdout.is_empty() { stderr } else { stdout })
}

async fn container_exists(id: &str) -> Result<bool, String> {
    let docker = docker_client()?;
    let containers = docker
        .list_containers(Some(
            ListContainersOptionsBuilder::default().all(true).build(),
        ))
        .await
        .map_err(|e| format!("Failed to list containers: {e}"))?;
    Ok(containers.into_iter().any(|c| c.id.as_deref() == Some(id)))
}

// ─── Commands ────────────────────────────────────────────────

#[tauri::command]
pub async fn docker_list_containers() -> Result<Vec<DockerContainer>, String> {
    let docker = docker_client()?;
    let containers = docker
        .list_containers(Some(
            ListContainersOptionsBuilder::default().all(true).build(),
        ))
        .await
        .map_err(|e| format!("Failed to list containers: {e}"))?;

    Ok(containers
        .into_iter()
        .map(|c| {
            let (status, state) = container_status(c.status.clone(), c.state.clone());
            DockerContainer {
                id: c.id.unwrap_or_default(),
                names: container_name(c.names),
                image: container_image(c.image),
                status,
                state,
                labels: c.labels.unwrap_or_default(),
            }
        })
        .collect())
}

#[tauri::command]
pub async fn docker_start_container(req: ContainerActionRequest) -> Result<(), String> {
    if req.id.is_empty() {
        return Err("container id is required".to_string());
    }
    if !container_exists(&req.id).await? {
        return Err(format!("Container not found: {}", req.id));
    }
    let docker = docker_client()?;
    docker
        .start_container(&req.id, None)
        .await
        .map_err(|e| format!("Failed to start container: {e}"))
}

#[tauri::command]
pub async fn docker_stop_container(req: ContainerActionRequest) -> Result<(), String> {
    if req.id.is_empty() {
        return Err("container id is required".to_string());
    }
    if !container_exists(&req.id).await? {
        return Err(format!("Container not found: {}", req.id));
    }
    let docker = docker_client()?;
    let options = StopContainerOptionsBuilder::default().t(10).build();
    docker
        .stop_container(&req.id, Some(options))
        .await
        .map_err(|e| format!("Failed to stop container: {e}"))
}

#[tauri::command]
pub async fn docker_restart_container(req: ContainerActionRequest) -> Result<(), String> {
    if req.id.is_empty() {
        return Err("container id is required".to_string());
    }
    if !container_exists(&req.id).await? {
        return Err(format!("Container not found: {}", req.id));
    }
    let docker = docker_client()?;
    let options = RestartContainerOptionsBuilder::default().t(10).build();
    docker
        .restart_container(&req.id, Some(options))
        .await
        .map_err(|e| format!("Failed to restart container: {e}"))
}

async fn runtime_info(workspace_root: Option<String>) -> Result<RuntimeInfo, String> {
    let (runtime, binary_path, version) = detect_runtime_binary();
    let available = !version.is_empty();

    let compose_file = workspace_root.as_deref().and_then(find_compose_file);
    let compose_project_name = workspace_root.as_deref().and_then(compose_project_name);

    let compose_available = if available && workspace_root.is_some() {
        Command::new(&binary_path)
            .args(["compose", "version"])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .map(|s| s.success())
            .unwrap_or(false)
    } else {
        false
    };

    log::info!(
        "Docker runtime detection: runtime={runtime}, binary={binary_path}, available={available}"
    );

    Ok(RuntimeInfo {
        runtime,
        binary_path,
        version,
        available,
        compose_available,
        compose_file,
        compose_project_name,
    })
}

#[tauri::command]
pub async fn docker_runtime_info(req: RuntimeInfoRequest) -> Result<RuntimeInfo, String> {
    runtime_info(req.workspace_root).await
}

#[tauri::command]
pub async fn docker_compose_up(req: ComposeActionRequest) -> Result<String, String> {
    let info = runtime_info(Some(req.workspace_root.clone())).await?;
    if !info.available {
        return Err("Docker/Podman is not available".to_string());
    }
    run_compose(&req.workspace_root, &info.binary_path, "up", &["-d"])
}

#[tauri::command]
pub async fn docker_compose_down(req: ComposeActionRequest) -> Result<(), String> {
    let info = runtime_info(Some(req.workspace_root.clone())).await?;
    if !info.available {
        return Err("Docker/Podman is not available".to_string());
    }
    run_compose(&req.workspace_root, &info.binary_path, "down", &[]).map(|_| ())
}

#[tauri::command]
pub async fn docker_compose_build(req: ComposeActionRequest) -> Result<(), String> {
    let info = runtime_info(Some(req.workspace_root.clone())).await?;
    if !info.available {
        return Err("Docker/Podman is not available".to_string());
    }
    run_compose(&req.workspace_root, &info.binary_path, "build", &[]).map(|_| ())
}

#[tauri::command]
pub async fn docker_compose_restart(req: ComposeActionRequest) -> Result<(), String> {
    let info = runtime_info(Some(req.workspace_root.clone())).await?;
    if !info.available {
        return Err("Docker/Podman is not available".to_string());
    }
    run_compose(&req.workspace_root, &info.binary_path, "restart", &[]).map(|_| ())
}

#[tauri::command]
pub async fn docker_compose_changed_between_branches(
    req: ComposeBranchCheckRequest,
) -> Result<bool, String> {
    if req.repo_path.is_empty() {
        return Err("Repository path is required".to_string());
    }
    if req.workspace_root.is_empty() {
        return Err("Workspace root is required".to_string());
    }
    if req.source_branch.is_empty() || req.target_branch.is_empty() {
        return Err("Source and target branch names are required".to_string());
    }
    crate::modules::git::operations::compose_file_changed_between_branches(
        &req.repo_path,
        &req.workspace_root,
        &req.source_branch,
        &req.target_branch,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn docker_compose_up_build(req: ComposeActionRequest) -> Result<String, String> {
    let info = runtime_info(Some(req.workspace_root.clone())).await?;
    if !info.available {
        return Err("Docker/Podman is not available".to_string());
    }
    run_compose(
        &req.workspace_root,
        &info.binary_path,
        "up",
        &["--build", "-d"],
    )
}
