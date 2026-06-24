use std::ffi::OsStr;
use std::ffi::OsString;
use std::path::Path;

use crate::modules::git::errors::{GitError, Result};
use crate::modules::git::parser::parse_porcelain_v2;
use crate::modules::git::process::{
    ensure_git_available, ensure_success, git_show_text, git_stdout_line_opt, git_stdout_lines,
    read_text_file, run_git,
};
use crate::modules::git::types::{
    GitBranch, GitCommitFileChange, GitCommitResult, GitDiffContentResult, GitDiffResult,
    GitLogEntry, GitPushResult, GitRemote, GitRemoteBranch, GitStatusSnapshot, SmartCheckoutResult,
    TextSource, DEFAULT_TIMEOUT_SECS, NETWORK_TIMEOUT_SECS,
};
use crate::modules::git::utils::{
    authorized_repo_root, canonical_dir, pathspec, resolve_within_repo, sha_is_safe,
};

// -- Repo resolution -----------------------------------------------------------

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

// -- Status --------------------------------------------------------------------

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

// -- Diff ----------------------------------------------------------------------

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

// -- Stage / Unstage -----------------------------------------------------------

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

// -- Commit --------------------------------------------------------------------

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

// -- Branches ------------------------------------------------------------------

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

// -- Compose change detection --------------------------------------------------

const COMPOSE_FILE_NAMES: &[&str] = &[
    "docker-compose.yml",
    "docker-compose.yaml",
    "compose.yml",
    "compose.yaml",
];

fn find_compose_file_name(workspace_root: &str) -> Option<String> {
    let root = Path::new(workspace_root);
    for name in COMPOSE_FILE_NAMES {
        if root.join(name).is_file() {
            return Some((*name).to_string());
        }
    }
    None
}

fn compose_git_path(repo_root: &Path, workspace_root: &str, compose_name: &str) -> Result<String> {
    let workspace = Path::new(workspace_root);
    if workspace == repo_root {
        return Ok(compose_name.to_string());
    }
    let rel = workspace.strip_prefix(repo_root).map_err(|_| {
        GitError::command("compose change check", "workspace root outside repository")
    })?;
    Ok(rel.join(compose_name).to_string_lossy().replace('\\', "/"))
}

pub fn compose_file_changed_between_branches(
    repo_root: &str,
    workspace_root: &str,
    source_branch: &str,
    target_branch: &str,
) -> Result<bool> {
    let repo_root = authorized_repo_root(repo_root)?;
    ensure_git_available()?;
    if source_branch.is_empty() || target_branch.is_empty() {
        return Err(GitError::command(
            "compose change check",
            "empty branch name",
        ));
    }

    let compose_name = match find_compose_file_name(workspace_root) {
        Some(name) => name,
        None => return Ok(false),
    };
    let rel_path = compose_git_path(&repo_root, workspace_root, &compose_name)?;

    let output = run_git(
        Some(&repo_root.to_string_lossy()),
        [
            "diff",
            "--no-ext-diff",
            source_branch,
            target_branch,
            "--",
            &rel_path,
        ],
        DEFAULT_TIMEOUT_SECS,
    )?;
    ensure_success(&output, "compose change check")?;

    Ok(!output.stdout.is_empty())
}

// -- Stash ---------------------------------------------------------------------

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

