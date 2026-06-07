use serde::Serialize;

use crate::git;

#[derive(Serialize)]
pub struct GitStatusResponse {
    pub snapshot: git::GitStatusSnapshot,
}

#[derive(Serialize)]
pub struct GitBranchesResponse {
    pub branches: Vec<git::GitBranch>,
}

#[derive(Serialize)]
pub struct GitLogResponse {
    pub commits: Vec<git::GitCommit>,
}

#[derive(Serialize)]
pub struct GitLogEntriesResponse {
    pub entries: Vec<git::GitLogEntry>,
}

#[derive(Serialize)]
pub struct GitCommitFilesResponse {
    pub files: Vec<git::GitCommitFileChange>,
}

#[derive(Serialize)]
pub struct GitCommitResult {
    pub commit_sha: String,
}

#[derive(Serialize)]
pub struct GitPushResponse {
    pub pushed: bool,
}

#[derive(Serialize)]
pub struct GitPullResponse {
    pub pulled: bool,
    pub had_conflicts: bool,
}

#[derive(Serialize)]
pub struct GitRemotesResponse {
    pub remotes: Vec<git::remote::GitRemote>,
}

#[derive(Serialize)]
pub struct GitRemoteBranchesResponse {
    pub branches: Vec<git::remote::GitRemoteBranch>,
}

#[tauri::command]
pub fn git_status(repo_path: String) -> Result<GitStatusResponse, String> {
    if repo_path.is_empty() {
        return Err("Repository path is required".to_string());
    }

    let snapshot = git::status::get_snapshot(&repo_path)?;
    Ok(GitStatusResponse { snapshot })
}

#[tauri::command]
pub fn git_branches(repo_path: String) -> Result<GitBranchesResponse, String> {
    if repo_path.is_empty() {
        return Err("Repository path is required".to_string());
    }

    let branches = git::graph::get_branches(&repo_path)?;
    Ok(GitBranchesResponse { branches })
}

#[tauri::command]
pub fn git_log(repo_path: String, limit: Option<usize>) -> Result<GitLogResponse, String> {
    if repo_path.is_empty() {
        return Err("Repository path is required".to_string());
    }

    let commits = git::graph::get_log(&repo_path, limit.unwrap_or(50))?;
    Ok(GitLogResponse { commits })
}

#[tauri::command]
pub fn git_log_entries(
    repo_path: String,
    limit: Option<usize>,
    before_sha: Option<String>,
) -> Result<GitLogEntriesResponse, String> {
    if repo_path.is_empty() {
        return Err("Repository path is required".to_string());
    }

    let entries = git::graph::get_log_entries(&repo_path, limit.unwrap_or(50), before_sha)?;
    Ok(GitLogEntriesResponse { entries })
}

#[tauri::command]
pub fn git_commit_files(repo_path: String, sha: String) -> Result<GitCommitFilesResponse, String> {
    if repo_path.is_empty() {
        return Err("Repository path is required".to_string());
    }
    if sha.is_empty() {
        return Err("Commit SHA is required".to_string());
    }

    let files = git::graph::get_commit_files(&repo_path, &sha)?;
    Ok(GitCommitFilesResponse { files })
}

#[tauri::command]
pub fn git_stage(repo_path: String, paths: Vec<String>) -> Result<(), String> {
    if repo_path.is_empty() {
        return Err("Repository path is required".to_string());
    }
    if paths.is_empty() {
        return Err("At least one file path is required".to_string());
    }

    git::status::stage_files(&repo_path, paths)
}

#[tauri::command]
pub fn git_unstage(repo_path: String, paths: Vec<String>) -> Result<(), String> {
    if repo_path.is_empty() {
        return Err("Repository path is required".to_string());
    }
    if paths.is_empty() {
        return Err("At least one file path is required".to_string());
    }

    git::status::unstage_files(&repo_path, paths)
}

#[tauri::command]
pub fn git_commit(repo_path: String, message: String) -> Result<GitCommitResult, String> {
    if repo_path.is_empty() {
        return Err("Repository path is required".to_string());
    }
    if message.trim().is_empty() {
        return Err("Commit message is required".to_string());
    }

    let commit_sha = git::status::commit(&repo_path, message)?;
    Ok(GitCommitResult { commit_sha })
}

