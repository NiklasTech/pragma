use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::modules::git::operations::{merge_branch, rebase_onto};
use crate::modules::git::process::run_git;
use crate::modules::git::types::{DEFAULT_TIMEOUT_SECS, NETWORK_TIMEOUT_SECS};
use crate::modules::git::worktree::{is_pragma_branch, worktree_dirty};

#[derive(Debug, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum SessionMergeStrategy {
    Merge,
    MergeCommit,
    Rebase,
}

#[derive(Debug, Serialize)]
pub struct SessionMergeResult {
    pub target: String,
    pub completed: bool,
    pub conflicts: Vec<String>,
    pub rebase_conflicts: bool,
}

async fn blocking<F, T>(f: F) -> Result<T, String>
where
    F: FnOnce() -> Result<T, String> + Send + 'static,
    T: Send + 'static,
{
    tauri::async_runtime::spawn_blocking(f)
        .await
        .map_err(|e| e.to_string())?
}

fn git_text(root: &str, args: &[&str], context: &str) -> Result<String, String> {
    let output = run_git(Some(root), args, DEFAULT_TIMEOUT_SECS)?;
    if output.timed_out {
        return Err(format!("{context} timed out"));
    }
    if output.exit_code != Some(0) {
        return Err(format!(
            "{context} failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

fn canonical(path: &str) -> Result<PathBuf, String> {
    Path::new(path)
        .canonicalize()
        .map_err(|e| format!("failed to resolve {path}: {e}"))
}

/// Confirms that `worktree_path` is a worktree of `repo_path` with `branch` checked out.
fn validate_session_worktree(
    repo_path: &str,
    worktree_path: &str,
    branch: &str,
) -> Result<String, String> {
    if !is_pragma_branch(branch) {
        return Err("Only pragma worktree branches can be finished".to_string());
    }
    let wanted = canonical(worktree_path)?;
    let listing = git_text(
        repo_path,
        &["worktree", "list", "--porcelain"],
        "git worktree list",
    )?;
    let expected_ref = format!("refs/heads/{branch}");
    let found = listing.split("\n\n").any(|block| {
        let mut path = None;
        let mut head_ref = None;
        for line in block.lines() {
            if let Some(rest) = line.strip_prefix("worktree ") {
                path = Some(rest);
            } else if let Some(rest) = line.strip_prefix("branch ") {
                head_ref = Some(rest);
            }
        }
        head_ref == Some(expected_ref.as_str())
            && path.and_then(|p| canonical(p).ok()).as_ref() == Some(&wanted)
    });
    if !found {
        return Err("The session worktree does not belong to this repository".to_string());
    }
    Ok(wanted.to_string_lossy().into_owned())
}

fn current_branch(repo_path: &str) -> Result<String, String> {
    let branch = git_text(
        repo_path,
        &["rev-parse", "--abbrev-ref", "HEAD"],
        "git rev-parse",
    )?
    .trim()
    .to_string();
    if branch.is_empty() || branch == "HEAD" {
        return Err("The checkout is on a detached HEAD; switch to a branch first".to_string());
    }
    Ok(branch)
}

pub(crate) fn finish_merge(
    repo_path: &str,
    worktree_path: &str,
    branch: &str,
    strategy: SessionMergeStrategy,
) -> Result<SessionMergeResult, String> {
    let worktree = validate_session_worktree(repo_path, worktree_path, branch)?;
    if worktree_dirty(&worktree)? {
        return Err(
            "The session has uncommitted changes. Commit them before finishing.".to_string(),
        );
    }
    let target = current_branch(repo_path)?;
    if target == branch {
        return Err("The checkout is already on the session branch".to_string());
    }

    if strategy == SessionMergeStrategy::Rebase {
        let rebased = rebase_onto(&worktree, &target)?;
        if !rebased.completed {
            return Ok(SessionMergeResult {
                target,
                completed: false,
                conflicts: rebased.conflicts,
                rebase_conflicts: true,
            });
        }
    }

    let merged = merge_branch(
        repo_path,
        branch,
        strategy == SessionMergeStrategy::MergeCommit,
    )?;
    Ok(SessionMergeResult {
        target,
        completed: merged.completed,
        conflicts: merged.conflicts,
        rebase_conflicts: false,
    })
}

pub(crate) fn push_branch(
    repo_path: &str,
    worktree_path: &str,
    branch: &str,
) -> Result<(), String> {
    let worktree = validate_session_worktree(repo_path, worktree_path, branch)?;
    let output = run_git(
        Some(&worktree),
        ["push", "-u", "origin", branch],
        NETWORK_TIMEOUT_SECS,
    )?;
    if output.timed_out {
        return Err("git push timed out".to_string());
    }
    if output.exit_code != Some(0) {
        return Err(format!(
            "git push failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    Ok(())
}

#[tauri::command]
pub async fn git_session_finish_merge(
    repo_path: String,
    worktree_path: String,
    branch: String,
    strategy: SessionMergeStrategy,
) -> Result<SessionMergeResult, String> {
    if repo_path.is_empty() || worktree_path.is_empty() {
        return Err("Repository and worktree paths are required".to_string());
    }
    blocking(move || finish_merge(&repo_path, &worktree_path, &branch, strategy)).await
}

#[tauri::command]
pub async fn git_session_push_branch(
    repo_path: String,
    worktree_path: String,
    branch: String,
) -> Result<(), String> {
    if repo_path.is_empty() || worktree_path.is_empty() {
        return Err("Repository and worktree paths are required".to_string());
    }
    blocking(move || push_branch(&repo_path, &worktree_path, &branch)).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modules::git::operations::test_support::TestRepo;
    use crate::modules::git::worktree::create_worktree;

    const SESSION: &str = "11111111-1111-1111-1111-111111111111";

    fn session_commit(path: &str, file: &str, content: &str) {
        std::fs::write(Path::new(path).join(file), content).expect("write");
        for args in [
            vec!["add", "-A"],
            vec!["commit", "-q", "-m", "session work"],
        ] {
            let output = std::process::Command::new("git")
                .args(&args)
                .current_dir(path)
                .output()
                .expect("spawn git");
            assert!(output.status.success(), "git {args:?} failed");
        }
    }

    #[test]
    fn merges_the_session_branch_into_the_checkout() {
        let repo = TestRepo::new();
        let app_data = tempfile::tempdir().expect("tempdir");
        let created = create_worktree(app_data.path(), &repo.root, SESSION, true).expect("create");
        session_commit(&created.path, "session.txt", "work\n");

        let result = finish_merge(
            &repo.root,
            &created.path,
            &created.branch,
            SessionMergeStrategy::Merge,
        )
        .expect("merge");

        assert_eq!(result.target, "main");
        assert!(result.completed);
        assert_eq!(repo.read("session.txt"), "work\n");
    }

    #[test]
    fn rebase_conflicts_leave_both_branches_untouched() {
        let repo = TestRepo::new();
        let app_data = tempfile::tempdir().expect("tempdir");
        let created = create_worktree(app_data.path(), &repo.root, SESSION, true).expect("create");
        session_commit(&created.path, "file.txt", "session\n");
        repo.write("file.txt", "checkout\n");
        repo.commit_all("checkout change");

        let result = finish_merge(
            &repo.root,
            &created.path,
            &created.branch,
            SessionMergeStrategy::Rebase,
        )
        .expect("finish");

        assert!(!result.completed);
        assert!(result.rebase_conflicts);
        assert_eq!(result.conflicts, vec!["file.txt".to_string()]);
        assert_eq!(repo.read("file.txt"), "checkout\n");
        assert_eq!(
            std::fs::read_to_string(Path::new(&created.path).join("file.txt")).expect("read"),
            "session\n"
        );
    }

    #[test]
    fn refuses_uncommitted_session_changes() {
        let repo = TestRepo::new();
        let app_data = tempfile::tempdir().expect("tempdir");
        let created = create_worktree(app_data.path(), &repo.root, SESSION, true).expect("create");
        std::fs::write(Path::new(&created.path).join("draft.txt"), "x").expect("write");

        let err = finish_merge(
            &repo.root,
            &created.path,
            &created.branch,
            SessionMergeStrategy::Merge,
        )
        .expect_err("dirty");
        assert!(err.contains("uncommitted"));
    }

    #[test]
    fn rejects_paths_and_branches_that_are_not_the_session_worktree() {
        let repo = TestRepo::new();
        let app_data = tempfile::tempdir().expect("tempdir");
        let created = create_worktree(app_data.path(), &repo.root, SESSION, true).expect("create");

        assert!(validate_session_worktree(&repo.root, &repo.root, &created.branch).is_err());
        assert!(validate_session_worktree(&repo.root, &created.path, "main").is_err());
        assert!(validate_session_worktree(&repo.root, &created.path, "pragma/22222222").is_err());
        assert!(validate_session_worktree(&repo.root, &created.path, &created.branch).is_ok());
    }
}
