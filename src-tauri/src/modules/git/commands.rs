use crate::modules::git::operations;
use crate::modules::git::types::{
    GitBranch, GitCommitFileChange, GitCommitResult, GitDiffContentResult, GitDiffResult,
    GitLogEntry, GitPullResult, GitPushResult, GitRemote, GitRemoteBranch, GitStatusSnapshot,
};

async fn blocking<F, T>(f: F) -> Result<T, String>
where
    F: FnOnce() -> Result<T, String> + Send + 'static,
    T: Send + 'static,
{
    tauri::async_runtime::spawn_blocking(f)
        .await
        .map_err(|e| e.to_string())?
}

#[derive(serde::Serialize)]
pub struct GitStatusResponse {
    pub snapshot: GitStatusSnapshot,
}

#[tauri::command]
pub async fn git_status(repo_path: String) -> Result<GitStatusResponse, String> {
    if repo_path.is_empty() {
        return Err("Repository path is required".to_string());
    }
    blocking(move || {
        let snapshot = operations::status(&repo_path)?;
        Ok(GitStatusResponse { snapshot })
    })
    .await
}

#[derive(serde::Serialize)]
pub struct GitBranchesResponse {
    pub branches: Vec<GitBranch>,
}

#[tauri::command]
pub async fn git_branches(repo_path: String) -> Result<GitBranchesResponse, String> {
    if repo_path.is_empty() {
        return Err("Repository path is required".to_string());
    }
    blocking(move || {
        let branches = operations::get_branches(&repo_path)?;
        Ok(GitBranchesResponse { branches })
    })
    .await
}

#[derive(serde::Serialize)]
pub struct GitLogResponse {
    pub commits: Vec<crate::modules::git::types::GitCommit>,
}

#[tauri::command]
pub async fn git_log(repo_path: String, limit: Option<u32>) -> Result<GitLogResponse, String> {
    if repo_path.is_empty() {
        return Err("Repository path is required".to_string());
    }
    blocking(move || {
        let entries = operations::log(&repo_path, limit.unwrap_or(50), None)?;
        let commits: Vec<crate::modules::git::types::GitCommit> = entries
            .into_iter()
            .map(|e| crate::modules::git::types::GitCommit {
                id: e.sha,
                message: e.subject,
                author: e.author,
                time: e.timestamp_secs,
            })
            .collect();
        Ok(GitLogResponse { commits })
    })
    .await
}

#[derive(serde::Serialize)]
pub struct GitLogEntriesResponse {
    pub entries: Vec<GitLogEntry>,
}

#[tauri::command]
pub async fn git_log_entries(
    repo_path: String,
    limit: Option<u32>,
    before_sha: Option<String>,
) -> Result<GitLogEntriesResponse, String> {
    if repo_path.is_empty() {
        return Err("Repository path is required".to_string());
    }
    blocking(move || {
        let entries = operations::log(&repo_path, limit.unwrap_or(50), before_sha.as_deref())?;
        Ok(GitLogEntriesResponse { entries })
    })
    .await
}

#[tauri::command]
pub async fn git_commit_files(
    repo_path: String,
    sha: String,
) -> Result<Vec<GitCommitFileChange>, String> {
    if repo_path.is_empty() {
        return Err("Repository path is required".to_string());
    }
    if sha.is_empty() {
        return Err("Commit SHA is required".to_string());
    }
    blocking(move || operations::commit_files(&repo_path, &sha).map_err(Into::into)).await
}

#[tauri::command]
pub async fn git_stage(repo_path: String, paths: Vec<String>) -> Result<(), String> {
    if repo_path.is_empty() {
        return Err("Repository path is required".to_string());
    }
    if paths.is_empty() {
        return Err("At least one file path is required".to_string());
    }
    blocking(move || operations::stage(&repo_path, &paths).map_err(Into::into)).await
}

#[tauri::command]
pub async fn git_unstage(repo_path: String, paths: Vec<String>) -> Result<(), String> {
    if repo_path.is_empty() {
        return Err("Repository path is required".to_string());
    }
    if paths.is_empty() {
        return Err("At least one file path is required".to_string());
    }
    blocking(move || operations::unstage(&repo_path, &paths).map_err(Into::into)).await
}

#[tauri::command]
pub async fn git_discard(repo_path: String, paths: Vec<String>) -> Result<(), String> {
    if repo_path.is_empty() {
        return Err("Repository path is required".to_string());
    }
    if paths.is_empty() {
        return Err("At least one file path is required".to_string());
    }
    blocking(move || operations::discard(&repo_path, &paths).map_err(Into::into)).await
}

#[tauri::command]
pub async fn git_diff(
    repo_path: String,
    path: Option<String>,
    staged: bool,
) -> Result<GitDiffResult, String> {
    if repo_path.is_empty() {
        return Err("Repository path is required".to_string());
    }
    blocking(move || operations::diff(&repo_path, path.as_deref(), staged).map_err(Into::into))
        .await
}

#[tauri::command]
pub async fn git_diff_content(
    repo_path: String,
    path: String,
    staged: bool,
    original_path: Option<String>,
) -> Result<GitDiffContentResult, String> {
    if repo_path.is_empty() {
        return Err("Repository path is required".to_string());
    }
    blocking(move || {
        operations::diff_content(&repo_path, &path, staged, original_path.as_deref())
            .map_err(Into::into)
    })
    .await
}

