use std::ffi::OsStr;

use serde::Serialize;

use crate::modules::git::errors::{GitError, Result};
use crate::modules::git::process::{
    ensure_git_available, ensure_success, git_stdout_line_opt, git_stdout_lines, run_git,
};
use crate::modules::git::types::{GitCommitResult, DEFAULT_TIMEOUT_SECS};
use crate::modules::git::utils::authorized_repo_root;

#[derive(Debug, Serialize)]
pub struct GitLastCommit {
    pub sha: String,
    pub message: String,
    pub is_pushed: bool,
    pub has_parent: bool,
}

async fn blocking<F, T>(f: F) -> std::result::Result<T, String>
where
    F: FnOnce() -> std::result::Result<T, String> + Send + 'static,
    T: Send + 'static,
{
    tauri::async_runtime::spawn_blocking(f)
        .await
        .map_err(|e| e.to_string())?
}

/// Returns `None` while the current branch has no commit yet.
pub fn last_commit(repo_root: &str) -> Result<Option<GitLastCommit>> {
    let repo_root = authorized_repo_root(repo_root)?;
    ensure_git_available()?;
    let root = repo_root.to_string_lossy();

    let Some(sha) = git_stdout_line_opt(&root, ["rev-parse", "--verify", "-q", "HEAD"])? else {
        return Ok(None);
    };

    let output = run_git(
        Some(&root),
        ["log", "-1", "--format=%B", "HEAD"],
        DEFAULT_TIMEOUT_SECS,
    )?;
    ensure_success(&output, "git log failed")?;
    let message = String::from_utf8_lossy(&output.stdout).trim().to_string();

    let has_parent =
        git_stdout_line_opt(&root, ["rev-parse", "--verify", "-q", "HEAD^"])?.is_some();
    let is_pushed = !git_stdout_lines(&root, ["branch", "-r", "--contains", "HEAD"])?.is_empty();

    Ok(Some(GitLastCommit {
        sha,
        message,
        is_pushed,
        has_parent,
    }))
}

pub fn amend_commit(repo_root: &str, message: &str) -> Result<GitCommitResult> {
    let repo_root = authorized_repo_root(repo_root)?;
    ensure_git_available()?;
    let trimmed = message.trim();
    if trimmed.is_empty() {
        return Err(GitError::EmptyCommitMessage);
    }
    let root = repo_root.to_string_lossy();

    let output = run_git(
        Some(&root),
        [
            OsStr::new("commit"),
            OsStr::new("--amend"),
            OsStr::new("-m"),
            OsStr::new(trimmed),
        ],
        DEFAULT_TIMEOUT_SECS,
    )?;
    ensure_success(&output, "git commit --amend failed")?;

    let lines = git_stdout_lines(&root, ["show", "-s", "--format=%H%n%s", "HEAD"])?;
    let commit_sha = lines
        .first()
        .cloned()
        .ok_or_else(|| GitError::command("failed to resolve commit sha", ""))?;
    let summary = lines.get(1).cloned().unwrap_or_default();
    Ok(GitCommitResult {
        commit_sha,
        summary,
    })
}

/// Soft reset to the parent, so the changes of the last commit stay staged.
pub fn undo_last_commit(repo_root: &str) -> Result<()> {
    let repo_root = authorized_repo_root(repo_root)?;
    ensure_git_available()?;
    let root = repo_root.to_string_lossy();

    if git_stdout_line_opt(&root, ["rev-parse", "--verify", "-q", "HEAD^"])?.is_none() {
        return Err(GitError::command(
            "git reset",
            "the first commit of a branch cannot be undone",
        ));
    }
    let output = run_git(
        Some(&root),
        ["reset", "--soft", "HEAD~1"],
        DEFAULT_TIMEOUT_SECS,
    )?;
    ensure_success(&output, "git reset --soft failed")
}

#[tauri::command]
pub async fn git_last_commit(
    repo_path: String,
) -> std::result::Result<Option<GitLastCommit>, String> {
    if repo_path.is_empty() {
        return Err("Repository path is required".to_string());
    }
    blocking(move || last_commit(&repo_path).map_err(Into::into)).await
}

#[tauri::command]
pub async fn git_amend_commit(
    repo_path: String,
    message: String,
) -> std::result::Result<GitCommitResult, String> {
    if repo_path.is_empty() {
        return Err("Repository path is required".to_string());
    }
    if message.trim().is_empty() {
        return Err("Commit message is required".to_string());
    }
    blocking(move || amend_commit(&repo_path, &message).map_err(Into::into)).await
}

#[tauri::command]
pub async fn git_undo_last_commit(repo_path: String) -> std::result::Result<(), String> {
    if repo_path.is_empty() {
        return Err("Repository path is required".to_string());
    }
    blocking(move || undo_last_commit(&repo_path).map_err(Into::into)).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modules::git::operations::test_support::TestRepo;

    #[test]
    fn last_commit_reads_full_message_and_parent() {
        let repo = TestRepo::new();
        let first = last_commit(&repo.root)
            .expect("last commit")
            .expect("commit");
        assert_eq!(first.message, "init");
        assert!(!first.has_parent);
        assert!(!first.is_pushed);

        repo.write("file.txt", "next\n");
        repo.git(&["add", "-A"]);
        repo.git(&["commit", "-q", "-m", "feat: next", "-m", "Body line"]);
        let second = last_commit(&repo.root)
            .expect("last commit")
            .expect("commit");
        assert_eq!(second.message, "feat: next\n\nBody line");
        assert!(second.has_parent);
    }

    #[test]
    fn last_commit_is_none_without_commits() {
        let repo = TestRepo::new();
        repo.git(&["checkout", "-q", "--orphan", "empty"]);
        assert!(last_commit(&repo.root).expect("last commit").is_none());
    }

    #[test]
    fn last_commit_detects_pushed_head() {
        let repo = TestRepo::new();
        let head = repo.git(&["rev-parse", "HEAD"]);
        repo.git(&["update-ref", "refs/remotes/origin/main", &head]);
        let commit = last_commit(&repo.root)
            .expect("last commit")
            .expect("commit");
        assert!(commit.is_pushed);
    }

    #[test]
    fn amend_rewrites_message_and_includes_staged_changes() {
        let repo = TestRepo::new();
        repo.write("other.txt", "added\n");
        repo.git(&["add", "other.txt"]);
        let result = amend_commit(&repo.root, "  feat: amended  ").expect("amend");
        assert_eq!(result.summary, "feat: amended");
        assert_eq!(repo.git(&["rev-list", "--count", "HEAD"]), "1");
        assert!(repo
            .git(&["show", "--name-only", "--format=", "HEAD"])
            .contains("other.txt"));
    }

    #[test]
    fn amend_rejects_empty_message() {
        let repo = TestRepo::new();
        assert!(matches!(
            amend_commit(&repo.root, "   "),
            Err(GitError::EmptyCommitMessage)
        ));
    }

    #[test]
    fn undo_keeps_changes_staged() {
        let repo = TestRepo::new();
        repo.write("file.txt", "changed\n");
        repo.commit_all("second");
        undo_last_commit(&repo.root).expect("undo");
        assert_eq!(repo.git(&["log", "-1", "--format=%s"]), "init");
        assert_eq!(repo.git(&["diff", "--cached", "--name-only"]), "file.txt");
        assert_eq!(repo.read("file.txt"), "changed\n");
    }

    #[test]
    fn undo_rejects_root_commit() {
        let repo = TestRepo::new();
        assert!(undo_last_commit(&repo.root).is_err());
        assert_eq!(repo.git(&["log", "-1", "--format=%s"]), "init");
    }
}
