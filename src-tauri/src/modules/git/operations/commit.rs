use std::ffi::OsStr;
use std::ffi::OsString;

use crate::modules::git::errors::{GitError, Result};
use crate::modules::git::process::{
    ensure_git_available, ensure_success, git_show_text, git_stdout_line_opt, git_stdout_lines,
    run_git,
};
use crate::modules::git::types::{
    GitCommitDetails, GitCommitFileChange, GitCommitResult, GitDiffContentResult, GitDiffResult,
    GitOutput, TextSource, DEFAULT_TIMEOUT_SECS,
};
use crate::modules::git::utils::{
    authorized_repo_root, pathspec, resolve_within_repo, sha_is_safe,
};

use super::checkout_branch;

pub fn commit(
    repo_root: &str,
    message: &str,
    sign_off_text: Option<&str>,
) -> Result<GitCommitResult> {
    let repo_root = authorized_repo_root(repo_root)?;
    ensure_git_available()?;
    let trimmed = message.trim();
    if trimmed.is_empty() {
        return Err(GitError::EmptyCommitMessage);
    }

    let full_message = match sign_off_text {
        Some(text) if !text.trim().is_empty() => format!("{}\n\n{}", trimmed, text.trim()),
        _ => trimmed.to_string(),
    };

    let output = run_git(
        Some(&repo_root.to_string_lossy()),
        [
            OsStr::new("commit"),
            OsStr::new("-m"),
            OsStr::new(&full_message),
        ],
        DEFAULT_TIMEOUT_SECS,
    )?;
    if output.exit_code != Some(0) && nothing_to_commit(&output) {
        return Err(GitError::command("git commit", "nothing staged"));
    }
    ensure_success(&output, "git commit failed")?;

    let combined = git_stdout_lines(
        &repo_root.to_string_lossy(),
        ["show", "-s", "--format=%H%n%s", "HEAD"],
    )?;
    let sha = combined.first().cloned().ok_or(GitError::CommandFailed {
        context: "failed to resolve commit sha",
        detail: String::new(),
    })?;
    let summary = combined.get(1).cloned().unwrap_or_default();

    Ok(GitCommitResult {
        commit_sha: sha,
        summary,
    })
}

pub fn show_commit_diff(repo_root: &str, sha: &str) -> Result<GitDiffResult> {
    let repo_root = authorized_repo_root(repo_root)?;
    ensure_git_available()?;
    if !sha_is_safe(sha) {
        return Err(GitError::command("git show", "invalid commit identifier"));
    }
    let output = run_git(
        Some(&repo_root.to_string_lossy()),
        [
            OsStr::new("show"),
            OsStr::new("--no-color"),
            OsStr::new("--no-ext-diff"),
            OsStr::new("--patch-with-stat"),
            OsStr::new(sha),
            OsStr::new("--"),
        ],
        DEFAULT_TIMEOUT_SECS,
    )?;
    ensure_success(&output, "git show failed")?;
    let diff_text = match String::from_utf8(output.stdout) {
        Ok(text) => text,
        Err(e) => String::from_utf8_lossy(&e.into_bytes()).into_owned(),
    };
    Ok(GitDiffResult {
        diff_text,
        truncated: output.truncated,
    })
}

pub fn commit_files(repo_root: &str, sha: &str) -> Result<Vec<GitCommitFileChange>> {
    let repo_root = authorized_repo_root(repo_root)?;
    ensure_git_available()?;
    if !sha_is_safe(sha) {
        return Err(GitError::command("git diff-tree", "invalid commit sha"));
    }

    let output = run_git(
        Some(&repo_root.to_string_lossy()),
        [
            OsStr::new("diff-tree"),
            OsStr::new("--no-commit-id"),
            OsStr::new("-r"),
            OsStr::new("-z"),
            OsStr::new("--name-status"),
            OsStr::new("--numstat"),
            OsStr::new(sha),
        ],
        DEFAULT_TIMEOUT_SECS,
    )?;
    ensure_success(&output, "git diff-tree failed")?;

    let (name_status_bytes, numstat_bytes) = split_name_status_numstat(&output.stdout);
    let mut files = parse_diff_tree_name_status(name_status_bytes);
    apply_numstat(&mut files, numstat_bytes);
    Ok(files)
}

