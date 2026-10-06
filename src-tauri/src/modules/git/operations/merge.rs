use std::ffi::OsString;

use crate::modules::git::errors::{GitError, Result};
use crate::modules::git::operations::conflicted_files;
use crate::modules::git::process::{ensure_git_available, ensure_success, run_git};
use crate::modules::git::types::{GitMergeResult, DEFAULT_TIMEOUT_SECS, MAX_TIMEOUT_SECS};
use crate::modules::git::utils::authorized_repo_root;

const MAX_BRANCH_CHARS: usize = 255;

fn is_safe_branch_name(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= MAX_BRANCH_CHARS
        && !name.starts_with('-')
        && !name.contains("..")
        && !name
            .chars()
            .any(|c| c.is_whitespace() || c.is_control() || "~^:?*[\\@{".contains(c))
}

fn ensure_local_branch(root: &str, branch: &str) -> Result<()> {
    if !is_safe_branch_name(branch) {
        return Err(GitError::command("invalid branch", branch.to_string()));
    }
    let reference = format!("refs/heads/{branch}");
    let output = run_git(
        Some(root),
        ["show-ref", "--verify", "--quiet", reference.as_str()],
        DEFAULT_TIMEOUT_SECS,
    )?;
    if output.timed_out {
        return Err(GitError::TimedOut("git show-ref"));
    }
    if output.exit_code != Some(0) {
        return Err(GitError::command("branch not found", branch.to_string()));
    }
    Ok(())
}

/// Tracked changes only: untracked files never block a merge or rebase.
fn ensure_clean(root: &str, context: &'static str) -> Result<()> {
    let output = run_git(
        Some(root),
        ["status", "--porcelain", "--untracked-files=no"],
        DEFAULT_TIMEOUT_SECS,
    )?;
    ensure_success(&output, "git status failed")?;
    if !String::from_utf8_lossy(&output.stdout).trim().is_empty() {
        return Err(GitError::command(
            context,
            "commit or stash the uncommitted changes first",
        ));
    }
    Ok(())
}

/// Merges `branch` into the current branch. Conflicts are left in place for the conflict editor.
pub fn merge_branch(repo_root: &str, branch: &str, no_ff: bool) -> Result<GitMergeResult> {
    let repo_root = authorized_repo_root(repo_root)?;
    ensure_git_available()?;
    let root = repo_root.to_string_lossy();
    ensure_local_branch(&root, branch)?;
    ensure_clean(&root, "cannot merge")?;

    let args: Vec<OsString> = vec![
        "merge".into(),
        "--no-edit".into(),
        if no_ff { "--no-ff" } else { "--ff" }.into(),
        branch.into(),
    ];
    let output = run_git(Some(&root), args, MAX_TIMEOUT_SECS)?;
    if output.timed_out {
        return Err(GitError::TimedOut("git merge"));
    }
    if output.exit_code == Some(0) {
        return Ok(GitMergeResult {
            completed: true,
            conflicts: Vec::new(),
        });
    }
    let conflicts = conflicted_files(&root)?;
    if conflicts.is_empty() {
        ensure_success(&output, "git merge failed")?;
    }
    Ok(GitMergeResult {
        completed: false,
        conflicts,
    })
}