pub fn stash_list(repo_root: &str) -> Result<Vec<crate::modules::git::types::StashEntry>> {
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
        entries.push(crate::modules::git::types::StashEntry {
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

// -- Log -----------------------------------------------------------------------

const LOG_FORMAT: &str = "%H%x1f%an%x1f%ae%x1f%at%x1f%P%x1f%s";
const MAX_LOG_LIMIT: u32 = 200;

pub fn log(repo_root: &str, limit: u32, before_sha: Option<&str>) -> Result<Vec<GitLogEntry>> {
    let repo_root = authorized_repo_root(repo_root)?;
    ensure_git_available()?;
    let bounded = limit.clamp(1, MAX_LOG_LIMIT);
    let count_arg = format!("--max-count={bounded}");
    let format_arg = format!("--format={LOG_FORMAT}");
    let cursor = match before_sha {
        Some(sha) if !sha.is_empty() => {
            if !sha_is_safe(sha) {
                return Err(GitError::command("git log", "invalid cursor sha"));
            }
            Some(format!("{sha}^"))
        }
        _ => None,
    };
    let mut args: Vec<&OsStr> = vec![
        OsStr::new("log"),
        OsStr::new("--no-color"),
        OsStr::new("--shortstat"),
        OsStr::new(&count_arg),
        OsStr::new(&format_arg),
    ];
    if let Some(ref spec) = cursor {
        args.push(OsStr::new(spec));
    }
    let output = run_git(
        Some(&repo_root.to_string_lossy()),
        args,
        DEFAULT_TIMEOUT_SECS,
    )?;
    if output.timed_out {
        return Err(GitError::TimedOut("git log"));
    }
    if output.exit_code != Some(0) {
        let stderr = String::from_utf8_lossy(&output.stderr).to_ascii_lowercase();
        if stderr.contains("does not have any commits yet")
            || stderr.contains("bad default revision")
            || stderr.contains("unknown revision")
            || stderr.contains("ambiguous argument 'head'")
        {
            return Ok(Vec::new());
        }
        return ensure_success(&output, "git log failed").map(|_| Vec::new());
    }
    let stdout = std::str::from_utf8(&output.stdout).unwrap_or("");
    let mut entries: Vec<GitLogEntry> = Vec::with_capacity(bounded as usize);

    for raw_line in stdout.lines() {
        let line = raw_line.trim_end_matches('\r');
        if line.is_empty() {
            continue;
        }
        if line.contains('\x1f') {
            let mut fields = line.splitn(6, '\x1f');
            let sha = fields.next().unwrap_or("").to_string();
            if !sha_is_safe(&sha) {
                continue;
            }
            let author = fields.next().unwrap_or("").to_string();
            let author_email = fields.next().unwrap_or("").to_string();
            let timestamp = fields.next().unwrap_or("0").parse::<i64>().unwrap_or(0);
            let parents_raw = fields.next().unwrap_or("");
            let parents: Vec<String> = parents_raw
                .split_ascii_whitespace()
                .map(|s| s.to_string())
                .collect();
            let subject = fields.next().unwrap_or("").to_string();
            let short_sha = sha.chars().take(7).collect::<String>();
            entries.push(GitLogEntry {
                sha,
                short_sha,
                author,
                author_email,
                timestamp_secs: timestamp,
                parents,
                subject,
                files_changed: 0,
                insertions: 0,
                deletions: 0,
            });
            continue;
        }
        if let Some(current) = entries.last_mut() {
            if line.contains("file changed") || line.contains("files changed") {
                let (files, ins, del) = parse_shortstat(line);
                current.files_changed = files;
                current.insertions = ins;
                current.deletions = del;
            }
        }
    }
    Ok(entries)
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

// -- Remote operations ---------------------------------------------------------

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
    if upstream.is_none() {
        return Err(GitError::NoUpstream);
    }

    let output = run_git(
        Some(&repo_root.to_string_lossy()),
        ["push"],
        NETWORK_TIMEOUT_SECS,
    )?;
    ensure_success(&output, "git push failed")?;

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

// -- Helpers -------------------------------------------------------------------

fn nothing_to_commit(output: &crate::modules::git::types::GitOutput) -> bool {
    let stderr = String::from_utf8_lossy(&output.stderr).to_ascii_lowercase();
    let stdout = String::from_utf8_lossy(&output.stdout).to_ascii_lowercase();
    stderr.contains("nothing to commit") || stdout.contains("nothing to commit")
}

fn resolve_pathspecs(repo_root: &Path, paths: &[String]) -> Result<Vec<String>> {
    let mut out = Vec::with_capacity(paths.len());
    for p in paths {
        out.push(pathspec_from_input(repo_root, p)?);
    }
    Ok(out)
}

fn pathspec_from_input(repo_root: &Path, rel: &str) -> Result<String> {
    let resolved = resolve_within_repo(repo_root, rel)?;
    Ok(pathspec(repo_root, &resolved))
}

fn parse_shortstat(tail: &str) -> (u32, u32, u32) {
    for line in tail.lines() {
        let trimmed = line.trim();
        if !(trimmed.contains("file changed") || trimmed.contains("files changed")) {
            continue;
        }
        let mut files = 0u32;
        let mut ins = 0u32;
        let mut del = 0u32;
        for part in trimmed.split(',') {
            let part = part.trim();
            let num_str = part.split_ascii_whitespace().next().unwrap_or("0");
            let n: u32 = num_str.parse().unwrap_or(0);
            if part.contains("file") {
                files = n;
            } else if part.contains("insertion") {
                ins = n;
            } else if part.contains("deletion") {
                del = n;
            }
        }
        return (files, ins, del);
    }
    (0, 0, 0)
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

fn is_remote_name_char(c: char) -> bool {
    c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.'
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sha_is_safe_accepts_hex() {
        assert!(sha_is_safe("abc123"));
        assert!(sha_is_safe(&"a".repeat(40)));
        assert!(sha_is_safe(&"f".repeat(64)));
    }

    #[test]
    fn sha_is_safe_rejects_non_hex_or_oversize() {
        assert!(!sha_is_safe(""));
        assert!(!sha_is_safe("abcg"));
        assert!(!sha_is_safe("abc 123"));
        assert!(!sha_is_safe(&"a".repeat(65)));
        assert!(!sha_is_safe(";rm -rf /"));
    }

    #[test]
    fn is_remote_name_char_allows_word_and_punct() {
        for c in "abcXYZ012-_.".chars() {
            assert!(is_remote_name_char(c));
        }
        for c in " /:\\?\"'".chars() {
            assert!(!is_remote_name_char(c));
        }
    }

    #[test]
    fn parse_shortstat_pulls_three_counts() {
        let line = " 5 files changed, 12 insertions(+), 3 deletions(-)";
        assert_eq!(parse_shortstat(line), (5, 12, 3));
    }

    #[test]
    fn parse_shortstat_handles_singular_file() {
        let line = " 1 file changed, 1 insertion(+)";
        assert_eq!(parse_shortstat(line), (1, 1, 0));
    }

    #[test]
    fn parse_shortstat_returns_zeros_when_absent() {
        assert_eq!(parse_shortstat("no stat here"), (0, 0, 0));
    }

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