pub fn commit_file_diff(
    repo_root: &str,
    sha: &str,
    path: &str,
    original_path: Option<&str>,
) -> Result<GitDiffContentResult> {
    let repo_root = authorized_repo_root(repo_root)?;
    ensure_git_available()?;
    if !sha_is_safe(sha) {
        return Err(GitError::command("git show", "invalid commit sha"));
    }
    let resolved = resolve_within_repo(&repo_root, path)?;
    let rel = pathspec(&repo_root, &resolved);

    let original_rel = match original_path {
        Some(orig) if !orig.is_empty() => {
            let resolved_orig = resolve_within_repo(&repo_root, orig)?;
            pathspec(&repo_root, &resolved_orig)
        }
        _ => rel.clone(),
    };

    let parent = git_stdout_line_opt(
        &repo_root.to_string_lossy(),
        ["rev-parse", &format!("{sha}^")],
    )?;
    let original = match parent.as_deref() {
        Some(p) => git_show_text(&repo_root.to_string_lossy(), &format!("{p}:{original_rel}"))?,
        None => TextSource::Missing,
    };
    let modified = git_show_text(&repo_root.to_string_lossy(), &format!("{sha}:{rel}"))?;

    let mut diff_args: Vec<OsString> = vec![
        "show".into(),
        "--no-color".into(),
        "--no-ext-diff".into(),
        "--format=".into(),
        "-m".into(),
        "--first-parent".into(),
        sha.into(),
        "--".into(),
    ];
    diff_args.push(rel.clone().into());
    if original_rel != rel {
        diff_args.push(original_rel.clone().into());
    }
    let patch_output = run_git(
        Some(&repo_root.to_string_lossy()),
        diff_args,
        DEFAULT_TIMEOUT_SECS,
    )?;
    ensure_success(&patch_output, "git show <commit> -- <path> failed")?;
    let patch_text = match String::from_utf8(patch_output.stdout) {
        Ok(text) => text,
        Err(e) => String::from_utf8_lossy(&e.into_bytes()).into_owned(),
    };

    let is_binary =
        matches!(original, TextSource::Binary) || matches!(modified, TextSource::Binary);

    Ok(GitDiffContentResult {
        original_content: original.into_text(),
        modified_content: modified.into_text(),
        is_binary,
        fallback_patch: patch_text,
        truncated: patch_output.truncated,
    })
}

pub fn commit_details(repo_root: &str, sha: &str) -> Result<GitCommitDetails> {
    let repo_root = authorized_repo_root(repo_root)?;
    ensure_git_available()?;
    if !sha_is_safe(sha) {
        return Err(GitError::command("git show", "invalid commit sha"));
    }

    let format = "--format=%H%x1f%h%x1f%an%x1f%ae%x1f%at%x1f%P%x1f%s%x1f%b";
    let output = run_git(
        Some(&repo_root.to_string_lossy()),
        [
            OsStr::new("show"),
            OsStr::new("-s"),
            OsStr::new(format),
            OsStr::new(sha),
        ],
        DEFAULT_TIMEOUT_SECS,
    )?;
    ensure_success(&output, "git show failed")?;

    let text = String::from_utf8_lossy(&output.stdout);
    let mut parts = text.splitn(8, '\x1f');
    let sha = parts.next().unwrap_or("").trim().to_string();
    let short_sha = parts.next().unwrap_or("").trim().to_string();
    let author = parts.next().unwrap_or("").trim().to_string();
    let author_email = parts.next().unwrap_or("").trim().to_string();
    let timestamp_secs = parts
        .next()
        .unwrap_or("0")
        .trim()
        .parse::<i64>()
        .unwrap_or(0);
    let parents = parts
        .next()
        .unwrap_or("")
        .split_whitespace()
        .map(|s| s.to_string())
        .collect();
    let subject = parts.next().unwrap_or("").trim().to_string();
    let body = parts.next().unwrap_or("").trim().to_string();

    let files = commit_files(&repo_root.to_string_lossy(), sha.as_str())?;

    Ok(GitCommitDetails {
        sha,
        short_sha,
        subject,
        body,
        author,
        author_email,
        timestamp_secs,
        parents,
        files,
    })
}

