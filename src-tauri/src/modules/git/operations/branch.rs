use crate::modules::git::errors::Result;
use crate::modules::git::process::{
    ensure_git_available, ensure_success, git_stdout_line_opt, git_stdout_lines, run_git,
};
use crate::modules::git::types::{GitBranch, DEFAULT_TIMEOUT_SECS};
use crate::modules::git::utils::authorized_repo_root;

pub fn get_branches(repo_root: &str) -> Result<Vec<GitBranch>> {
    let repo_root = authorized_repo_root(repo_root)?;
    ensure_git_available()?;

    let head = git_stdout_line_opt(
        &repo_root.to_string_lossy(),
        ["rev-parse", "--abbrev-ref", "HEAD"],
    )?;

    let lines = git_stdout_lines(
        &repo_root.to_string_lossy(),
        ["branch", "--format=%(refname:short)"],
    )?;

    let mut branches = Vec::new();
    for line in lines {
        if line.is_empty() {
            continue;
        }
        let is_head = head.as_ref().map(|h| h == &line).unwrap_or(false);
        branches.push(GitBranch {
            name: line,
            is_head,
        });
    }
    Ok(branches)
}

pub fn checkout_branch(repo_root: &str, branch_name: &str) -> Result<()> {
    let repo_root = authorized_repo_root(repo_root)?;
    ensure_git_available()?;
    let output = run_git(
        Some(&repo_root.to_string_lossy()),
        ["checkout", branch_name],
        DEFAULT_TIMEOUT_SECS,
    )?;
    ensure_success(&output, "git checkout failed")
}

pub fn create_branch(repo_root: &str, branch_name: &str, checkout: bool) -> Result<()> {
    let repo_root = authorized_repo_root(repo_root)?;
    ensure_git_available()?;
    let output = run_git(
        Some(&repo_root.to_string_lossy()),
        ["branch", branch_name],
        DEFAULT_TIMEOUT_SECS,
    )?;
    ensure_success(&output, "git branch failed")?;

    if checkout {
        checkout_branch(&repo_root.to_string_lossy(), branch_name)?;
    }
    Ok(())
}

pub fn delete_branch(repo_root: &str, branch_name: &str) -> Result<()> {
    let repo_root = authorized_repo_root(repo_root)?;
    ensure_git_available()?;
    let output = run_git(
        Some(&repo_root.to_string_lossy()),
        ["branch", "-D", branch_name],
        DEFAULT_TIMEOUT_SECS,
    )?;
    ensure_success(&output, "git branch -D failed")
}

pub fn has_uncommitted_changes(repo_root: &str) -> Result<bool> {
    let repo_root = authorized_repo_root(repo_root)?;
    ensure_git_available()?;
    let output = run_git(
        Some(&repo_root.to_string_lossy()),
        ["status", "--porcelain"],
        DEFAULT_TIMEOUT_SECS,
    )?;
    if output.exit_code != Some(0) {
        return Ok(false);
    }
    let stdout = std::str::from_utf8(&output.stdout).unwrap_or("");
    Ok(stdout.trim().lines().next().is_some())
}
