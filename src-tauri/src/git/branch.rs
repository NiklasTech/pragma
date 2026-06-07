use git2::{BranchType, Repository};

use super::map_git_error;

pub fn checkout_branch(repo_path: &str, branch_name: &str) -> Result<(), String> {
    let repo = Repository::open(repo_path).map_err(map_git_error)?;

    let refname = format!("refs/heads/{}", branch_name);
    repo.set_head(&refname).map_err(map_git_error)?;

    let mut opts = git2::build::CheckoutBuilder::new();
    opts.safe();
    repo.checkout_head(Some(&mut opts)).map_err(map_git_error)?;

    Ok(())
}

pub fn create_branch(repo_path: &str, branch_name: &str, checkout: bool) -> Result<(), String> {
    let repo = Repository::open(repo_path).map_err(map_git_error)?;
    let head = repo.head().map_err(map_git_error)?;
    let commit = repo
        .find_commit(head.target().ok_or("HEAD has no target")?)
        .map_err(map_git_error)?;

    repo.branch(branch_name, &commit, false)
        .map_err(map_git_error)?;

    if checkout {
        let refname = format!("refs/heads/{}", branch_name);
        repo.set_head(&refname).map_err(map_git_error)?;

        let mut opts = git2::build::CheckoutBuilder::new();
        opts.safe();
        repo.checkout_head(Some(&mut opts)).map_err(map_git_error)?;
    }

    Ok(())
}

pub fn delete_branch(repo_path: &str, branch_name: &str) -> Result<(), String> {
    let repo = Repository::open(repo_path).map_err(map_git_error)?;

    let head = repo.head().ok();
    let is_head = head
        .as_ref()
        .and_then(|h| h.shorthand())
        .map(|h| h == branch_name)
        .unwrap_or(false);

    if is_head {
        return Err("Cannot delete the current branch".to_string());
    }

    let mut branch = repo
        .find_branch(branch_name, BranchType::Local)
        .map_err(map_git_error)?;

    branch.delete().map_err(map_git_error)?;

    Ok(())
}

pub fn has_uncommitted_changes(repo_path: &str) -> Result<bool, String> {
    let repo = Repository::open(repo_path).map_err(map_git_error)?;

    let mut opts = git2::StatusOptions::new();
    opts.include_untracked(true);

    let statuses = repo.statuses(Some(&mut opts)).map_err(map_git_error)?;

    Ok(!statuses.is_empty())
}
