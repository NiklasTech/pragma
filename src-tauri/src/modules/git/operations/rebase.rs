use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::modules::git::errors::{GitError, Result};
use crate::modules::git::operations::conflicted_files;
use crate::modules::git::process::{
    ensure_git_available, ensure_success, git_stdout_line_opt, run_git,
};
use crate::modules::git::types::{
    GitMergeResult, GitOutput, DEFAULT_TIMEOUT_SECS, MAX_TIMEOUT_SECS,
};
use crate::modules::git::utils::authorized_repo_root;

use super::merge::{ensure_clean, ensure_local_branch};

#[derive(Serialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum GitOperationKind {
    Merge,
    Rebase,
}

fn git_path(root: &str, name: &str) -> Result<Option<PathBuf>> {
    let path = git_stdout_line_opt(root, ["rev-parse", "--git-path", name])?;
    Ok(path.map(|p| Path::new(root).join(p)))
}

fn exists(root: &str, name: &str) -> Result<bool> {
    Ok(git_path(root, name)?.is_some_and(|p| p.exists()))
}

/// The merge or rebase that is waiting for conflicts to be resolved, if any.
pub fn operation_state(repo_root: &str) -> Result<Option<GitOperationKind>> {
    let repo_root = authorized_repo_root(repo_root)?;
    ensure_git_available()?;
    let root = repo_root.to_string_lossy();
    if exists(&root, "rebase-merge")? || exists(&root, "rebase-apply")? {
        return Ok(Some(GitOperationKind::Rebase));
    }
    if exists(&root, "MERGE_HEAD")? {
        return Ok(Some(GitOperationKind::Merge));
    }
    Ok(None)
}

fn stopped_with_conflicts(
    root: &str,
    output: &GitOutput,
    context: &'static str,
) -> Result<GitMergeResult> {
    if output.exit_code == Some(0) {
        return Ok(GitMergeResult {
            completed: true,
            conflicts: Vec::new(),
        });
    }
    let conflicts = conflicted_files(root)?;
    if conflicts.is_empty() {
        ensure_success(output, context)?;
    }
    Ok(GitMergeResult {
        completed: false,
        conflicts,
    })
}

/// Rebases the current branch onto `onto`. Unlike `rebase_onto`, conflicts stay in place
/// so they can be resolved in the conflict editor and the rebase continued.
pub fn rebase_branch(repo_root: &str, onto: &str) -> Result<GitMergeResult> {
    let repo_root = authorized_repo_root(repo_root)?;
    ensure_git_available()?;
    let root = repo_root.to_string_lossy();
    ensure_local_branch(&root, onto)?;
    ensure_clean(&root, "cannot rebase")?;

    let output = run_git(Some(&root), ["rebase", onto], MAX_TIMEOUT_SECS)?;
    if output.timed_out {
        return Err(GitError::TimedOut("git rebase"));
    }
    stopped_with_conflicts(&root, &output, "git rebase failed")
}

/// Finishes the pending merge or the next rebase step once every conflict is resolved.
pub fn continue_operation(repo_root: &str) -> Result<GitMergeResult> {
    let repo_root = authorized_repo_root(repo_root)?;
    ensure_git_available()?;
    let root = repo_root.to_string_lossy();
    let Some(kind) = operation_state(&root)? else {
        return Err(GitError::command(
            "nothing to continue",
            "no merge or rebase in progress",
        ));
    };
    if !conflicted_files(&root)?.is_empty() {
        return Err(GitError::command(
            "cannot continue",
            "resolve all conflicts first",
        ));
    }

    let output = match kind {
        GitOperationKind::Merge => {
            run_git(Some(&root), ["commit", "--no-edit"], DEFAULT_TIMEOUT_SECS)?
        }
        GitOperationKind::Rebase => run_git(
            Some(&root),
            ["-c", "core.editor=true", "rebase", "--continue"],
            MAX_TIMEOUT_SECS,
        )?,
    };
    if output.timed_out {
        return Err(GitError::TimedOut("git continue"));
    }
    stopped_with_conflicts(&root, &output, "git continue failed")
}

