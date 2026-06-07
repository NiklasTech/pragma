pub mod graph;
pub mod status;

use git2::Error as GitError;
use serde::Serialize;

#[derive(Serialize)]
pub struct GitStatusEntry {
    pub path: String,
    pub status: String,
    pub status_code: String,
    pub is_staged: bool,
    pub is_unstaged: bool,
    pub original_path: Option<String>,
}

#[derive(Serialize)]
pub struct GitRepoInfo {
    pub repo_root: String,
    pub branch: String,
    pub upstream: Option<String>,
    pub is_detached: bool,
}

#[derive(Serialize)]
pub struct GitStatusSnapshot {
    pub repo: GitRepoInfo,
    pub changed_files: Vec<GitStatusEntry>,
    pub ahead: usize,
    pub behind: usize,
}

#[derive(Serialize)]
pub struct GitBranch {
    pub name: String,
    pub is_head: bool,
}

#[derive(Serialize)]
pub struct GitCommit {
    pub id: String,
    pub message: String,
    pub author: String,
    pub time: i64,
}

#[derive(Serialize)]
pub struct GitLogEntry {
    pub sha: String,
    pub short_sha: String,
    pub author: String,
    pub author_email: String,
    pub timestamp_secs: i64,
    pub parents: Vec<String>,
    pub subject: String,
    pub files_changed: usize,
    pub insertions: usize,
    pub deletions: usize,
}

#[derive(Serialize)]
pub struct GitCommitFileChange {
    pub path: String,
    pub original_path: Option<String>,
    pub status: String,
    pub status_label: String,
    pub added: usize,
    pub removed: usize,
    pub is_binary: bool,
}

pub fn map_git_error(err: GitError) -> String {
    match err.code() {
        git2::ErrorCode::NotFound => "Not a git repository".to_string(),
        _ => err.message().to_string(),
    }
}
