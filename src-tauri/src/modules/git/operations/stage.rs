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
