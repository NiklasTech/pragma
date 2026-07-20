use std::ffi::OsString;
use std::path::Path;

use crate::modules::git::errors::Result;
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
