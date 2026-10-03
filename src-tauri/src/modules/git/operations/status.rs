use std::path::Path;

use crate::modules::git::errors::{GitError, Result};
use crate::modules::git::parser::parse_porcelain_v2;
use crate::modules::git::process::{
    ensure_git_available, ensure_success, git_stdout_line_opt, git_stdout_lines, run_git,
};
use crate::modules::git::types::{GitStatusSnapshot, DEFAULT_TIMEOUT_SECS};
use crate::modules::git::utils::{authorized_repo_root, canonical_dir};

pub fn resolve_repo(cwd: &str) -> Result<Option<crate::modules::git::types::GitRepoInfo>> {
    let cwd = canonical_dir(cwd)?;
    let Some(root_line) =
        git_stdout_line_opt(&cwd.to_string_lossy(), ["rev-parse", "--show-toplevel"])?
    else {
        return Ok(None);
    };
    let canonical_root = canonical_dir(&root_line)?;

    let head = match git_stdout_lines(
        &canonical_root.to_string_lossy(),
        ["rev-parse", "--abbrev-ref", "HEAD"],
    )?
    .into_iter()
    .next()
    {
        Some(h) => h,
        None => git_stdout_line_opt(
            &canonical_root.to_string_lossy(),
            ["symbolic-ref", "--short", "HEAD"],
        )?
        .ok_or(GitError::CommandFailed {
            context: "failed to resolve HEAD",
            detail: String::new(),
        })?,
    };

    let upstream = git_stdout_line_opt(
        &canonical_root.to_string_lossy(),
        ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"],
    )?;

    Ok(Some(crate::modules::git::types::GitRepoInfo {
        repo_root: canonical_root.to_string_lossy().into_owned(),
        branch: head.clone(),
        upstream,
        is_detached: head == "HEAD",
    }))
}

pub fn status(repo_root: &str) -> Result<GitStatusSnapshot> {
    let repo_root = authorized_repo_root(repo_root)?;
    ensure_git_available()?;
    status_inner(&repo_root)
}

pub fn conflicted_files(repo_root: &str) -> Result<Vec<String>> {
    let repo_root = authorized_repo_root(repo_root)?;
    ensure_git_available()?;
    let lines = git_stdout_lines(
        &repo_root.to_string_lossy(),
        ["diff", "--name-only", "--diff-filter=U"],
    )?;
    Ok(lines
        .into_iter()
        .map(|line| line.trim().to_string())
        .filter(|line| !line.is_empty())
        .collect())
}

fn status_inner(repo_root: &Path) -> Result<GitStatusSnapshot> {
    let output = run_git(
        Some(&repo_root.to_string_lossy()),
        [
            "status",
            "--porcelain=v2",
            "--branch",
            "-z",
            "--untracked-files=all",
        ],
        DEFAULT_TIMEOUT_SECS,
    )?;
    ensure_success(&output, "git status failed")?;

    let stdout = std::str::from_utf8(&output.stdout).unwrap_or("");
    let parsed = parse_porcelain_v2(stdout);

    Ok(GitStatusSnapshot {
        repo: crate::modules::git::types::GitRepoInfo {
            repo_root: repo_root.to_string_lossy().into_owned(),
            branch: parsed.branch.clone(),
            upstream: parsed.upstream.clone(),
            is_detached: parsed.is_detached,
        },
        changed_files: parsed.files,
        ahead: parsed.ahead,
        behind: parsed.behind,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modules::git::operations::test_support::TestRepo;

    #[test]
    fn resolve_repo_returns_none_outside_a_repository() {
        let dir = tempfile::tempdir().unwrap();
        assert!(resolve_repo(&dir.path().to_string_lossy())
            .unwrap()
            .is_none());
    }

    #[test]
    fn resolve_repo_rejects_missing_directory() {
        let dir = tempfile::tempdir().unwrap();
        let missing = dir.path().join("missing");
        assert!(matches!(
            resolve_repo(&missing.to_string_lossy()),
            Err(GitError::NotADirectory(_))
        ));
    }

    #[test]
    fn resolve_repo_reports_branch_from_a_subdirectory() {
        let repo = TestRepo::new();
        repo.write("nested/inner.txt", "inner\n");

        let info = resolve_repo(&repo.path("nested").to_string_lossy())
            .unwrap()
            .unwrap();

        let canonical_root = std::fs::canonicalize(&repo.root).unwrap();
        assert_eq!(info.repo_root, canonical_root.to_string_lossy());
        assert_eq!(info.branch, "main");
        assert_eq!(info.upstream, None);
        assert!(!info.is_detached);
    }

    #[test]
    fn resolve_repo_detects_detached_head() {
        let repo = TestRepo::new();
        repo.git(&["checkout", "-q", "--detach"]);

        let info = resolve_repo(&repo.root).unwrap().unwrap();

        assert!(info.is_detached);
    }

    #[test]
    fn status_lists_modified_staged_and_untracked_files() {
        let repo = TestRepo::new();
        repo.write("file.txt", "changed\n");
        repo.write("staged.txt", "staged\n");
        repo.git(&["add", "staged.txt"]);
        repo.write("untracked.txt", "new\n");

        let snapshot = status(&repo.root).unwrap();
        let entry = |path: &str| {
            snapshot
                .changed_files
                .iter()
                .find(|f| f.path == path)
                .unwrap_or_else(|| panic!("{path} missing from status"))
        };

        assert_eq!(snapshot.repo.branch, "main");
        assert_eq!(snapshot.changed_files.len(), 3);
        assert!(entry("file.txt").is_unstaged);
        assert!(!entry("file.txt").is_staged);
        assert!(entry("staged.txt").is_staged);
        assert_eq!(entry("untracked.txt").status_code, "?");
    }

    #[test]
    fn status_of_a_clean_repository_is_empty() {
        let repo = TestRepo::new();
        assert!(status(&repo.root).unwrap().changed_files.is_empty());
    }

    #[test]
    fn status_rejects_a_file_as_repository_root() {
        let repo = TestRepo::new();
        assert!(matches!(
            status(&repo.path("file.txt").to_string_lossy()),
            Err(GitError::NotADirectory(_))
        ));
    }

    #[test]
    fn conflicted_files_lists_unmerged_paths() {
        let repo = TestRepo::new();
        assert!(conflicted_files(&repo.root).unwrap().is_empty());

        repo.create_merge_conflict();

        assert_eq!(conflicted_files(&repo.root).unwrap(), vec!["file.txt"]);
    }
}