#[tauri::command]
pub async fn git_commit(repo_path: String, message: String) -> Result<GitCommitResult, String> {
    if repo_path.is_empty() {
        return Err("Repository path is required".to_string());
    }
    if message.trim().is_empty() {
        return Err("Commit message is required".to_string());
    }
    blocking(move || operations::commit(&repo_path, &message).map_err(Into::into)).await
}

#[tauri::command]
pub async fn git_checkout_branch(repo_path: String, branch_name: String) -> Result<(), String> {
    if repo_path.is_empty() {
        return Err("Repository path is required".to_string());
    }
    if branch_name.is_empty() {
        return Err("Branch name is required".to_string());
    }
    blocking(move || operations::checkout_branch(&repo_path, &branch_name).map_err(Into::into))
        .await
}

#[tauri::command]
pub async fn git_create_branch(
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
    blocking(move || {
        operations::create_branch(&repo_path, &branch_name, checkout.unwrap_or(false))
            .map_err(Into::into)
    })
    .await
}

#[tauri::command]
pub async fn git_delete_branch(repo_path: String, branch_name: String) -> Result<(), String> {
    if repo_path.is_empty() {
        return Err("Repository path is required".to_string());
    }
    if branch_name.is_empty() {
        return Err("Branch name is required".to_string());
    }
    blocking(move || operations::delete_branch(&repo_path, &branch_name).map_err(Into::into)).await
}

#[tauri::command]
pub async fn git_has_uncommitted_changes(repo_path: String) -> Result<bool, String> {
    if repo_path.is_empty() {
        return Err("Repository path is required".to_string());
    }
    blocking(move || operations::has_uncommitted_changes(&repo_path).map_err(Into::into)).await
}

#[derive(serde::Serialize)]
pub struct GitRemotesResponse {
    pub remotes: Vec<GitRemote>,
}

#[tauri::command]
pub async fn git_remotes(repo_path: String) -> Result<GitRemotesResponse, String> {
    if repo_path.is_empty() {
        return Err("Repository path is required".to_string());
    }
    blocking(move || {
        let remotes = operations::list_remotes(&repo_path)?;
        Ok(GitRemotesResponse { remotes })
    })
    .await
}

#[tauri::command]
pub async fn git_remote_branches(
    repo_path: String,
    remote_name: Option<String>,
) -> Result<Vec<GitRemoteBranch>, String> {
    if repo_path.is_empty() {
        return Err("Repository path is required".to_string());
    }
    blocking(move || {
        operations::list_remote_branches(&repo_path, remote_name.as_deref()).map_err(Into::into)
    })
    .await
}

#[tauri::command]
pub async fn git_fetch(
    repo_path: String,
    remote_name: Option<String>,
    branch_name: Option<String>,
) -> Result<(), String> {
    if repo_path.is_empty() {
        return Err("Repository path is required".to_string());
    }
    blocking(move || {
        operations::fetch(&repo_path, remote_name.as_deref(), branch_name.as_deref())
            .map_err(Into::into)
    })
    .await
}

#[tauri::command]
pub async fn git_pull(
    repo_path: String,
    _remote_name: Option<String>,
    _branch_name: Option<String>,
    _rebase: Option<bool>,
) -> Result<GitPullResult, String> {
    if repo_path.is_empty() {
        return Err("Repository path is required".to_string());
    }
    blocking(move || {
        operations::pull_ff_only(&repo_path)?;
        Ok(GitPullResult {
            pulled: true,
            had_conflicts: false,
        })
    })
    .await
}

#[tauri::command]
pub async fn git_push(repo_path: String) -> Result<GitPushResult, String> {
    if repo_path.is_empty() {
        return Err("Repository path is required".to_string());
    }
    blocking(move || operations::push(&repo_path).map_err(Into::into)).await
}

#[tauri::command]
pub async fn git_show_commit(repo_path: String, sha: String) -> Result<GitDiffResult, String> {
    if repo_path.is_empty() {
        return Err("Repository path is required".to_string());
    }
    if sha.is_empty() {
        return Err("Commit SHA is required".to_string());
    }
    blocking(move || operations::show_commit_diff(&repo_path, &sha).map_err(Into::into)).await
}

#[tauri::command]
pub async fn git_commit_file_diff(
    repo_path: String,
    sha: String,
    path: String,
    original_path: Option<String>,
) -> Result<GitDiffContentResult, String> {
    if repo_path.is_empty() {
        return Err("Repository path is required".to_string());
    }
    if sha.is_empty() {
        return Err("Commit SHA is required".to_string());
    }
    blocking(move || {
        operations::commit_file_diff(&repo_path, &sha, &path, original_path.as_deref())
            .map_err(Into::into)
    })
    .await
}

#[tauri::command]
pub async fn git_remote_url(
    repo_path: String,
    name: Option<String>,
) -> Result<Option<String>, String> {
    if repo_path.is_empty() {
        return Err("Repository path is required".to_string());
    }
    let remote = name.unwrap_or_else(|| "origin".to_string());
    blocking(move || operations::remote_url(&repo_path, &remote).map_err(Into::into)).await
}