/// Aborts the pending merge or rebase and restores the branch.
pub fn abort_operation(repo_root: &str) -> Result<()> {
    let repo_root = authorized_repo_root(repo_root)?;
    ensure_git_available()?;
    let root = repo_root.to_string_lossy();
    let output = match operation_state(&root)? {
        Some(GitOperationKind::Merge) => {
            run_git(Some(&root), ["merge", "--abort"], DEFAULT_TIMEOUT_SECS)?
        }
        Some(GitOperationKind::Rebase) => {
            run_git(Some(&root), ["rebase", "--abort"], DEFAULT_TIMEOUT_SECS)?
        }
        None => {
            return Err(GitError::command(
                "nothing to abort",
                "no merge or rebase in progress",
            ))
        }
    };
    ensure_success(&output, "git abort failed")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modules::git::operations::merge_branch;
    use crate::modules::git::operations::test_support::TestRepo;

    fn diverge(repo: &TestRepo) {
        repo.git(&["checkout", "-q", "-b", "feature"]);
        repo.write("file.txt", "incoming\n");
        repo.commit_all("feature change");
        repo.git(&["checkout", "-q", "main"]);
        repo.write("file.txt", "current\n");
        repo.commit_all("main change");
    }

    #[test]
    fn no_operation_in_a_clean_repo() {
        let repo = TestRepo::new();
        assert_eq!(operation_state(&repo.root).unwrap(), None);
        assert!(continue_operation(&repo.root).is_err());
        assert!(abort_operation(&repo.root).is_err());
    }

    #[test]
    fn rebase_conflicts_stay_and_can_be_continued() {
        let repo = TestRepo::new();
        diverge(&repo);
        repo.git(&["checkout", "-q", "feature"]);

        let result = rebase_branch(&repo.root, "main").unwrap();

        assert!(!result.completed);
        assert_eq!(result.conflicts, vec!["file.txt".to_string()]);
        assert_eq!(
            operation_state(&repo.root).unwrap(),
            Some(GitOperationKind::Rebase)
        );
        assert!(continue_operation(&repo.root).is_err());

        repo.write("file.txt", "resolved\n");
        repo.git(&["add", "file.txt"]);
        let continued = continue_operation(&repo.root).unwrap();

        assert!(continued.completed);
        assert_eq!(operation_state(&repo.root).unwrap(), None);
        assert_eq!(
            repo.git(&["rev-parse", "feature~1"]),
            repo.git(&["rev-parse", "main"])
        );
    }

    #[test]
    fn abort_restores_the_branch_after_a_rebase_conflict() {
        let repo = TestRepo::new();
        diverge(&repo);
        repo.git(&["checkout", "-q", "feature"]);
        let before = repo.git(&["rev-parse", "HEAD"]);

        rebase_branch(&repo.root, "main").unwrap();
        abort_operation(&repo.root).unwrap();

        assert_eq!(operation_state(&repo.root).unwrap(), None);
        assert_eq!(repo.git(&["rev-parse", "HEAD"]), before);
        assert_eq!(repo.read("file.txt"), "incoming\n");
    }

    #[test]
    fn merge_conflicts_can_be_continued_into_a_merge_commit() {
        let repo = TestRepo::new();
        diverge(&repo);
        merge_branch(&repo.root, "feature", false).unwrap();
        assert_eq!(
            operation_state(&repo.root).unwrap(),
            Some(GitOperationKind::Merge)
        );

        repo.write("file.txt", "resolved\n");
        repo.git(&["add", "file.txt"]);
        let continued = continue_operation(&repo.root).unwrap();

        assert!(continued.completed);
        assert_eq!(operation_state(&repo.root).unwrap(), None);
        assert_eq!(repo.git(&["rev-list", "--count", "--merges", "main"]), "1");
    }

    #[test]
    fn abort_discards_a_conflicted_merge() {
        let repo = TestRepo::new();
        diverge(&repo);
        merge_branch(&repo.root, "feature", false).unwrap();

        abort_operation(&repo.root).unwrap();

        assert_eq!(operation_state(&repo.root).unwrap(), None);
        assert_eq!(repo.read("file.txt"), "current\n");
    }
}