/// Rebases the current branch onto `onto`. On conflicts the rebase is aborted and the
/// conflicting paths are returned, so the branch is never left half rebased.
pub fn rebase_onto(repo_root: &str, onto: &str) -> Result<GitMergeResult> {
    let repo_root = authorized_repo_root(repo_root)?;
    ensure_git_available()?;
    let root = repo_root.to_string_lossy();
    ensure_local_branch(&root, onto)?;
    ensure_clean(&root, "cannot rebase")?;

    let output = run_git(Some(&root), ["rebase", onto], MAX_TIMEOUT_SECS)?;
    if output.timed_out {
        return Err(GitError::TimedOut("git rebase"));
    }
    if output.exit_code == Some(0) {
        return Ok(GitMergeResult {
            completed: true,
            conflicts: Vec::new(),
        });
    }
    let conflicts = conflicted_files(&root)?;
    let abort = run_git(Some(&root), ["rebase", "--abort"], DEFAULT_TIMEOUT_SECS)?;
    if conflicts.is_empty() {
        ensure_success(&output, "git rebase failed")?;
    }
    ensure_success(&abort, "git rebase --abort failed")?;
    Ok(GitMergeResult {
        completed: false,
        conflicts,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modules::git::operations::test_support::TestRepo;

    #[test]
    fn merge_fast_forwards_by_default() {
        let repo = TestRepo::new();
        repo.git(&["checkout", "-q", "-b", "feature"]);
        repo.write("feature.txt", "x\n");
        repo.commit_all("feature");
        repo.git(&["checkout", "-q", "main"]);

        let result = merge_branch(&repo.root, "feature", false).unwrap();

        assert!(result.completed);
        assert_eq!(
            repo.git(&["rev-parse", "main"]),
            repo.git(&["rev-parse", "feature"])
        );
    }

    #[test]
    fn merge_with_no_ff_creates_a_merge_commit() {
        let repo = TestRepo::new();
        repo.git(&["checkout", "-q", "-b", "feature"]);
        repo.write("feature.txt", "x\n");
        repo.commit_all("feature");
        repo.git(&["checkout", "-q", "main"]);

        let result = merge_branch(&repo.root, "feature", true).unwrap();

        assert!(result.completed);
        assert_eq!(repo.git(&["rev-list", "--count", "--merges", "main"]), "1");
    }

    #[test]
    fn merge_conflicts_stay_for_the_conflict_editor() {
        let repo = TestRepo::new();
        repo.git(&["checkout", "-q", "-b", "feature"]);
        repo.write("file.txt", "incoming\n");
        repo.commit_all("feature change");
        repo.git(&["checkout", "-q", "main"]);
        repo.write("file.txt", "current\n");
        repo.commit_all("main change");

        let result = merge_branch(&repo.root, "feature", false).unwrap();

        assert!(!result.completed);
        assert_eq!(result.conflicts, vec!["file.txt".to_string()]);
        assert!(repo.read("file.txt").contains("<<<<<<<"));
    }

    #[test]
    fn merge_refuses_uncommitted_changes_and_bad_branches() {
        let repo = TestRepo::new();
        repo.git(&["branch", "feature"]);
        repo.write("file.txt", "dirty\n");

        assert!(merge_branch(&repo.root, "feature", false).is_err());
        assert!(merge_branch(&repo.root, "--abort", false).is_err());
        assert!(merge_branch(&repo.root, "missing", false).is_err());
    }

    #[test]
    fn rebase_replays_commits_onto_the_target() {
        let repo = TestRepo::new();
        repo.git(&["checkout", "-q", "-b", "feature"]);
        repo.write("feature.txt", "x\n");
        repo.commit_all("feature");
        repo.git(&["checkout", "-q", "main"]);
        repo.write("main.txt", "y\n");
        repo.commit_all("main");
        repo.git(&["checkout", "-q", "feature"]);

        let result = rebase_onto(&repo.root, "main").unwrap();

        assert!(result.completed);
        assert_eq!(
            repo.git(&["rev-parse", "feature~1"]),
            repo.git(&["rev-parse", "main"])
        );
    }

    #[test]
    fn rebase_conflicts_are_aborted() {
        let repo = TestRepo::new();
        repo.git(&["checkout", "-q", "-b", "feature"]);
        repo.write("file.txt", "incoming\n");
        repo.commit_all("feature change");
        let before = repo.git(&["rev-parse", "HEAD"]);
        repo.git(&["checkout", "-q", "main"]);
        repo.write("file.txt", "current\n");
        repo.commit_all("main change");
        repo.git(&["checkout", "-q", "feature"]);

        let result = rebase_onto(&repo.root, "main").unwrap();

        assert!(!result.completed);
        assert_eq!(result.conflicts, vec!["file.txt".to_string()]);
        assert_eq!(repo.git(&["rev-parse", "HEAD"]), before);
        assert_eq!(repo.read("file.txt"), "incoming\n");
    }
}
