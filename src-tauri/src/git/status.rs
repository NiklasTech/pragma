use git2::{Repository, StatusOptions};

use super::{map_git_error, GitRepoInfo, GitStatusEntry, GitStatusSnapshot};

pub fn get_snapshot(repo_path: &str) -> Result<GitStatusSnapshot, String> {
    let repo = Repository::open(repo_path).map_err(map_git_error)?;

    let head = repo.head().map_err(map_git_error)?;
    let branch = head.shorthand().unwrap_or("unknown").to_string();
    let is_detached = !head.is_branch();

    let upstream = head
        .resolve()
        .ok()
        .and_then(|h| h.target())
        .and_then(|oid| {
            repo.find_commit(oid).ok().and_then(|_| {
                repo.branch_upstream_name(&head.name().unwrap_or(""))
                    .ok()
                    .and_then(|b| b.as_str().map(|s| s.to_string()))
            })
        });

    let (ahead, behind) = if let Ok(local) = head.resolve() {
        if let Some(local_oid) = local.target() {
            if let Ok(upstream_ref) =
                repo.resolve_reference_from_short_name(&upstream.clone().unwrap_or_default())
            {
                if let Some(upstream_oid) = upstream_ref.target() {
                    repo.graph_ahead_behind(local_oid, upstream_oid)
                        .unwrap_or((0, 0))
                } else {
                    (0, 0)
                }
            } else {
                (0, 0)
            }
        } else {
            (0, 0)
        }
    } else {
        (0, 0)
    };

    let mut opts = StatusOptions::new();
    opts.include_untracked(true)
        .renames_head_to_index(true)
        .renames_index_to_workdir(true);

    let statuses = repo.statuses(Some(&mut opts)).map_err(map_git_error)?;
    let mut entries = Vec::new();

    for entry in statuses.iter() {
        let Some(path) = entry.path() else {
            continue;
        };

        let status = entry.status();
        let (status_str, status_code, is_staged, is_unstaged, original_path) =
            classify_status(status);

        entries.push(GitStatusEntry {
            path: path.to_string(),
            status: status_str,
            status_code,
            is_staged,
            is_unstaged,
            original_path,
        });
    }

    Ok(GitStatusSnapshot {
        repo: GitRepoInfo {
            repo_root: repo_path.to_string(),
            branch,
            upstream,
            is_detached,
        },
        changed_files: entries,
        ahead,
        behind,
    })
}

pub fn stage_files(repo_path: &str, paths: Vec<String>) -> Result<(), String> {
    let repo = Repository::open(repo_path).map_err(map_git_error)?;
    let mut index = repo.index().map_err(map_git_error)?;

    for path in paths {
        index
            .add_path(std::path::Path::new(&path))
            .map_err(map_git_error)?;
    }

    index.write().map_err(map_git_error)?;
    Ok(())
}

pub fn unstage_files(repo_path: &str, paths: Vec<String>) -> Result<(), String> {
    let repo = Repository::open(repo_path).map_err(map_git_error)?;
    let head = repo.head().map_err(map_git_error)?;
    let commit = repo
        .find_commit(head.target().ok_or("HEAD has no target")?)
        .map_err(map_git_error)?;
    let tree = commit.tree().map_err(map_git_error)?;

    let mut index = repo.index().map_err(map_git_error)?;

    for path in &paths {
        let path_obj = std::path::Path::new(path);
        if let Ok(entry) = tree.get_path(path_obj) {
            let index_entry = git2::IndexEntry {
                ctime: git2::IndexTime::new(0, 0),
                mtime: git2::IndexTime::new(0, 0),
                dev: 0,
                ino: 0,
                mode: entry.filemode() as u32,
                uid: 0,
                gid: 0,
                file_size: 0,
                id: entry.id(),
                flags: 0,
                flags_extended: 0,
                path: path.as_bytes().to_vec(),
            };
            index.add(&index_entry).map_err(map_git_error)?;
        } else {
            index.remove_path(path_obj).map_err(map_git_error)?;
        }
    }

    index.write().map_err(map_git_error)?;
    Ok(())
}

pub fn commit(repo_path: &str, message: String) -> Result<String, String> {
    let repo = Repository::open(repo_path).map_err(map_git_error)?;
    let sig = repo.signature().map_err(map_git_error)?;
    let mut index = repo.index().map_err(map_git_error)?;
    let tree_oid = index.write_tree_to(&repo).map_err(map_git_error)?;
    let tree = repo.find_tree(tree_oid).map_err(map_git_error)?;

    let head = repo.head().map_err(map_git_error)?;
    let parent = repo
        .find_commit(head.target().ok_or("HEAD has no target")?)
        .map_err(map_git_error)?;

    let commit_oid = repo
        .commit(Some("HEAD"), &sig, &sig, &message, &tree, &[&parent])
        .map_err(map_git_error)?;

    Ok(commit_oid.to_string())
}

pub fn get_file_diff(repo_path: &str, path: &str, staged: bool) -> Result<String, String> {
    let repo = Repository::open(repo_path).map_err(map_git_error)?;

    let diff = if staged {
        let head = repo.head().map_err(map_git_error)?;
        let commit = repo
            .find_commit(head.target().ok_or("HEAD has no target")?)
            .map_err(map_git_error)?;
        let head_tree = commit.tree().map_err(map_git_error)?;
        let mut index = repo.index().map_err(map_git_error)?;
        let index_tree_oid = index.write_tree_to(&repo).map_err(map_git_error)?;
        let index_tree = repo.find_tree(index_tree_oid).map_err(map_git_error)?;
        repo.diff_tree_to_tree(Some(&head_tree), Some(&index_tree), None)
    } else {
        repo.diff_index_to_workdir(None, None)
    }
    .map_err(map_git_error)?;

    let mut output = String::new();
    let mut file_matched = false;

    diff.print(git2::DiffFormat::Patch, |delta, _hunk, line| {
        if let Some(file_path) = delta.new_file().path().and_then(|p| p.to_str()) {
            if file_path == path {
                file_matched = true;
                let prefix = match line.origin() {
                    '+' => "+",
                    '-' => "-",
                    ' ' => " ",
                    _ => "",
                };
                output.push_str(prefix);
                output.push_str(std::str::from_utf8(line.content()).unwrap_or(""));
            }
        }
        true
    })
    .map_err(map_git_error)?;

    if !file_matched {
        return Ok("No diff available".to_string());
    }

    Ok(output)
}

fn classify_status(status: git2::Status) -> (String, String, bool, bool, Option<String>) {
    let is_staged = status.is_index_new()
        || status.is_index_modified()
        || status.is_index_deleted()
        || status.is_index_renamed()
        || status.is_index_typechange();

    let is_unstaged = status.is_wt_new()
        || status.is_wt_modified()
        || status.is_wt_deleted()
        || status.is_wt_renamed()
        || status.is_wt_typechange();

    let (status_str, code) = if status.is_index_new() || status.is_wt_new() {
        ("new", "A")
    } else if status.is_index_modified() || status.is_wt_modified() {
        ("modified", "M")
    } else if status.is_index_deleted() || status.is_wt_deleted() {
        ("deleted", "D")
    } else if status.is_index_renamed() || status.is_wt_renamed() {
        ("renamed", "R")
    } else if status.is_ignored() {
        ("ignored", "I")
    } else {
        ("other", "?")
    };

    let original_path = None;

    (
        status_str.to_string(),
        code.to_string(),
        is_staged,
        is_unstaged,
        original_path,
    )
}
