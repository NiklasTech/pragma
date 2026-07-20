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
