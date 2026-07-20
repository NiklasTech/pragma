use std::ffi::OsString;

use crate::modules::git::errors::{GitError, Result};
use crate::modules::git::process::{
    ensure_git_available, ensure_success, git_stdout_line_opt, git_stdout_lines, run_git,
};
use crate::modules::git::types::{GitPushResult, GitRemote, GitRemoteBranch, NETWORK_TIMEOUT_SECS};
use crate::modules::git::utils::authorized_repo_root;

pub fn list_remotes(repo_root: &str) -> Result<Vec<GitRemote>> {
    let repo_root = authorized_repo_root(repo_root)?;
    ensure_git_available()?;
    let lines = git_stdout_lines(&repo_root.to_string_lossy(), ["remote", "-v"])?;
    let mut remotes = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for line in lines {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 2 {
            let name = parts[0].to_string();
            let url = parts[1].to_string();
            if seen.insert(name.clone()) {
                remotes.push(GitRemote { name, url });
            }
        }
    }
    Ok(remotes)
}

pub fn list_remote_branches(
    repo_root: &str,
    remote_name: Option<&str>,
) -> Result<Vec<GitRemoteBranch>> {
    let repo_root = authorized_repo_root(repo_root)?;
    ensure_git_available()?;
    let remote = remote_name.unwrap_or("origin");
    let lines = git_stdout_lines(
        &repo_root.to_string_lossy(),
        ["ls-remote", "--heads", remote],
    )?;
    let mut branches = Vec::new();
    for line in lines {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 2 {
            let ref_name = parts[1];
            if let Some(branch) = ref_name.strip_prefix("refs/heads/") {
                branches.push(GitRemoteBranch {
                    name: branch.to_string(),
                    remote: remote.to_string(),
                });
            }
        }
    }
    Ok(branches)
}

pub fn fetch(repo_root: &str, remote_name: Option<&str>, branch_name: Option<&str>) -> Result<()> {
    let repo_root = authorized_repo_root(repo_root)?;
    ensure_git_available()?;
    let mut args: Vec<OsString> = vec!["fetch".into(), "--prune".into()];
    if let Some(remote) = remote_name {
        args.push(remote.into());
        if let Some(branch) = branch_name {
            args.push(branch.into());
        }
    }
    let output = run_git(
        Some(&repo_root.to_string_lossy()),
        args,
        NETWORK_TIMEOUT_SECS,
    )?;
    ensure_success(&output, "git fetch failed")
}

pub fn pull_ff_only(repo_root: &str) -> Result<()> {
    let repo_root = authorized_repo_root(repo_root)?;
    ensure_git_available()?;
    let output = run_git(
        Some(&repo_root.to_string_lossy()),
        ["pull", "--ff-only"],
        NETWORK_TIMEOUT_SECS,
    )?;
    ensure_success(&output, "git pull --ff-only failed")
}

pub fn push(repo_root: &str) -> Result<GitPushResult> {
    let repo_root = authorized_repo_root(repo_root)?;
    ensure_git_available()?;

    let upstream = git_stdout_line_opt(
        &repo_root.to_string_lossy(),
        ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"],
    )?;

    if upstream.is_some() {
        let output = run_git(
            Some(&repo_root.to_string_lossy()),
            ["push"],
            NETWORK_TIMEOUT_SECS,
        )?;
        ensure_success(&output, "git push failed")?;
    } else {
        let branch = git_stdout_line_opt(
            &repo_root.to_string_lossy(),
            ["rev-parse", "--abbrev-ref", "HEAD"],
        )?
        .ok_or(GitError::CommandFailed {
            context: "failed to resolve current branch",
            detail: String::new(),
        })?;

        if branch == "HEAD" {
            return Err(GitError::CommandFailed {
                context: "cannot push detached HEAD",
                detail: String::new(),
            });
        }

        let output = run_git(
            Some(&repo_root.to_string_lossy()),
            ["push", "-u", "origin", &branch],
            NETWORK_TIMEOUT_SECS,
        )?;
        ensure_success(&output, "git push failed")?;
    }

    Ok(GitPushResult { pushed: true })
}

pub fn remote_url(repo_root: &str, name: &str) -> Result<Option<String>> {
    let repo_root = authorized_repo_root(repo_root)?;
    ensure_git_available()?;
    if name.is_empty() || name.len() > 64 || !name.chars().all(is_remote_name_char) {
        return Ok(None);
    }
    git_stdout_line_opt(
        &repo_root.to_string_lossy(),
        ["config", "--get", &format!("remote.{name}.url")],
    )
}

fn is_remote_name_char(c: char) -> bool {
    c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.'
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn is_remote_name_char_allows_word_and_punct() {
        for c in "abcXYZ012-_.".chars() {
            assert!(is_remote_name_char(c));
        }
        for c in " /:\\?\"'".chars() {
            assert!(!is_remote_name_char(c));
        }
    }
}
