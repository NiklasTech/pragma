use std::ffi::OsStr;

use crate::modules::git::errors::{GitError, Result};
use crate::modules::git::process::{
    ensure_git_available, ensure_success, git_stdout_line_opt, git_stdout_lines, run_git,
};
use crate::modules::git::types::{SmartCheckoutResult, StashEntry, DEFAULT_TIMEOUT_SECS};
use crate::modules::git::utils::authorized_repo_root;

use super::{checkout_branch, has_uncommitted_changes};

pub fn stash_push(repo_root: &str, message: &str) -> Result<String> {
    let repo_root = authorized_repo_root(repo_root)?;
    ensure_git_available()?;

    let trimmed = message.trim();
    let output = run_git(
        Some(&repo_root.to_string_lossy()),
        [
            OsStr::new("stash"),
            OsStr::new("push"),
            OsStr::new("-m"),
            OsStr::new(trimmed),
        ],
        DEFAULT_TIMEOUT_SECS,
    )?;
    ensure_success(&output, "git stash push failed")?;

    let stash_ref = git_stdout_line_opt(
        &repo_root.to_string_lossy(),
        ["rev-parse", "-q", "--verify", "refs/stash"],
    )?
    .unwrap_or_else(|| "stash@{0}".into());

    Ok(stash_ref)
}

pub fn stash_pop(repo_root: &str, stash_ref: &str) -> Result<()> {
    let repo_root = authorized_repo_root(repo_root)?;
    ensure_git_available()?;
    if stash_ref.is_empty() {
        return Err(GitError::command("git stash pop", "empty stash ref"));
    }
    if !is_safe_stash_ref(stash_ref) {
        return Err(GitError::command("git stash pop", "invalid stash ref"));
    }

    let output = run_git(
        Some(&repo_root.to_string_lossy()),
        [
            OsStr::new("stash"),
            OsStr::new("pop"),
            OsStr::new(stash_ref),
        ],
        DEFAULT_TIMEOUT_SECS,
    )?;

    if output.exit_code == Some(0) {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr).to_ascii_lowercase();
    if stderr.contains("conflict") || stderr.contains("merge conflict") {
        return Err(GitError::command(
            "git stash pop",
            "conflicts detected while applying stash",
        ));
    }
    ensure_success(&output, "git stash pop failed")
}

pub fn stash_list(repo_root: &str) -> Result<Vec<StashEntry>> {
    let repo_root = authorized_repo_root(repo_root)?;
    ensure_git_available()?;

    let format = "%gd%x1f%h%x1f%s";
    let lines = git_stdout_lines(
        &repo_root.to_string_lossy(),
        ["stash", "list", &format!("--format={format}")],
    )?;

    let mut entries = Vec::new();
    for (idx, line) in lines.iter().enumerate() {
        let mut parts = line.splitn(3, '\x1f');
        let ref_name = parts.next().unwrap_or("").to_string();
        let _short_sha = parts.next().unwrap_or("");
        let message = parts.next().unwrap_or("").to_string();
        if ref_name.is_empty() {
            continue;
        }
        entries.push(StashEntry {
            index: idx as u32,
            message,
            ref_name,
        });
    }
    Ok(entries)
}

pub fn smart_checkout(repo_root: &str, branch_name: &str) -> Result<SmartCheckoutResult> {
    let repo_root = authorized_repo_root(repo_root)?;
    ensure_git_available()?;
    if branch_name.is_empty() {
        return Err(GitError::command("git checkout", "empty branch name"));
    }

    let has_changes = has_uncommitted_changes(&repo_root.to_string_lossy())?;
    let mut result = SmartCheckoutResult {
        stashed: false,
        stash_ref: None,
        checkout_ok: false,
        pop_ok: false,
        pop_conflict: false,
    };

    let stash_ref = if has_changes {
        let msg = format!("pragma-smart-checkout-{branch_name}");
        let stash_ref = stash_push(&repo_root.to_string_lossy(), &msg)?;
        result.stashed = true;
        result.stash_ref = Some(stash_ref.clone());
        stash_ref
    } else {
        String::new()
    };

    match checkout_branch(&repo_root.to_string_lossy(), branch_name) {
        Ok(()) => result.checkout_ok = true,
        Err(e) => {
            if result.stashed {
                let _ = stash_pop(&repo_root.to_string_lossy(), &stash_ref);
            }
            return Err(e);
        }
    }

    if result.stashed {
        match stash_pop(&repo_root.to_string_lossy(), &stash_ref) {
            Ok(()) => result.pop_ok = true,
            Err(GitError::CommandFailed {
                context: "git stash pop",
                detail,
            }) if detail.contains("conflicts") => {
                result.pop_ok = false;
                result.pop_conflict = true;
            }
            Err(e) => return Err(e),
        }
    }

    Ok(result)
}

fn is_safe_stash_ref(stash_ref: &str) -> bool {
    !stash_ref.is_empty()
        && stash_ref.len() <= 64
        && stash_ref
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '{' || c == '}' || c == '@' || c == '_')
}