pub fn checkout_commit(repo_root: &str, sha: &str) -> Result<()> {
    let repo_root = authorized_repo_root(repo_root)?;
    ensure_git_available()?;
    if !sha_is_safe(sha) {
        return Err(GitError::command("git checkout", "invalid commit sha"));
    }
    let output = run_git(
        Some(&repo_root.to_string_lossy()),
        [OsStr::new("checkout"), OsStr::new(sha)],
        DEFAULT_TIMEOUT_SECS,
    )?;
    ensure_success(&output, "git checkout failed")
}

pub fn create_branch_from_commit(
    repo_root: &str,
    branch_name: &str,
    sha: &str,
    checkout: bool,
) -> Result<()> {
    let repo_root = authorized_repo_root(repo_root)?;
    ensure_git_available()?;
    if !sha_is_safe(sha) {
        return Err(GitError::command("git branch", "invalid commit sha"));
    }
    let output = run_git(
        Some(&repo_root.to_string_lossy()),
        [
            OsStr::new("branch"),
            OsStr::new(branch_name),
            OsStr::new(sha),
        ],
        DEFAULT_TIMEOUT_SECS,
    )?;
    ensure_success(&output, "git branch failed")?;

    if checkout {
        checkout_branch(&repo_root.to_string_lossy(), branch_name)?;
    }
    Ok(())
}

pub fn cherry_pick_commit(repo_root: &str, sha: &str) -> Result<()> {
    let repo_root = authorized_repo_root(repo_root)?;
    ensure_git_available()?;
    if !sha_is_safe(sha) {
        return Err(GitError::command("git cherry-pick", "invalid commit sha"));
    }
    let output = run_git(
        Some(&repo_root.to_string_lossy()),
        [OsStr::new("cherry-pick"), OsStr::new(sha)],
        DEFAULT_TIMEOUT_SECS,
    )?;
    ensure_success(&output, "git cherry-pick failed")
}

pub fn revert_commit(repo_root: &str, sha: &str) -> Result<()> {
    let repo_root = authorized_repo_root(repo_root)?;
    ensure_git_available()?;
    if !sha_is_safe(sha) {
        return Err(GitError::command("git revert", "invalid commit sha"));
    }
    let output = run_git(
        Some(&repo_root.to_string_lossy()),
        [
            OsStr::new("revert"),
            OsStr::new("--no-edit"),
            OsStr::new(sha),
        ],
        DEFAULT_TIMEOUT_SECS,
    )?;
    ensure_success(&output, "git revert failed")
}

pub fn reset_to_commit(repo_root: &str, sha: &str, mode: &str) -> Result<()> {
    let repo_root = authorized_repo_root(repo_root)?;
    ensure_git_available()?;
    if !sha_is_safe(sha) {
        return Err(GitError::command("git reset", "invalid commit sha"));
    }
    if !matches!(mode, "soft" | "mixed" | "hard") {
        return Err(GitError::command("git reset", "invalid reset mode"));
    }
    let output = run_git(
        Some(&repo_root.to_string_lossy()),
        [
            OsStr::new("reset"),
            OsStr::new(&format!("--{mode}")),
            OsStr::new(sha),
        ],
        DEFAULT_TIMEOUT_SECS,
    )?;
    ensure_success(&output, "git reset failed")
}

fn nothing_to_commit(output: &GitOutput) -> bool {
    let stderr = String::from_utf8_lossy(&output.stderr).to_ascii_lowercase();
    let stdout = String::from_utf8_lossy(&output.stdout).to_ascii_lowercase();
    stderr.contains("nothing to commit") || stdout.contains("nothing to commit")
}

