use std::ffi::OsString;

use crate::modules::git::errors::{GitError, Result};
use crate::modules::git::process::{ensure_git_available, ensure_success, git_show_text, run_git};
use crate::modules::git::types::{
    GitCommitFileChange, GitDiffContentResult, TextSource, DEFAULT_TIMEOUT_SECS,
};
use crate::modules::git::utils::{authorized_repo_root, pathspec, resolve_within_repo};

use super::commit::{apply_numstat, parse_diff_tree_name_status};
use super::revision::resolve_commit;

/// Files that differ between two branches, tags or commits.
pub fn compare_files(repo_root: &str, base: &str, head: &str) -> Result<Vec<GitCommitFileChange>> {
    let repo_root = authorized_repo_root(repo_root)?;
    ensure_git_available()?;
    let root = repo_root.to_string_lossy();
    let base_sha = resolve_commit(&root, base)?;
    let head_sha = resolve_commit(&root, head)?;

    let diff_tree = |format: &str| {
        let output = run_git(
            Some(&root),
            [
                "diff-tree",
                "-r",
                "-z",
                "-M",
                format,
                base_sha.as_str(),
                head_sha.as_str(),
            ],
            DEFAULT_TIMEOUT_SECS,
        )?;
        ensure_success(&output, "git diff-tree failed")?;
        Ok::<_, GitError>(output.stdout)
    };

    let mut files = parse_diff_tree_name_status(&diff_tree("--name-status")?);
    apply_numstat(&mut files, &diff_tree("--numstat")?);
    Ok(files)
}

/// Both sides of one file between `base` and `head`, plus the patch as a fallback.
pub fn compare_file_diff(
    repo_root: &str,
    base: &str,
    head: &str,
    path: &str,
    original_path: Option<&str>,
) -> Result<GitDiffContentResult> {
    let repo_root = authorized_repo_root(repo_root)?;
    ensure_git_available()?;
    let root = repo_root.to_string_lossy();
    let base_sha = resolve_commit(&root, base)?;
    let head_sha = resolve_commit(&root, head)?;
    let rel = pathspec(&repo_root, &resolve_within_repo(&repo_root, path)?);
    let original_rel = match original_path {
        Some(orig) if !orig.is_empty() => {
            pathspec(&repo_root, &resolve_within_repo(&repo_root, orig)?)
        }
        _ => rel.clone(),
    };

    let original = git_show_text(&root, &format!("{base_sha}:{original_rel}"))?;
    let modified = git_show_text(&root, &format!("{head_sha}:{rel}"))?;

    let mut args: Vec<OsString> = vec![
        "diff".into(),
        "--no-color".into(),
        "--no-ext-diff".into(),
        "-M".into(),
        base_sha.into(),
        head_sha.into(),
        "--".into(),
        rel.clone().into(),
    ];
    if original_rel != rel {
        args.push(original_rel.into());
    }
    let patch = run_git(Some(&root), args, DEFAULT_TIMEOUT_SECS)?;
    ensure_success(&patch, "git diff failed")?;

    let is_binary =
        matches!(original, TextSource::Binary) || matches!(modified, TextSource::Binary);
    Ok(GitDiffContentResult {
        original_content: original.into_text(),
        modified_content: modified.into_text(),
        is_binary,
        fallback_patch: String::from_utf8_lossy(&patch.stdout).into_owned(),
        truncated: patch.truncated,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modules::git::operations::test_support::TestRepo;

    fn feature_branch(repo: &TestRepo) {
        repo.git(&["checkout", "-q", "-b", "feature"]);
        repo.write("file.txt", "changed\n");
        repo.write("added.txt", "one\ntwo\n");
        repo.commit_all("feature");
        repo.git(&["checkout", "-q", "main"]);
    }

    #[test]
    fn compare_lists_changed_files_with_stats() {
        let repo = TestRepo::new();
        feature_branch(&repo);

        let mut files = compare_files(&repo.root, "main", "feature").unwrap();
        files.sort_by(|a, b| a.path.cmp(&b.path));

        assert_eq!(files.len(), 2);
        assert_eq!(files[0].path, "added.txt");
        assert_eq!(files[0].status, "A");
        assert_eq!(files[0].added, 2);
        assert_eq!(files[1].path, "file.txt");
        assert_eq!(files[1].status, "M");
    }

    #[test]
    fn compare_file_diff_returns_both_sides() {
        let repo = TestRepo::new();
        feature_branch(&repo);

        let diff = compare_file_diff(&repo.root, "main", "feature", "file.txt", None).unwrap();

        assert_eq!(diff.original_content, "base\n");
        assert_eq!(diff.modified_content, "changed\n");
        assert!(diff.fallback_patch.contains("+changed"));
    }

    #[test]
    fn compare_rejects_unknown_revisions_and_outside_paths() {
        let repo = TestRepo::new();
        std::fs::write(repo.outside_path("outside.txt"), "x\n").unwrap();
        assert!(compare_files(&repo.root, "main", "missing").is_err());
        assert!(compare_files(&repo.root, "--output=x", "main").is_err());
        assert!(compare_file_diff(&repo.root, "main", "main", "../outside.txt", None).is_err());
    }
}
