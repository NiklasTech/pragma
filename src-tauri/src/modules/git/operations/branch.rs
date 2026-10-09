use crate::modules::git::errors::{GitError, Result};
use crate::modules::git::process::{
    ensure_git_available, ensure_success, git_stdout_line_opt, git_stdout_lines, run_git,
};
use crate::modules::git::types::{GitBranch, DEFAULT_TIMEOUT_SECS};
use crate::modules::git::utils::authorized_repo_root;

use super::merge::{ensure_local_branch, is_safe_branch_name};
use super::revision::{ensure_ref_name, ref_exists};

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

/// A name starting with `-` would reach git as an option instead of a branch.
fn ensure_safe_branch_name(branch_name: &str) -> Result<()> {
    if is_safe_branch_name(branch_name) {
        Ok(())
    } else {
        Err(GitError::command("invalid branch", branch_name.to_string()))
    }
}

pub fn checkout_branch(repo_root: &str, branch_name: &str) -> Result<()> {
    ensure_safe_branch_name(branch_name)?;
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
    ensure_safe_branch_name(branch_name)?;
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
    ensure_safe_branch_name(branch_name)?;
    let repo_root = authorized_repo_root(repo_root)?;
    ensure_git_available()?;
    let output = run_git(
        Some(&repo_root.to_string_lossy()),
        ["branch", "-D", branch_name],
        DEFAULT_TIMEOUT_SECS,
    )?;
    ensure_success(&output, "git branch -D failed")
}

pub fn rename_branch(repo_root: &str, old_name: &str, new_name: &str) -> Result<()> {
    let repo_root = authorized_repo_root(repo_root)?;
    ensure_git_available()?;
    let root = repo_root.to_string_lossy();
    ensure_local_branch(&root, old_name)?;
    if !is_safe_branch_name(new_name) {
        return Err(GitError::command("invalid branch", new_name.to_string()));
    }
    ensure_ref_name(&root, "heads", new_name)?;
    if ref_exists(&root, "heads", new_name)? {
        return Err(GitError::command(
            "branch already exists",
            new_name.to_string(),
        ));
    }
    let output = run_git(
        Some(&root),
        ["branch", "-m", old_name, new_name],
        DEFAULT_TIMEOUT_SECS,
    )?;
    ensure_success(&output, "git branch -m failed")
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modules::git::operations::test_support::TestRepo;

    fn branch_names(repo: &TestRepo) -> Vec<String> {
        get_branches(&repo.root)
            .unwrap()
            .into_iter()
            .map(|b| b.name)
            .collect()
    }

    #[test]
    fn get_branches_marks_the_current_branch() {
        let repo = TestRepo::new();
        repo.git(&["branch", "other"]);

        let branches = get_branches(&repo.root).unwrap();

        assert_eq!(branches.len(), 2);
        let head: Vec<_> = branches.iter().filter(|b| b.is_head).collect();
        assert_eq!(head.len(), 1);
        assert_eq!(head[0].name, "main");
    }

    #[test]
    fn create_branch_with_checkout_switches_head() {
        let repo = TestRepo::new();

        create_branch(&repo.root, "feature", true).unwrap();

        assert_eq!(repo.git(&["branch", "--show-current"]), "feature");
    }

    #[test]
    fn create_branch_without_checkout_keeps_head() {
        let repo = TestRepo::new();

        create_branch(&repo.root, "feature", false).unwrap();

        assert_eq!(repo.git(&["branch", "--show-current"]), "main");
        assert!(branch_names(&repo).contains(&"feature".to_string()));
    }

    #[test]
    fn create_branch_rejects_existing_and_invalid_names() {
        let repo = TestRepo::new();
        assert!(create_branch(&repo.root, "main", false).is_err());
        assert!(create_branch(&repo.root, "bad..name", false).is_err());
    }

    #[test]
    fn branch_names_that_look_like_options_are_rejected() {
        let repo = TestRepo::new();
        assert!(create_branch(&repo.root, "--orphan", false).is_err());
        assert!(checkout_branch(&repo.root, "-f").is_err());
        assert!(delete_branch(&repo.root, "--all").is_err());
        assert_eq!(repo.git(&["branch", "--show-current"]), "main");
    }

    #[test]
    fn checkout_branch_fails_for_unknown_branch() {
        let repo = TestRepo::new();
        assert!(checkout_branch(&repo.root, "missing").is_err());
        assert_eq!(repo.git(&["branch", "--show-current"]), "main");
    }

    #[test]
    fn delete_branch_removes_the_branch() {
        let repo = TestRepo::new();
        repo.git(&["branch", "old"]);

        delete_branch(&repo.root, "old").unwrap();

        assert_eq!(branch_names(&repo), vec!["main"]);
    }

    #[test]
    fn delete_branch_refuses_the_current_branch() {
        let repo = TestRepo::new();
        repo.git(&["branch", "other"]);
        assert!(delete_branch(&repo.root, "main").is_err());
    }

    #[test]
    fn rename_branch_renames_the_current_branch() {
        let repo = TestRepo::new();

        rename_branch(&repo.root, "main", "trunk").unwrap();

        assert_eq!(repo.git(&["branch", "--show-current"]), "trunk");
        assert_eq!(branch_names(&repo), vec!["trunk"]);
    }

    #[test]
    fn rename_branch_rejects_existing_missing_and_invalid_names() {
        let repo = TestRepo::new();
        repo.git(&["branch", "other"]);

        assert!(rename_branch(&repo.root, "main", "other").is_err());
        assert!(rename_branch(&repo.root, "missing", "new").is_err());
        assert!(rename_branch(&repo.root, "other", "-M").is_err());
        assert!(rename_branch(&repo.root, "other", "bad..name").is_err());
    }

    #[test]
    fn has_uncommitted_changes_detects_edits_and_new_files() {
        let repo = TestRepo::new();
        assert!(!has_uncommitted_changes(&repo.root).unwrap());

        repo.write("new.txt", "new\n");

        assert!(has_uncommitted_changes(&repo.root).unwrap());
    }
}
