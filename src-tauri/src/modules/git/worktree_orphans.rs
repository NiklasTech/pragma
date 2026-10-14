use std::collections::HashSet;
use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::Manager;

use crate::commands::chat_storage::sessions_dir;
use crate::commands::work_environments::{environments_file, load_environments, WorkEnvironment};
use crate::modules::git::process::run_git;
use crate::modules::git::types::DEFAULT_TIMEOUT_SECS;
use crate::modules::git::worktree::{
    repo_check, validate_environment_id, worktree_dirty, worktrees_root,
};

/// A session worktree of the workspace that no work environment references anymore.
#[derive(Debug, PartialEq, Serialize)]
pub struct OrphanWorktree {
    pub id: String,
    pub path: String,
    pub branch: Option<String>,
    pub dirty: bool,
}

struct RegisteredWorktree {
    path: PathBuf,
    branch: Option<String>,
}

#[tauri::command]
pub async fn git_session_worktree_orphans(
    app: tauri::AppHandle,
    repo_path: String,
) -> Result<Vec<OrphanWorktree>, String> {
    if repo_path.is_empty() {
        return Err("Repository path is required".to_string());
    }
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("failed to resolve app data dir: {e}"))?;
    let environments =
        load_environments(&environments_file(&sessions_dir(&app, &repo_path)?)).await?;
    tauri::async_runtime::spawn_blocking(move || {
        find_orphans(&app_data_dir, &repo_path, &environments)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Prunes stale worktree entries and lists the worktrees under the workspace's worktree directory
/// that no environment references.
pub(crate) fn find_orphans(
    app_data_dir: &Path,
    repo_path: &str,
    environments: &[WorkEnvironment],
) -> Result<Vec<OrphanWorktree>, String> {
    if !repo_check(repo_path).is_repo {
        return Ok(Vec::new());
    }
    prune(repo_path)?;
    let Ok(root) = worktrees_root(app_data_dir, repo_path).canonicalize() else {
        return Ok(Vec::new());
    };

    let registered = registered_worktrees(repo_path)?;
    let referenced_ids: HashSet<&str> = environments.iter().map(|item| item.id.as_str()).collect();
    let referenced_paths: HashSet<PathBuf> = environments
        .iter()
        .map(|item| {
            let path = Path::new(&item.path);
            path.canonicalize().unwrap_or_else(|_| path.to_path_buf())
        })
        .collect();

    let entries =
        std::fs::read_dir(&root).map_err(|e| format!("failed to read worktrees dir: {e}"))?;
    let mut orphans = Vec::new();
    for entry in entries.flatten() {
        let id = entry.file_name().to_string_lossy().to_string();
        if validate_environment_id(&id).is_err() || referenced_ids.contains(id.as_str()) {
            continue;
        }
        let Ok(path) = worktree_in_root(&root, &entry.path()) else {
            continue;
        };
        if referenced_paths.contains(&path) {
            continue;
        }
        // Only directories git still lists as worktrees of this repository can be removed.
        let Some(worktree) = registered.iter().find(|item| item.path == path) else {
            continue;
        };
        let path_str = path.to_string_lossy().to_string();
        let Ok(dirty) = worktree_dirty(&path_str) else {
            continue;
        };
        orphans.push(OrphanWorktree {
            id,
            path: path_str,
            branch: worktree.branch.clone(),
            dirty,
        });
    }
    orphans.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(orphans)
}

/// The canonical path of a worktree, rejected unless it is a real directory inside `root`.
pub(crate) fn worktree_in_root(root: &Path, path: &Path) -> Result<PathBuf, String> {
    let outside = || Err("Path is outside the workspace's worktree directory".to_string());
    let metadata =
        std::fs::symlink_metadata(path).map_err(|e| format!("failed to read worktree: {e}"))?;
    if !metadata.is_dir() {
        return outside();
    }
    let canonical = path
        .canonicalize()
        .map_err(|e| format!("failed to resolve worktree path: {e}"))?;
    if canonical == root || !canonical.starts_with(root) {
        return outside();
    }
    Ok(canonical)
}

fn prune(repo_path: &str) -> Result<(), String> {
    let output = run_git(Some(repo_path), ["worktree", "prune"], DEFAULT_TIMEOUT_SECS)?;
    if output.timed_out {
        return Err("git worktree prune timed out".to_string());
    }
    if output.exit_code != Some(0) {
        return Err(format!(
            "git worktree prune failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    Ok(())
}

fn registered_worktrees(repo_path: &str) -> Result<Vec<RegisteredWorktree>, String> {
    let output = run_git(
        Some(repo_path),
        ["worktree", "list", "--porcelain"],
        DEFAULT_TIMEOUT_SECS,
    )?;
    if output.timed_out {
        return Err("git worktree list timed out".to_string());
    }
    if output.exit_code != Some(0) {
        return Err(format!(
            "git worktree list failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    Ok(parse_worktree_list(&String::from_utf8_lossy(
        &output.stdout,
    )))
}

fn parse_worktree_list(porcelain: &str) -> Vec<RegisteredWorktree> {
    let mut worktrees: Vec<RegisteredWorktree> = Vec::new();
    for line in porcelain.lines() {
        if let Some(path) = line.strip_prefix("worktree ") {
            let path = Path::new(path);
            worktrees.push(RegisteredWorktree {
                path: path.canonicalize().unwrap_or_else(|_| path.to_path_buf()),
                branch: None,
            });
        } else if let Some(reference) = line.strip_prefix("branch ") {
            if let Some(last) = worktrees.last_mut() {
                let branch = reference.strip_prefix("refs/heads/").unwrap_or(reference);
                last.branch = Some(branch.to_string());
            }
        }
    }
    worktrees
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modules::git::worktree::create_worktree;

    const ENVIRONMENT_A: &str = "11111111-1111-1111-1111-111111111111";
    const ENVIRONMENT_B: &str = "22222222-1111-1111-1111-111111111111";
    const ENVIRONMENT_C: &str = "33333333-1111-1111-1111-111111111111";

    fn git(dir: &str, args: &[&str]) -> String {
        let output = std::process::Command::new("git")
            .args(args)
            .current_dir(dir)
            .output()
            .expect("spawn git");
        assert!(
            output.status.success(),
            "git {args:?} failed: {}",
            String::from_utf8_lossy(&output.stderr)
        );
        String::from_utf8_lossy(&output.stdout).into_owned()
    }

    fn init_repo() -> (tempfile::TempDir, String) {
        let dir = tempfile::tempdir().expect("tempdir");
        let path = dir.path().to_string_lossy().to_string();
        git(&path, &["init"]);
        git(
            &path,
            &[
                "-c",
                "user.email=test@example.com",
                "-c",
                "user.name=Pragma Test",
                "-c",
                "core.hooksPath=",
                "commit",
                "--allow-empty",
                "-m",
                "init",
            ],
        );
        (dir, path)
    }

    fn environment(id: &str, path: &str) -> WorkEnvironment {
        WorkEnvironment {
            id: id.to_string(),
            kind: "worktree".to_string(),
            path: path.to_string(),
            branch: "pragma/11111111".to_string(),
            base_branch: None,
            setup_status: "ready".to_string(),
            setup_log: String::new(),
            pull_request: None,
        }
    }

    #[test]
    fn lists_unreferenced_worktrees_with_their_dirty_state() {
        let (_repo, repo_path) = init_repo();
        let app_data = tempfile::tempdir().expect("tempdir");
        let kept = create_worktree(app_data.path(), &repo_path, ENVIRONMENT_A, None, true)
            .expect("create kept");
        let clean = create_worktree(app_data.path(), &repo_path, ENVIRONMENT_B, None, true)
            .expect("create clean");
        let dirty = create_worktree(app_data.path(), &repo_path, ENVIRONMENT_C, None, true)
            .expect("create dirty");
        std::fs::write(Path::new(&dirty.path).join("work.txt"), b"x").expect("write");

        let orphans = find_orphans(
            app_data.path(),
            &repo_path,
            &[environment(ENVIRONMENT_A, &kept.path)],
        )
        .expect("orphans");

        let canonical = |path: &str| Path::new(path).canonicalize().expect("canonicalize");
        assert_eq!(orphans.len(), 2);
        assert_eq!(orphans[0].id, ENVIRONMENT_B);
        assert_eq!(Path::new(&orphans[0].path), canonical(&clean.path));
        assert_eq!(orphans[0].branch.as_deref(), Some(clean.branch.as_str()));
        assert!(!orphans[0].dirty);
        assert_eq!(orphans[1].id, ENVIRONMENT_C);
        assert!(orphans[1].dirty);
    }

    #[test]
    fn an_environment_references_a_worktree_by_id_or_by_path() {
        let (_repo, repo_path) = init_repo();
        let app_data = tempfile::tempdir().expect("tempdir");
        create_worktree(app_data.path(), &repo_path, ENVIRONMENT_A, None, true).expect("create");
        let legacy = create_worktree(app_data.path(), &repo_path, ENVIRONMENT_B, None, true)
            .expect("create legacy");

        let orphans = find_orphans(
            app_data.path(),
            &repo_path,
            &[
                environment(ENVIRONMENT_A, "/moved/elsewhere"),
                environment(ENVIRONMENT_C, &legacy.path),
            ],
        )
        .expect("orphans");

        assert!(orphans.is_empty(), "{orphans:?}");
    }

    #[test]
    fn prunes_worktrees_whose_directory_is_gone() {
        let (_repo, repo_path) = init_repo();
        let app_data = tempfile::tempdir().expect("tempdir");
        let created = create_worktree(app_data.path(), &repo_path, ENVIRONMENT_A, None, true)
            .expect("create");
        std::fs::remove_dir_all(&created.path).expect("remove dir");

        let orphans = find_orphans(app_data.path(), &repo_path, &[]).expect("orphans");

        assert!(orphans.is_empty());
        let list = git(&repo_path, &["worktree", "list", "--porcelain"]);
        assert!(!list.contains(ENVIRONMENT_A), "{list}");
    }

    #[test]
    fn skips_directories_that_are_not_session_worktrees() {
        let (_repo, repo_path) = init_repo();
        let app_data = tempfile::tempdir().expect("tempdir");
        create_worktree(app_data.path(), &repo_path, ENVIRONMENT_A, None, true).expect("create");
        let root = worktrees_root(app_data.path(), &repo_path);
        std::fs::create_dir(root.join(ENVIRONMENT_B)).expect("mkdir unregistered");
        std::fs::create_dir(root.join("notes")).expect("mkdir notes");
        std::fs::write(root.join(ENVIRONMENT_C), b"file").expect("write file");

        let orphans = find_orphans(app_data.path(), &repo_path, &[]).expect("orphans");

        assert_eq!(orphans.len(), 1);
        assert_eq!(orphans[0].id, ENVIRONMENT_A);
    }

    #[test]
    fn returns_nothing_outside_a_repository_or_without_worktrees() {
        let app_data = tempfile::tempdir().expect("tempdir");
        let plain = tempfile::tempdir().expect("tempdir");
        assert!(
            find_orphans(app_data.path(), &plain.path().to_string_lossy(), &[])
                .expect("not a repo")
                .is_empty()
        );

        let (_repo, repo_path) = init_repo();
        assert!(find_orphans(app_data.path(), &repo_path, &[])
            .expect("no worktrees")
            .is_empty());
    }

    #[test]
    fn rejects_paths_outside_the_worktree_directory() {
        let base = tempfile::tempdir().expect("tempdir");
        let root = base.path().join("root");
        let inside = root.join(ENVIRONMENT_A);
        let outside = base.path().join("outside");
        std::fs::create_dir_all(&inside).expect("mkdir inside");
        std::fs::create_dir_all(&outside).expect("mkdir outside");
        let root = root.canonicalize().expect("canonicalize");

        assert_eq!(
            worktree_in_root(&root, &inside).expect("inside"),
            inside.canonicalize().expect("canonicalize")
        );
        assert!(worktree_in_root(&root, &root).is_err());
        assert!(worktree_in_root(&root, &outside).is_err());
        assert!(worktree_in_root(&root, &root.join("..").join("outside")).is_err());
        assert!(worktree_in_root(&root, &root.join("missing")).is_err());
    }

    #[cfg(unix)]
    #[test]
    fn rejects_a_symlink_that_leads_out_of_the_worktree_directory() {
        let (_repo, repo_path) = init_repo();
        let app_data = tempfile::tempdir().expect("tempdir");
        let created = create_worktree(app_data.path(), &repo_path, ENVIRONMENT_A, None, true)
            .expect("create");
        let foreign = app_data.path().join("foreign");
        std::fs::rename(&created.path, &foreign).expect("move worktree");
        git(
            &repo_path,
            &["worktree", "repair", &foreign.to_string_lossy()],
        );
        let link = worktrees_root(app_data.path(), &repo_path).join(ENVIRONMENT_B);
        std::os::unix::fs::symlink(&foreign, &link).expect("symlink");

        assert!(worktree_in_root(
            &worktrees_root(app_data.path(), &repo_path)
                .canonicalize()
                .expect("canonicalize"),
            &link
        )
        .is_err());
        let orphans = find_orphans(app_data.path(), &repo_path, &[]).expect("orphans");
        assert!(orphans.is_empty(), "{orphans:?}");
    }

    #[test]
    fn parses_branches_and_detached_heads_from_the_worktree_list() {
        let parsed = parse_worktree_list(
            "worktree /repo\nHEAD abc\nbranch refs/heads/main\n\n\
             worktree /data/a\nHEAD def\nbranch refs/heads/pragma/11111111\n\n\
             worktree /data/b\nHEAD 123\ndetached\n",
        );
        let branches: Vec<Option<&str>> =
            parsed.iter().map(|item| item.branch.as_deref()).collect();
        assert_eq!(branches, vec![Some("main"), Some("pragma/11111111"), None]);
        assert_eq!(parsed[1].path, PathBuf::from("/data/a"));
    }
}
