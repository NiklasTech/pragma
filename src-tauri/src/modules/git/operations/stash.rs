use std::ffi::{OsStr, OsString};

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
    let mut args: Vec<OsString> = vec!["stash".into(), "push".into()];
    if !trimmed.is_empty() {
        args.push("-m".into());
        args.push(trimmed.into());
    }
    let output = run_git(
        Some(&repo_root.to_string_lossy()),
        args,
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
    run_stash_ref_command(repo_root, "pop", stash_ref, "git stash pop")
}

pub fn stash_apply(repo_root: &str, stash_ref: &str) -> Result<()> {
    run_stash_ref_command(repo_root, "apply", stash_ref, "git stash apply")
}

pub fn stash_drop(repo_root: &str, stash_ref: &str) -> Result<()> {
    run_stash_ref_command(repo_root, "drop", stash_ref, "git stash drop")
}

fn run_stash_ref_command(
    repo_root: &str,
    operation: &str,
    stash_ref: &str,
    context: &'static str,
) -> Result<()> {
    let repo_root = authorized_repo_root(repo_root)?;
    ensure_git_available()?;
    if stash_ref.is_empty() {
        return Err(GitError::command(context, "empty stash ref"));
    }
    if !is_safe_stash_ref(stash_ref) {
        return Err(GitError::command(context, "invalid stash ref"));
    }

    let output = run_git(
        Some(&repo_root.to_string_lossy()),
        [
            OsStr::new("stash"),
            OsStr::new(operation),
            OsStr::new(stash_ref),
        ],
        DEFAULT_TIMEOUT_SECS,
    )?;

    if output.exit_code == Some(0) {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr).to_ascii_lowercase();
    // Git reports merge conflicts on stdout.
    let stdout = String::from_utf8_lossy(&output.stdout);
    if stderr.contains("conflict") || stdout.contains("CONFLICT (") {
        return Err(GitError::command(
            context,
            "conflicts detected while applying stash",
        ));
    }
    ensure_success(&output, context)
}

