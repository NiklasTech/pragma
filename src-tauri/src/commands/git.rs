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