#[tauri::command]
pub fn git_diff_file(
    repo_path: String,
    path: String,
    staged: Option<bool>,
) -> Result<String, String> {
    if repo_path.is_empty() {
        return Err("Repository path is required".to_string());
    }
    if path.is_empty() {
        return Err("File path is required".to_string());
    }

    git::status::get_file_diff(&repo_path, &path, staged.unwrap_or(false))
}

#[tauri::command]
pub fn git_checkout_branch(repo_path: String, branch_name: String) -> Result<(), String> {
    if repo_path.is_empty() {
        return Err("Repository path is required".to_string());
    }
    if branch_name.is_empty() {
        return Err("Branch name is required".to_string());
    }

    git::branch::checkout_branch(&repo_path, &branch_name)
}

#[tauri::command]
pub fn git_create_branch(
    repo_path: String,
    branch_name: String,
    checkout: Option<bool>,
) -> Result<(), String> {
    if repo_path.is_empty() {
        return Err("Repository path is required".to_string());
    }
    if branch_name.is_empty() {
        return Err("Branch name is required".to_string());
    }

    git::branch::create_branch(&repo_path, &branch_name, checkout.unwrap_or(false))
}

#[tauri::command]
pub fn git_delete_branch(repo_path: String, branch_name: String) -> Result<(), String> {
    if repo_path.is_empty() {
        return Err("Repository path is required".to_string());
    }
    if branch_name.is_empty() {
        return Err("Branch name is required".to_string());
    }

    git::branch::delete_branch(&repo_path, &branch_name)
}

#[tauri::command]
pub fn git_has_uncommitted_changes(repo_path: String) -> Result<bool, String> {
    if repo_path.is_empty() {
        return Err("Repository path is required".to_string());
    }

    git::branch::has_uncommitted_changes(&repo_path)
}

#[tauri::command]
pub async fn git_remotes(repo_path: String) -> Result<GitRemotesResponse, String> {
    if repo_path.is_empty() {
        return Err("Repository path is required".to_string());
    }

    let remotes = git::remote::list_remotes(&repo_path)?;
    Ok(GitRemotesResponse { remotes })
}

#[tauri::command]
pub async fn git_remote_branches(
    repo_path: String,
    remote_name: Option<String>,
) -> Result<GitRemoteBranchesResponse, String> {
    if repo_path.is_empty() {
        return Err("Repository path is required".to_string());
    }

    let branches = git::remote::list_remote_branches(&repo_path, remote_name)?;
    Ok(GitRemoteBranchesResponse { branches })
}

#[tauri::command]
pub async fn git_fetch(
    app: tauri::AppHandle,
    repo_path: String,
    remote_name: Option<String>,
    branch_name: Option<String>,
) -> Result<(), String> {
    if repo_path.is_empty() {
        return Err("Repository path is required".to_string());
    }

    git::remote::fetch(&repo_path, remote_name, branch_name, Some(&app))
}

#[tauri::command]
pub async fn git_push(
    app: tauri::AppHandle,
    repo_path: String,
    remote_name: Option<String>,
    branch_name: Option<String>,
) -> Result<GitPushResponse, String> {
    if repo_path.is_empty() {
        return Err("Repository path is required".to_string());
    }

    let result = git::remote::push(&repo_path, remote_name, branch_name, Some(&app))?;
    Ok(GitPushResponse {
        pushed: result.pushed,
    })
}

#[tauri::command]
pub async fn git_pull(
    app: tauri::AppHandle,
    repo_path: String,
    remote_name: Option<String>,
    branch_name: Option<String>,
    rebase: Option<bool>,
) -> Result<GitPullResponse, String> {
    if repo_path.is_empty() {
        return Err("Repository path is required".to_string());
    }

    let result = git::remote::pull(
        &repo_path,
        remote_name,
        branch_name,
        rebase.unwrap_or(false),
        Some(&app),
    )?;
    Ok(GitPullResponse {
        pulled: result.pulled,
        had_conflicts: result.had_conflicts,
    })
}
