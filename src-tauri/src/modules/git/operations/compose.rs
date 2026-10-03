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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modules::git::operations::test_support::TestRepo;

    fn compose_repo(compose_path: &str) -> TestRepo {
        let repo = TestRepo::new();
        repo.write(compose_path, "services: {}\n");
        repo.commit_all("add compose");
        repo.git(&["branch", "feature"]);
        repo
    }

    fn canonical_root(repo: &TestRepo) -> String {
        std::fs::canonicalize(&repo.root)
            .unwrap()
            .to_string_lossy()
            .into_owned()
    }

    #[test]
    fn finds_compose_files_in_preferred_order() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().to_string_lossy();
        assert_eq!(find_compose_file_name(&root), None);

        std::fs::write(dir.path().join("compose.yaml"), "").unwrap();
        assert_eq!(
            find_compose_file_name(&root).as_deref(),
            Some("compose.yaml")
        );

        std::fs::write(dir.path().join("docker-compose.yml"), "").unwrap();
        assert_eq!(
            find_compose_file_name(&root).as_deref(),
            Some("docker-compose.yml")
        );
    }

    #[test]
    fn compose_git_path_is_relative_to_the_repository() {
        let root = Path::new("/repo");
        assert_eq!(
            compose_git_path(root, "/repo", "compose.yml").unwrap(),
            "compose.yml"
        );
        assert_eq!(
            compose_git_path(root, "/repo/services/api", "compose.yml").unwrap(),
            "services/api/compose.yml"
        );
        assert!(compose_git_path(root, "/elsewhere", "compose.yml").is_err());
    }

    #[test]
    fn detects_a_changed_compose_file() {
        let repo = compose_repo("compose.yml");
        repo.git(&["checkout", "-q", "feature"]);
        repo.write("compose.yml", "services:\n  web: {}\n");
        repo.commit_all("change compose");
        let root = canonical_root(&repo);

        assert!(compose_file_changed_between_branches(&root, &root, "main", "feature").unwrap());
    }

    #[test]
    fn ignores_changes_to_other_files() {
        let repo = compose_repo("compose.yml");
        repo.git(&["checkout", "-q", "feature"]);
        repo.write("file.txt", "changed\n");
        repo.commit_all("change file");
        let root = canonical_root(&repo);

        assert!(!compose_file_changed_between_branches(&root, &root, "main", "feature").unwrap());
    }

    #[test]
    fn checks_compose_files_in_a_workspace_subdirectory() {
        let repo = compose_repo("api/compose.yml");
        repo.git(&["checkout", "-q", "feature"]);
        repo.write("api/compose.yml", "services:\n  api: {}\n");
        repo.commit_all("change compose");
        let root = canonical_root(&repo);
        let workspace = Path::new(&root).join("api");

        assert!(compose_file_changed_between_branches(
            &root,
            &workspace.to_string_lossy(),
            "main",
            "feature"
        )
        .unwrap());
    }

    #[test]
    fn returns_false_without_a_compose_file() {
        let repo = TestRepo::new();
        repo.git(&["branch", "feature"]);
        let root = canonical_root(&repo);

        assert!(!compose_file_changed_between_branches(&root, &root, "main", "feature").unwrap());
    }

    #[test]
    fn rejects_empty_and_unknown_branches() {
        let repo = compose_repo("compose.yml");
        let root = canonical_root(&repo);

        assert!(compose_file_changed_between_branches(&root, &root, "", "feature").is_err());
        assert!(compose_file_changed_between_branches(&root, &root, "main", "missing").is_err());
    }
}