fn split_name_status_numstat(bytes: &[u8]) -> (&[u8], &[u8]) {
    let s = std::str::from_utf8(bytes).unwrap_or("");
    let tokens: Vec<(usize, &str)> = s
        .split('\0')
        .scan(0usize, |off, t| {
            let start = *off;
            *off += t.len() + 1;
            Some((start, t))
        })
        .collect();
    let mut split_at = bytes.len();
    for (idx, tok) in tokens.iter().enumerate() {
        if tok.1.contains('\t') {
            split_at = tok.0;
            let _ = idx;
            break;
        }
    }
    (&bytes[..split_at], &bytes[split_at..])
}

fn parse_diff_tree_name_status(bytes: &[u8]) -> Vec<GitCommitFileChange> {
    let s = std::str::from_utf8(bytes).unwrap_or("");
    let mut tokens = s.split('\0').filter(|t| !t.is_empty());
    let mut files: Vec<GitCommitFileChange> = Vec::new();
    while let Some(status_tok) = tokens.next() {
        let status_char = status_tok.chars().next().unwrap_or(' ');
        if status_char == 'R' || status_char == 'C' {
            let original = match tokens.next() {
                Some(v) => v.to_string(),
                None => break,
            };
            let new_path = match tokens.next() {
                Some(v) => v.to_string(),
                None => break,
            };
            files.push(GitCommitFileChange {
                path: new_path,
                original_path: Some(original),
                status: status_char.to_string(),
                status_label: status_label_for(status_char),
                added: 0,
                removed: 0,
                is_binary: false,
            });
        } else {
            let path = match tokens.next() {
                Some(v) => v.to_string(),
                None => break,
            };
            files.push(GitCommitFileChange {
                path,
                original_path: None,
                status: status_char.to_string(),
                status_label: status_label_for(status_char),
                added: 0,
                removed: 0,
                is_binary: false,
            });
        }
    }
    files
}

fn apply_numstat(files: &mut [GitCommitFileChange], bytes: &[u8]) {
    let s = std::str::from_utf8(bytes).unwrap_or("");
    let tokens: Vec<&str> = s.split('\0').filter(|t| !t.is_empty()).collect();
    let mut idx = 0;
    while idx < tokens.len() {
        let header = tokens[idx];
        idx += 1;
        let mut cols = header.splitn(3, '\t');
        let added_raw = cols.next().unwrap_or("0");
        let removed_raw = cols.next().unwrap_or("0");
        let inline_path = cols.next().unwrap_or("");
        let is_binary = added_raw == "-" && removed_raw == "-";
        let added: u32 = if is_binary {
            0
        } else {
            added_raw.parse().unwrap_or(0)
        };
        let removed: u32 = if is_binary {
            0
        } else {
            removed_raw.parse().unwrap_or(0)
        };

        let (path, original) = if inline_path.is_empty() {
            let original = tokens.get(idx).map(|s| s.to_string()).unwrap_or_default();
            idx += 1;
            let new_path = tokens.get(idx).map(|s| s.to_string()).unwrap_or_default();
            idx += 1;
            (new_path, Some(original))
        } else {
            (inline_path.to_string(), None)
        };

        if path.is_empty() {
            continue;
        }
        if let Some(file) = files.iter_mut().find(|f| f.path == path) {
            file.added = added;
            file.removed = removed;
            file.is_binary = is_binary;
            if file.original_path.is_none() {
                if let Some(orig) = original {
                    if !orig.is_empty() && orig != file.path {
                        file.original_path = Some(orig);
                    }
                }
            }
        }
    }
}

fn status_label_for(c: char) -> String {
    match c {
        'A' => "Added".into(),
        'M' => "Modified".into(),
        'D' => "Deleted".into(),
        'R' => "Renamed".into(),
        'C' => "Copied".into(),
        'T' => "Type changed".into(),
        'U' => "Unmerged".into(),
        _ => format!("Status {c}"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn status_label_for_known_chars() {
        assert_eq!(status_label_for('A'), "Added");
        assert_eq!(status_label_for('M'), "Modified");
        assert_eq!(status_label_for('D'), "Deleted");
        assert_eq!(status_label_for('R'), "Renamed");
        assert_eq!(status_label_for('C'), "Copied");
    }

    #[test]
    fn status_label_for_unknown_falls_back() {
        assert_eq!(status_label_for('X'), "Status X");
    }
}
