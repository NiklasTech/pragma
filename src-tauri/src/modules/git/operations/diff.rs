use std::ffi::OsString;
use std::path::Path;

use crate::modules::git::errors::{GitError, Result};
use crate::modules::git::process::{
    ensure_git_available, ensure_success, git_show_text, read_text_file, run_git,
};
use crate::modules::git::types::{
    GitDiffContentResult, GitDiffResult, TextSource, DEFAULT_TIMEOUT_SECS,
};
use crate::modules::git::utils::{authorized_repo_root, pathspec, resolve_within_repo};

use super::pathspec_from_input;

pub fn diff(repo_root: &str, path: Option<&str>, staged: bool) -> Result<GitDiffResult> {
    let repo_root = authorized_repo_root(repo_root)?;
    ensure_git_available()?;
    diff_inner(&repo_root, path, staged)
}

fn diff_inner(repo_root: &Path, path: Option<&str>, staged: bool) -> Result<GitDiffResult> {
    let mut args: Vec<OsString> = vec!["diff".into(), "--no-ext-diff".into()];
    if staged {
        args.push("--cached".into());
    }
    let pathspec_opt = match path.filter(|p| !p.is_empty()) {
        Some(p) => Some(pathspec_from_input(repo_root, p)?),
        None => None,
    };
    if let Some(spec) = pathspec_opt.as_ref() {
        args.push("--".into());
        args.push(spec.clone().into());
    }
    let output = run_git(
        Some(&repo_root.to_string_lossy()),
        args,
        DEFAULT_TIMEOUT_SECS,
    )?;
    ensure_success(&output, "git diff failed")?;

    let diff_text = match String::from_utf8(output.stdout) {
        Ok(text) => text,
        Err(e) => String::from_utf8_lossy(&e.into_bytes()).into_owned(),
    };
    Ok(GitDiffResult {
        diff_text,
        truncated: output.truncated,
    })
}

pub fn diff_content(
    repo_root: &str,
    path: &str,
    staged: bool,
    original_path: Option<&str>,
) -> Result<GitDiffContentResult> {
    let repo_root = authorized_repo_root(repo_root)?;
    ensure_git_available()?;
    let worktree_path = resolve_within_repo(&repo_root, path)?;
    let rel_path = pathspec(&repo_root, &worktree_path);

    let original_rel = match original_path {
        Some(orig) if !orig.is_empty() => {
            let resolved = resolve_within_repo(&repo_root, orig)?;
            Some(pathspec(&repo_root, &resolved))
        }
        _ => None,
    };

    let original = if staged {
        let spec = original_rel.as_deref().unwrap_or(&rel_path);
        git_show_text(&repo_root.to_string_lossy(), &format!("HEAD:{spec}"))?
    } else {
        git_show_text(&repo_root.to_string_lossy(), &format!(":{rel_path}"))?
    };
    let modified = if staged {
        git_show_text(&repo_root.to_string_lossy(), &format!(":{rel_path}"))?
    } else {
        read_text_file(&worktree_path)?
    };
    let patch = diff_inner(&repo_root, Some(&rel_path), staged)?;
    let is_binary =
        matches!(original, TextSource::Binary) || matches!(modified, TextSource::Binary);

    Ok(GitDiffContentResult {
        original_content: original.into_text(),
        modified_content: modified.into_text(),
        is_binary,
        fallback_patch: patch.diff_text,
        truncated: patch.truncated,
    })
}

