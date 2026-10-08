use std::ffi::OsStr;

use crate::modules::git::errors::{GitError, Result};
use crate::modules::git::process::run_git;
use crate::modules::git::types::DEFAULT_TIMEOUT_SECS;
use crate::modules::git::utils::sha_is_safe;

const MAX_REVISION_CHARS: usize = 255;

/// Resolves a branch, tag or commit to its full commit sha. Path specs (`rev:path`) and
/// option-like input are rejected before git sees them.
pub(crate) fn resolve_commit(root: &str, revision: &str) -> Result<String> {
    let revision = revision.trim();
    if revision.is_empty()
        || revision.len() > MAX_REVISION_CHARS
        || revision.starts_with('-')
        || revision.contains(':')
        || revision
            .chars()
            .any(|c| c.is_whitespace() || c.is_control())
    {
        return Err(GitError::command("invalid revision", revision.to_string()));
    }
    let spec = format!("{revision}^{{commit}}");
    let output = run_git(
        Some(root),
        [
            OsStr::new("rev-parse"),
            OsStr::new("--verify"),
            OsStr::new("--quiet"),
            OsStr::new(&spec),
        ],
        DEFAULT_TIMEOUT_SECS,
    )?;
    if output.timed_out {
        return Err(GitError::TimedOut("git rev-parse"));
    }
    let sha = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if output.exit_code != Some(0) || !sha_is_safe(&sha) {
        return Err(GitError::command("unknown revision", revision.to_string()));
    }
    Ok(sha)
}

/// Validates `name` as the short name of a ref under `refs/<kind>/`.
pub(crate) fn ensure_ref_name(root: &str, kind: &str, name: &str) -> Result<()> {
    if name.is_empty() || name.len() > MAX_REVISION_CHARS || name.starts_with('-') {
        return Err(GitError::command("invalid name", name.to_string()));
    }
    let full = format!("refs/{kind}/{name}");
    let output = run_git(
        Some(root),
        [OsStr::new("check-ref-format"), OsStr::new(&full)],
        DEFAULT_TIMEOUT_SECS,
    )?;
    if output.exit_code != Some(0) {
        return Err(GitError::command("invalid name", name.to_string()));
    }
    Ok(())
}

/// Whether `refs/<kind>/<name>` exists.
pub(crate) fn ref_exists(root: &str, kind: &str, name: &str) -> Result<bool> {
    let full = format!("refs/{kind}/{name}");
    let output = run_git(
        Some(root),
        [
            OsStr::new("show-ref"),
            OsStr::new("--verify"),
            OsStr::new("--quiet"),
            OsStr::new(&full),
        ],
        DEFAULT_TIMEOUT_SECS,
    )?;
    if output.timed_out {
        return Err(GitError::TimedOut("git show-ref"));
    }
    Ok(output.exit_code == Some(0))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modules::git::operations::test_support::TestRepo;

    #[test]
    fn resolve_commit_accepts_branches_and_head() {
        let repo = TestRepo::new();
        let head = repo.git(&["rev-parse", "HEAD"]);

        assert_eq!(resolve_commit(&repo.root, "main").unwrap(), head);
        assert_eq!(resolve_commit(&repo.root, "HEAD").unwrap(), head);
        assert_eq!(resolve_commit(&repo.root, &head[..7]).unwrap(), head);
    }

    #[test]
    fn resolve_commit_rejects_unsafe_or_unknown_input() {
        let repo = TestRepo::new();

        assert!(resolve_commit(&repo.root, "").is_err());
        assert!(resolve_commit(&repo.root, "--all").is_err());
        assert!(resolve_commit(&repo.root, "HEAD:file.txt").is_err());
        assert!(resolve_commit(&repo.root, "main branch").is_err());
        assert!(resolve_commit(&repo.root, "missing").is_err());
    }

    #[test]
    fn ensure_ref_name_follows_git_rules() {
        let repo = TestRepo::new();

        assert!(ensure_ref_name(&repo.root, "tags", "v1.0.0").is_ok());
        assert!(ensure_ref_name(&repo.root, "heads", "feat/x").is_ok());
        assert!(ensure_ref_name(&repo.root, "tags", "-d").is_err());
        assert!(ensure_ref_name(&repo.root, "tags", "bad..name").is_err());
        assert!(ensure_ref_name(&repo.root, "tags", "with space").is_err());
    }
}
