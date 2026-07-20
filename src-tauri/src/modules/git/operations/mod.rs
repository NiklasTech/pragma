mod branch;
mod commit;
mod compose;
mod diff;
mod log;
mod remote;
mod stage;
mod stash;
mod status;

pub use branch::{
    checkout_branch, create_branch, delete_branch, get_branches, has_uncommitted_changes,
};
pub use commit::{
    checkout_commit, cherry_pick_commit, commit, commit_details, commit_file_diff, commit_files,
    create_branch_from_commit, reset_to_commit, revert_commit, show_commit_diff,
};
pub use compose::compose_file_changed_between_branches;
pub use diff::{diff, diff_content};
pub use log::{file_history, log};
pub use remote::{fetch, list_remote_branches, list_remotes, pull_ff_only, push, remote_url};
pub use stage::{discard, stage, unstage};
pub use stash::{smart_checkout, stash_list, stash_pop, stash_push};
pub use status::{resolve_repo, status};

use std::path::Path;

use crate::modules::git::errors::Result;
use crate::modules::git::utils::{pathspec, resolve_within_repo};

fn pathspec_from_input(repo_root: &Path, rel: &str) -> Result<String> {
    let resolved = resolve_within_repo(repo_root, rel)?;
    Ok(pathspec(repo_root, &resolved))
}

#[cfg(test)]
mod tests {
    use crate::modules::git::utils::sha_is_safe;

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
}