/// The staged content of `path`, or `None` when the file is not in the index or is binary.
pub fn index_content(repo_root: &str, path: &str) -> Result<Option<String>> {
    let repo_root = authorized_repo_root(repo_root)?;
    ensure_git_available()?;
    let rel_path = pathspec_from_input(&repo_root, path)?;
    let output = run_git(
        Some(&repo_root.to_string_lossy()),
        [
            OsString::from("show"),
            OsString::from("--no-textconv"),
            OsString::from(format!(":{rel_path}")),
        ],
        DEFAULT_TIMEOUT_SECS,
    )?;
    if output.timed_out {
        return Err(GitError::TimedOut("git show"));
    }
    if output.exit_code != Some(0) || output.truncated || output.stdout.contains(&0) {
        return Ok(None);
    }
    Ok(Some(String::from_utf8_lossy(&output.stdout).into_owned()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modules::git::errors::GitError;
    use crate::modules::git::operations::test_support::TestRepo;

    #[test]
    fn diff_shows_unstaged_changes_only() {
        let repo = TestRepo::new();
        repo.write("file.txt", "changed\n");

        let unstaged = diff(&repo.root, None, false).unwrap();
        let staged = diff(&repo.root, None, true).unwrap();

        assert!(unstaged.diff_text.contains("+changed"));
        assert!(!unstaged.truncated);
        assert!(staged.diff_text.is_empty());
    }

    #[test]
    fn diff_with_staged_shows_the_index() {
        let repo = TestRepo::new();
        repo.write("file.txt", "changed\n");
        repo.git(&["add", "file.txt"]);

        assert!(diff(&repo.root, None, true)
            .unwrap()
            .diff_text
            .contains("+changed"));
        assert!(diff(&repo.root, None, false).unwrap().diff_text.is_empty());
    }

    #[test]
    fn diff_limits_output_to_the_given_path() {
        let repo = TestRepo::new();
        repo.write("other.txt", "other\n");
        repo.commit_all("add other");
        repo.write("file.txt", "changed\n");
        repo.write("other.txt", "other changed\n");

        let result = diff(&repo.root, Some("other.txt"), false).unwrap();

        assert!(result.diff_text.contains("other.txt"));
        assert!(!result.diff_text.contains("file.txt"));
    }

    #[test]
    fn diff_rejects_paths_outside_the_repository() {
        let repo = TestRepo::new();
        std::fs::write(repo.outside_path("outside.txt"), "secret\n").unwrap();

        assert!(matches!(
            diff(&repo.root, Some("../outside.txt"), false),
            Err(GitError::PathOutsideWorkspace(_))
        ));
    }

    #[test]
    fn index_content_returns_the_staged_text() {
        let repo = TestRepo::new();
        repo.write("file.txt", "staged\n");
        repo.git(&["add", "file.txt"]);
        repo.write("file.txt", "unstaged\n");

        assert_eq!(
            index_content(&repo.root, "file.txt").unwrap().as_deref(),
            Some("staged\n")
        );
    }

    #[test]
    fn index_content_is_none_for_untracked_files() {
        let repo = TestRepo::new();
        repo.write("new.txt", "new\n");

        assert_eq!(index_content(&repo.root, "new.txt").unwrap(), None);
    }

    #[test]
    fn diff_content_compares_index_with_worktree() {
        let repo = TestRepo::new();
        repo.write("file.txt", "changed\n");

        let result = diff_content(&repo.root, "file.txt", false, None).unwrap();

        assert_eq!(result.original_content, "base\n");
        assert_eq!(result.modified_content, "changed\n");
        assert!(!result.is_binary);
        assert!(result.fallback_patch.contains("+changed"));
    }

    #[test]
    fn diff_content_compares_head_with_index_when_staged() {
        let repo = TestRepo::new();
        repo.write("file.txt", "staged\n");
        repo.git(&["add", "file.txt"]);
        repo.write("file.txt", "unstaged\n");

        let result = diff_content(&repo.root, "file.txt", true, None).unwrap();

        assert_eq!(result.original_content, "base\n");
        assert_eq!(result.modified_content, "staged\n");
    }

    #[test]
    fn diff_content_reads_the_original_path_of_a_staged_rename() {
        let repo = TestRepo::new();
        repo.git(&["mv", "file.txt", "renamed.txt"]);

        let result = diff_content(&repo.root, "renamed.txt", true, Some("file.txt")).unwrap();

        assert_eq!(result.original_content, "base\n");
        assert_eq!(result.modified_content, "base\n");
    }

    #[test]
    fn diff_content_treats_new_files_as_empty_original() {
        let repo = TestRepo::new();
        repo.write("new.txt", "new\n");

        let result = diff_content(&repo.root, "new.txt", false, None).unwrap();

        assert_eq!(result.original_content, "");
        assert_eq!(result.modified_content, "new\n");
    }

    #[test]
    fn diff_content_flags_binary_files() {
        let repo = TestRepo::new();
        std::fs::write(repo.path("image.bin"), [0u8, 1, 2, 0]).unwrap();
        repo.commit_all("add binary");
        std::fs::write(repo.path("image.bin"), [0u8, 3, 4, 0]).unwrap();

        let result = diff_content(&repo.root, "image.bin", false, None).unwrap();

        assert!(result.is_binary);
    }
}
