use std::ffi::OsString;
use std::path::Path;

use crate::modules::git::errors::Result;
use crate::modules::git::process::{ensure_git_available, ensure_success, run_git};
use crate::modules::git::types::DEFAULT_TIMEOUT_SECS;
use crate::modules::git::utils::authorized_repo_root;

use super::pathspec_from_input;

pub fn stage(repo_root: &str, paths: &[String]) -> Result<()> {
    let repo_root = authorized_repo_root(repo_root)?;
    ensure_git_available()?;
    if paths.is_empty() {
        return Ok(());
    }
    let resolved = resolve_pathspecs(&repo_root, paths)?;
    let mut args: Vec<OsString> = vec!["add".into(), "--".into()];
    for p in &resolved {
        args.push(p.clone().into());
    }
    let output = run_git(
        Some(&repo_root.to_string_lossy()),
        args,
        DEFAULT_TIMEOUT_SECS,
    )?;
    ensure_success(&output, "git add failed")
}

pub fn unstage(repo_root: &str, paths: &[String]) -> Result<()> {
    let repo_root = authorized_repo_root(repo_root)?;
    ensure_git_available()?;
    if paths.is_empty() {
        return Ok(());
    }
    let resolved = resolve_pathspecs(&repo_root, paths)?;
    let mut args: Vec<OsString> = vec!["reset".into(), "HEAD".into(), "--".into()];
    for p in &resolved {
        args.push(p.clone().into());
    }
    let output = run_git(
        Some(&repo_root.to_string_lossy()),
        args,
        DEFAULT_TIMEOUT_SECS,
    )?;
    ensure_success(&output, "git reset failed")
}

pub fn discard(repo_root: &str, paths: &[String]) -> Result<()> {
    let repo_root = authorized_repo_root(repo_root)?;
    ensure_git_available()?;
    if paths.is_empty() {
        return Ok(());
    }
    // For tracked files: restore worktree
    // For untracked files: clean -f -d
    let resolved = resolve_pathspecs(&repo_root, paths)?;
    let mut restore_args: Vec<OsString> = vec!["restore".into(), "--worktree".into(), "--".into()];
    for p in &resolved {
        restore_args.push(p.clone().into());
    }
    let output = run_git(
        Some(&repo_root.to_string_lossy()),
        restore_args,
        DEFAULT_TIMEOUT_SECS,
    )?;
    // Ignore errors for untracked files
    let _ = ensure_success(&output, "git restore failed");

    // Clean untracked
    let mut clean_args: Vec<OsString> = vec!["clean".into(), "-f".into(), "-d".into(), "--".into()];
    for p in &resolved {
        clean_args.push(p.clone().into());
    }
    let output = run_git(
        Some(&repo_root.to_string_lossy()),
        clean_args,
        DEFAULT_TIMEOUT_SECS,
    )?;
    let _ = ensure_success(&output, "git clean failed");
    Ok(())
}

fn resolve_pathspecs(repo_root: &Path, paths: &[String]) -> Result<Vec<String>> {
    let mut out = Vec::with_capacity(paths.len());
    for p in paths {
        out.push(pathspec_from_input(repo_root, p)?);
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modules::git::errors::GitError;
    use crate::modules::git::operations::status;
    use crate::modules::git::operations::test_support::TestRepo;

    fn paths(items: &[&str]) -> Vec<String> {
        items.iter().map(|item| item.to_string()).collect()
    }

    fn is_staged(repo: &TestRepo, path: &str) -> bool {
        status(&repo.root)
            .unwrap()
            .changed_files
            .iter()
            .any(|f| f.path == path && f.is_staged)
    }

    #[test]
    fn stage_and_unstage_round_trip() {
        let repo = TestRepo::new();
        repo.write("new.txt", "new\n");

        stage(&repo.root, &paths(&["new.txt"])).unwrap();
        assert!(is_staged(&repo, "new.txt"));

        unstage(&repo.root, &paths(&["new.txt"])).unwrap();
        assert!(!is_staged(&repo, "new.txt"));
    }

    #[test]
    fn stage_accepts_dot_slash_prefixed_paths() {
        let repo = TestRepo::new();
        repo.write("dir/new.txt", "new\n");

        stage(&repo.root, &paths(&["./dir/new.txt"])).unwrap();

        assert!(is_staged(&repo, "dir/new.txt"));
    }

    #[test]
    fn empty_path_lists_are_a_no_op() {
        let repo = TestRepo::new();
        repo.write("file.txt", "changed\n");

        stage(&repo.root, &[]).unwrap();
        unstage(&repo.root, &[]).unwrap();
        discard(&repo.root, &[]).unwrap();

        assert_eq!(repo.read("file.txt"), "changed\n");
    }

    #[test]
    fn stage_rejects_paths_outside_the_repository() {
        let repo = TestRepo::new();
        std::fs::write(repo.outside_path("outside.txt"), "secret\n").unwrap();

        let result = stage(&repo.root, &paths(&["../outside.txt"]));

        assert!(matches!(result, Err(GitError::PathOutsideWorkspace(_))));
    }

    #[test]
    fn stage_fails_for_unknown_paths() {
        let repo = TestRepo::new();
        assert!(stage(&repo.root, &paths(&["missing.txt"])).is_err());
    }

    #[test]
    fn discard_restores_a_tracked_file() {
        let repo = TestRepo::new();
        repo.write("file.txt", "changed\n");

        discard(&repo.root, &paths(&["file.txt"])).unwrap();

        assert_eq!(repo.read("file.txt"), "base\n");
    }

    #[test]
    fn discard_removes_an_untracked_file() {
        let repo = TestRepo::new();
        repo.write("untracked.txt", "new\n");

        discard(&repo.root, &paths(&["untracked.txt"])).unwrap();

        assert!(!repo.path("untracked.txt").exists());
    }

    #[test]
    fn discard_keeps_staged_content() {
        let repo = TestRepo::new();
        repo.write("file.txt", "staged\n");
        repo.git(&["add", "file.txt"]);
        repo.write("file.txt", "unstaged\n");

        discard(&repo.root, &paths(&["file.txt"])).unwrap();

        assert_eq!(repo.read("file.txt"), "staged\n");
    }
}