pub fn stash_list(repo_root: &str) -> Result<Vec<StashEntry>> {
    let repo_root = authorized_repo_root(repo_root)?;
    ensure_git_available()?;

    let format = "%gd%x1f%h%x1f%ct%x1f%s";
    let lines = git_stdout_lines(
        &repo_root.to_string_lossy(),
        ["stash", "list", &format!("--format={format}")],
    )?;

    let mut entries = Vec::new();
    for (idx, line) in lines.iter().enumerate() {
        let mut parts = line.splitn(4, '\x1f');
        let ref_name = parts.next().unwrap_or("").to_string();
        let _short_sha = parts.next().unwrap_or("");
        let timestamp_secs = parts.next().unwrap_or("0").parse().unwrap_or(0);
        let message = parts.next().unwrap_or("").to_string();
        if ref_name.is_empty() {
            continue;
        }
        entries.push(StashEntry {
            index: idx as u32,
            message,
            ref_name,
            timestamp_secs,
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
        stash_for_checkout(&repo_root.to_string_lossy(), branch_name)?
    } else {
        None
    };
    result.stashed = stash_ref.is_some();
    result.stash_ref = stash_ref.clone();
    let stash_ref = stash_ref.unwrap_or_default();

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

/// Returns the `stash@{n}` selector of the new entry; `git stash pop` rejects the SHA `stash_push` returns.
fn stash_for_checkout(repo_root: &str, branch_name: &str) -> Result<Option<String>> {
    let previous_top =
        git_stdout_line_opt(repo_root, ["rev-parse", "-q", "--verify", "refs/stash"])?;
    let pushed = stash_push(repo_root, &format!("pragma-smart-checkout-{branch_name}"))?;
    // Untracked-only changes are not stashed, so the top entry stays the same.
    if previous_top.as_deref() == Some(pushed.as_str()) {
        return Ok(None);
    }
    let lines = git_stdout_lines(repo_root, ["stash", "list", "--format=%H %gd"])?;
    Ok(lines.iter().find_map(|line| {
        let (sha, selector) = line.split_once(' ')?;
        (sha == pushed).then(|| selector.to_string())
    }))
}

fn is_safe_stash_ref(stash_ref: &str) -> bool {
    !stash_ref.is_empty()
        && stash_ref.len() <= 64
        && stash_ref
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '{' || c == '}' || c == '@' || c == '_')
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modules::git::operations::test_support::TestRepo;

    #[test]
    fn stash_ref_validation() {
        assert!(is_safe_stash_ref("stash@{0}"));
        assert!(is_safe_stash_ref(&"a".repeat(40)));
        assert!(!is_safe_stash_ref(""));
        assert!(!is_safe_stash_ref("stash@{0}; rm -rf /"));
        assert!(!is_safe_stash_ref("--index"));
        assert!(!is_safe_stash_ref(&"a".repeat(65)));
    }

    #[test]
    fn stash_push_and_pop_round_trip() {
        let repo = TestRepo::new();
        repo.write("file.txt", "changed\n");

        stash_push(&repo.root, "  work in progress  ").unwrap();

        assert_eq!(repo.read("file.txt"), "base\n");
        let entries = stash_list(&repo.root).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].index, 0);
        assert_eq!(entries[0].ref_name, "stash@{0}");
        assert!(entries[0].message.ends_with("work in progress"));
        assert!(entries[0].timestamp_secs > 0);

        stash_pop(&repo.root, "stash@{0}").unwrap();

        assert_eq!(repo.read("file.txt"), "changed\n");
        assert!(stash_list(&repo.root).unwrap().is_empty());
    }

    #[test]
    fn stash_apply_keeps_the_entry_and_drop_removes_it() {
        let repo = TestRepo::new();
        repo.write("file.txt", "changed\n");
        stash_push(&repo.root, "").unwrap();

        stash_apply(&repo.root, "stash@{0}").unwrap();
        assert_eq!(repo.read("file.txt"), "changed\n");
        assert_eq!(stash_list(&repo.root).unwrap().len(), 1);

        stash_drop(&repo.root, "stash@{0}").unwrap();
        assert!(stash_list(&repo.root).unwrap().is_empty());
    }

    #[test]
    fn stash_commands_reject_empty_and_unsafe_refs() {
        let repo = TestRepo::new();
        assert!(stash_pop(&repo.root, "").is_err());
        assert!(stash_apply(&repo.root, "stash@{0} --index").is_err());
        assert!(stash_drop(&repo.root, "../stash").is_err());
    }

    #[test]
    fn stash_pop_fails_without_a_stash() {
        let repo = TestRepo::new();
        assert!(stash_pop(&repo.root, "stash@{0}").is_err());
    }

    #[test]
    fn stash_pop_reports_conflicts() {
        let repo = TestRepo::new();
        repo.write("file.txt", "stashed\n");
        stash_push(&repo.root, "").unwrap();
        repo.write("file.txt", "committed\n");
        repo.commit_all("diverge");

        let err = stash_pop(&repo.root, "stash@{0}").unwrap_err();

        assert!(err.to_string().contains("conflicts"), "{err}");
    }

    #[test]
    fn smart_checkout_without_changes_only_switches() {
        let repo = TestRepo::new();
        repo.git(&["branch", "feature"]);

        let result = smart_checkout(&repo.root, "feature").unwrap();

        assert!(result.checkout_ok);
        assert!(!result.stashed);
        assert_eq!(repo.git(&["branch", "--show-current"]), "feature");
    }

    #[test]
    fn smart_checkout_carries_changes_to_the_target_branch() {
        let repo = TestRepo::new();
        repo.git(&["branch", "feature"]);
        repo.write("file.txt", "changed\n");

        let result = smart_checkout(&repo.root, "feature").unwrap();

        assert!(result.checkout_ok);
        assert!(result.stashed);
        assert!(result.pop_ok);
        assert!(!result.pop_conflict);
        assert_eq!(repo.git(&["branch", "--show-current"]), "feature");
        assert_eq!(repo.read("file.txt"), "changed\n");
        assert!(stash_list(&repo.root).unwrap().is_empty());
    }

    #[test]
    fn smart_checkout_pops_its_own_entry_when_older_stashes_exist() {
        let repo = TestRepo::new();
        repo.git(&["branch", "feature"]);
        repo.write("other.txt", "older\n");
        repo.git(&["add", "other.txt"]);
        stash_push(&repo.root, "older").unwrap();
        repo.write("file.txt", "changed\n");

        let result = smart_checkout(&repo.root, "feature").unwrap();

        assert!(result.pop_ok);
        assert_eq!(repo.read("file.txt"), "changed\n");
        let entries = stash_list(&repo.root).unwrap();
        assert_eq!(entries.len(), 1);
        assert!(entries[0].message.ends_with("older"));
    }

    #[test]
    fn smart_checkout_does_not_pop_unrelated_stashes_for_untracked_changes() {
        let repo = TestRepo::new();
        repo.git(&["branch", "feature"]);
        repo.write("file.txt", "older\n");
        stash_push(&repo.root, "older").unwrap();
        repo.write("untracked.txt", "new\n");

        let result = smart_checkout(&repo.root, "feature").unwrap();

        assert!(result.checkout_ok);
        assert!(!result.stashed);
        assert_eq!(repo.read("file.txt"), "base\n");
        assert_eq!(stash_list(&repo.root).unwrap().len(), 1);
    }

    #[test]
    fn smart_checkout_reports_pop_conflicts() {
        let repo = TestRepo::new();
        repo.git(&["checkout", "-q", "-b", "feature"]);
        repo.write("file.txt", "feature\n");
        repo.commit_all("feature change");
        repo.git(&["checkout", "-q", "main"]);
        repo.write("file.txt", "local\n");

        let result = smart_checkout(&repo.root, "feature").unwrap();

        assert!(result.checkout_ok);
        assert!(result.stashed);
        assert!(!result.pop_ok);
        assert!(result.pop_conflict);
        assert_eq!(stash_list(&repo.root).unwrap().len(), 1);
    }

    #[test]
    fn smart_checkout_restores_changes_when_checkout_fails() {
        let repo = TestRepo::new();
        repo.write("file.txt", "changed\n");

        assert!(smart_checkout(&repo.root, "missing").is_err());

        assert_eq!(repo.git(&["branch", "--show-current"]), "main");
        assert_eq!(repo.read("file.txt"), "changed\n");
        assert!(stash_list(&repo.root).unwrap().is_empty());
    }

    #[test]
    fn smart_checkout_rejects_empty_branch_name() {
        let repo = TestRepo::new();
        assert!(smart_checkout(&repo.root, "").is_err());
    }
}
