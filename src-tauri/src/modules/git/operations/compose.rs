use std::path::Path;

use crate::modules::git::errors::{GitError, Result};
use crate::modules::git::process::{ensure_git_available, ensure_success, run_git};
use crate::modules::git::types::DEFAULT_TIMEOUT_SECS;
use crate::modules::git::utils::authorized_repo_root;

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
