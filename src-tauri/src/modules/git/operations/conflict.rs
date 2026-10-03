use std::ffi::OsString;

use crate::modules::git::errors::{GitError, Result};
use crate::modules::git::process::{
    ensure_git_available, ensure_success, git_show_text, read_text_file, run_git,
};
use crate::modules::git::types::{
    GitConflictSides, TextSource, DEFAULT_TIMEOUT_SECS, MAX_FILE_BYTES,
};
use crate::modules::git::utils::{
    authorized_repo_root, is_safe_pathspec, pathspec, resolve_within_repo,
};

pub fn conflict_sides(repo_root: &str, path: &str) -> Result<GitConflictSides> {
    let repo_root = authorized_repo_root(repo_root)?;
    ensure_git_available()?;
    if path.is_empty() {
        return Err(GitError::command("git conflict sides", "empty path"));
    }

    let resolved = resolve_within_repo(&repo_root, path)?;
    let rel = pathspec(&repo_root, &resolved);
    if !is_safe_pathspec(&rel) {
        return Err(GitError::command("git conflict sides", "invalid path"));
    }
    let root = repo_root.to_string_lossy();

    let base = git_show_text(&root, &format!(":1:{rel}"))?;
    let current = git_show_text(&root, &format!(":2:{rel}"))?;
    let incoming = git_show_text(&root, &format!(":3:{rel}"))?;
    let worktree = read_text_file(&resolved)?;
    let is_binary = matches!(base, TextSource::Binary)
        || matches!(current, TextSource::Binary)
        || matches!(incoming, TextSource::Binary)
        || matches!(worktree, TextSource::Binary);

    Ok(GitConflictSides {
        base_content: base.into_text(),
        current_content: current.into_text(),
        incoming_content: incoming.into_text(),
        worktree_content: worktree.into_text(),
        is_binary,
        truncated: false,
    })
}

pub fn resolve_conflict(repo_root: &str, path: &str, content: &str) -> Result<()> {
    let repo_root = authorized_repo_root(repo_root)?;
    ensure_git_available()?;
    if path.is_empty() {
        return Err(GitError::command("git conflict resolve", "empty path"));
    }
    if content.len() as u64 > MAX_FILE_BYTES {
        return Err(GitError::FileTooLarge {
            path: resolve_within_repo(&repo_root, path)?,
            size: content.len() as u64,
            max: MAX_FILE_BYTES,
        });
    }

    let resolved = resolve_within_repo(&repo_root, path)?;
    if let Ok(meta) = std::fs::symlink_metadata(&resolved) {
        if meta.file_type().is_symlink() {
            return Err(GitError::SymlinkRejected(resolved));
        }
    }
    let rel = pathspec(&repo_root, &resolved);
    if !is_safe_pathspec(&rel) {
        return Err(GitError::command("git conflict resolve", "invalid path"));
    }

    std::fs::write(&resolved, content.as_bytes())?;

    let args: Vec<OsString> = vec!["add".into(), "--".into(), rel.into()];
    let output = run_git(
        Some(&repo_root.to_string_lossy()),
        args,
        DEFAULT_TIMEOUT_SECS,
    )?;
    ensure_success(&output, "git add failed")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modules::git::operations::{conflicted_files, test_support::TestRepo};

    #[test]
    fn conflict_sides_returns_all_three_versions() {
        let repo = TestRepo::new();
        repo.create_merge_conflict();

        let sides = conflict_sides(&repo.root, "file.txt").unwrap();

        assert_eq!(sides.base_content, "base\n");
        assert_eq!(sides.current_content, "current\n");
        assert_eq!(sides.incoming_content, "incoming\n");
        assert!(sides.worktree_content.contains("<<<<<<<"));
        assert!(!sides.is_binary);
    }

    #[test]
    fn conflict_sides_rejects_empty_and_escaping_paths() {
        let repo = TestRepo::new();
        std::fs::write(repo.outside_path("outside.txt"), "secret\n").unwrap();

        assert!(conflict_sides(&repo.root, "").is_err());
        assert!(matches!(
            conflict_sides(&repo.root, "../outside.txt"),
            Err(GitError::PathOutsideWorkspace(_))
        ));
    }

    #[test]
    fn conflict_sides_rejects_pathspec_magic() {
        let repo = TestRepo::new();
        assert!(conflict_sides(&repo.root, ":(top)file.txt").is_err());
    }

    #[test]
    fn resolve_conflict_writes_and_stages_the_resolution() {
        let repo = TestRepo::new();
        repo.create_merge_conflict();

        resolve_conflict(&repo.root, "file.txt", "resolved\n").unwrap();

        assert_eq!(repo.read("file.txt"), "resolved\n");
        assert!(conflicted_files(&repo.root).unwrap().is_empty());
        assert_eq!(repo.git(&["show", ":file.txt"]), "resolved");
    }

    #[test]
    fn resolve_conflict_rejects_oversized_content() {
        let repo = TestRepo::new();
        repo.create_merge_conflict();
        let content = "a".repeat(MAX_FILE_BYTES as usize + 1);

        assert!(matches!(
            resolve_conflict(&repo.root, "file.txt", &content),
            Err(GitError::FileTooLarge { .. })
        ));
        assert!(repo.read("file.txt").contains("<<<<<<<"));
    }

    #[test]
    fn resolve_conflict_rejects_paths_outside_the_repository() {
        let repo = TestRepo::new();
        let outside = repo.outside_path("outside.txt");
        std::fs::write(&outside, "secret\n").unwrap();

        assert!(resolve_conflict(&repo.root, "../outside.txt", "x").is_err());
        assert_eq!(std::fs::read_to_string(outside).unwrap(), "secret\n");
    }

    #[cfg(unix)]
    #[test]
    fn resolve_conflict_refuses_symlinks_that_leave_the_repository() {
        let repo = TestRepo::new();
        let outside = repo.outside_path("outside.txt");
        std::fs::write(&outside, "secret\n").unwrap();
        std::os::unix::fs::symlink(&outside, repo.path("link.txt")).unwrap();

        assert!(resolve_conflict(&repo.root, "link.txt", "x").is_err());
        assert_eq!(std::fs::read_to_string(outside).unwrap(), "secret\n");
    }
}
