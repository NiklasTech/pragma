use git2::Repository;

use super::{map_git_error, GitBranch, GitCommit, GitCommitFileChange, GitLogEntry};

pub fn get_branches(repo_path: &str) -> Result<Vec<GitBranch>, String> {
    let repo = Repository::open(repo_path).map_err(map_git_error)?;
    let head = repo.head().ok();

    let mut branches = Vec::new();

    for branch_result in repo.branches(None).map_err(map_git_error)? {
        let (branch, branch_type) = branch_result.map_err(map_git_error)?;

        let name = branch
            .name()
            .map_err(map_git_error)?
            .unwrap_or("unknown")
            .to_string();

        let is_head = head
            .as_ref()
            .and_then(|h| h.shorthand())
            .map(|h| h == name)
            .unwrap_or(false);

        if branch_type == git2::BranchType::Local {
            branches.push(GitBranch { name, is_head });
        }
    }

    Ok(branches)
}

pub fn get_log(repo_path: &str, limit: usize) -> Result<Vec<GitCommit>, String> {
    let repo = Repository::open(repo_path).map_err(map_git_error)?;

    let head = repo.head().map_err(map_git_error)?;
    let oid = head.target().ok_or("HEAD has no target")?;
    let mut revwalk = repo.revwalk().map_err(map_git_error)?;
    revwalk.push(oid).map_err(map_git_error)?;

    let mut commits = Vec::new();

    for oid_result in revwalk {
        let oid = oid_result.map_err(map_git_error)?;
        let commit = repo.find_commit(oid).map_err(map_git_error)?;

        let id = commit.id().to_string();
        let message = commit.message().unwrap_or("").trim().to_string();
        let author = commit.author().name().unwrap_or("unknown").to_string();
        let time = commit.time().seconds();

        commits.push(GitCommit {
            id,
            message,
            author,
            time,
        });

        if commits.len() >= limit {
            break;
        }
    }

    Ok(commits)
}

pub fn get_log_entries(
    repo_path: &str,
    limit: usize,
    before_sha: Option<String>,
) -> Result<Vec<GitLogEntry>, String> {
    let repo = Repository::open(repo_path).map_err(map_git_error)?;

    let mut revwalk = repo.revwalk().map_err(map_git_error)?;
    revwalk.push_head().map_err(map_git_error)?;

    if let Some(before) = before_sha {
        if let Ok(oid) = git2::Oid::from_str(&before) {
            revwalk.hide(oid).ok();
        }
    }

    let mut entries = Vec::new();

    for oid_result in revwalk {
        let oid = oid_result.map_err(map_git_error)?;
        let commit = repo.find_commit(oid).map_err(map_git_error)?;

        let sha = commit.id().to_string();
        let short_sha = sha.chars().take(7).collect();
        let author = commit.author().name().unwrap_or("unknown").to_string();
        let author_email = commit.author().email().unwrap_or("").to_string();
        let timestamp_secs = commit.time().seconds();
        let parents: Vec<String> = commit.parents().map(|p| p.id().to_string()).collect();
        let subject = commit.summary().unwrap_or("").to_string();

        // Get diff stats
        let mut files_changed = 0usize;
        let mut insertions = 0usize;
        let mut deletions = 0usize;

        if commit.parent_count() > 0 {
            let parent = commit.parent(0).map_err(map_git_error)?;
            let parent_tree = parent.tree().map_err(map_git_error)?;
            let commit_tree = commit.tree().map_err(map_git_error)?;
            if let Ok(diff) = repo.diff_tree_to_tree(Some(&parent_tree), Some(&commit_tree), None) {
                if let Ok(stats) = diff.stats() {
                    files_changed = stats.files_changed();
                    insertions = stats.insertions();
                    deletions = stats.deletions();
                }
            }
        }

        entries.push(GitLogEntry {
            sha,
            short_sha,
            author,
            author_email,
            timestamp_secs,
            parents,
            subject,
            files_changed,
            insertions,
            deletions,
        });

        if entries.len() >= limit {
            break;
        }
    }

    Ok(entries)
}

pub fn get_commit_files(repo_path: &str, sha: &str) -> Result<Vec<GitCommitFileChange>, String> {
    let repo = Repository::open(repo_path).map_err(map_git_error)?;
    let oid = git2::Oid::from_str(sha).map_err(|_| "Invalid SHA")?;
    let commit = repo.find_commit(oid).map_err(map_git_error)?;

    let mut files = Vec::new();

    if commit.parent_count() > 0 {
        let parent = commit.parent(0).map_err(map_git_error)?;
        let parent_tree = parent.tree().map_err(map_git_error)?;
        let commit_tree = commit.tree().map_err(map_git_error)?;
        let diff = repo
            .diff_tree_to_tree(Some(&parent_tree), Some(&commit_tree), None)
            .map_err(map_git_error)?;

        for delta in diff.deltas() {
            let status = delta.status();
            let (status_str, status_label) = match status {
                git2::Delta::Added => ("A", "Added"),
                git2::Delta::Modified => ("M", "Modified"),
                git2::Delta::Deleted => ("D", "Deleted"),
                git2::Delta::Renamed => ("R", "Renamed"),
                git2::Delta::Copied => ("C", "Copied"),
                _ => ("?", "Other"),
            };

            let path = delta
                .new_file()
                .path()
                .and_then(|p| p.to_str())
                .unwrap_or("unknown")
                .to_string();
            let original_path = delta
                .old_file()
                .path()
                .and_then(|p| p.to_str())
                .map(|s| s.to_string());

            let mut added = 0usize;
            let mut removed = 0usize;

            let idx = files.len();
            if let Ok(Some(patch)) = git2::Patch::from_diff(&diff, idx) {
                let stats = patch.line_stats();
                if let Ok((a, r, _)) = stats {
                    added = a;
                    removed = r;
                }
            }

            let is_binary = delta.new_file().is_binary() || delta.old_file().is_binary();

            files.push(GitCommitFileChange {
                path,
                original_path,
                status: status_str.to_string(),
                status_label: status_label.to_string(),
                added,
                removed,
                is_binary,
            });
        }
    }

    Ok(files)
}
