use std::ffi::{OsStr, OsString};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::{mpsc, Arc};
use std::thread;
use std::time::Duration;

use shared_child::SharedChild;

use serde::Serialize;
use tauri::Manager;

use crate::commands::chat_storage::workspace_hash;
use crate::modules::git::process::run_git;
use crate::modules::git::types::{DEFAULT_TIMEOUT_SECS, MAX_TIMEOUT_SECS};

const NOT_A_REPO: &str = "This folder is not a git repository";

#[derive(Debug, Serialize)]
pub struct SessionRepoCheck {
    pub is_repo: bool,
    pub reason: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SessionWorktreeCreate {
    pub branch: String,
    pub path: String,
    pub setup_log: String,
    pub status: String,
}

#[derive(Debug, Serialize)]
pub struct SessionWorktreeTeardown {
    pub ok: bool,
    pub log: String,
}

async fn blocking<F, T>(f: F) -> Result<T, String>
where
    F: FnOnce() -> Result<T, String> + Send + 'static,
    T: Send + 'static,
{
    tauri::async_runtime::spawn_blocking(f)
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn git_session_repo_check(repo_path: String) -> Result<SessionRepoCheck, String> {
    if repo_path.is_empty() {
        return Err("Repository path is required".to_string());
    }
    blocking(move || Ok(repo_check(&repo_path))).await
}

#[tauri::command]
pub async fn git_session_worktree_create(
    app: tauri::AppHandle,
    repo_path: String,
    session_id: String,
) -> Result<SessionWorktreeCreate, String> {
    if repo_path.is_empty() {
        return Err("Repository path is required".to_string());
    }
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("failed to resolve app data dir: {e}"))?;
    blocking(move || create_worktree(&app_data_dir, &repo_path, &session_id)).await
}

#[tauri::command]
pub async fn git_session_worktree_dirty(path: String) -> Result<bool, String> {
    if path.is_empty() {
        return Err("Worktree path is required".to_string());
    }
    blocking(move || worktree_dirty(&path)).await
}

#[tauri::command]
pub async fn git_session_worktree_teardown(
    repo_path: String,
    worktree_path: String,
) -> Result<SessionWorktreeTeardown, String> {
    if repo_path.is_empty() {
        return Err("Repository path is required".to_string());
    }
    blocking(move || Ok(teardown(&repo_path, &worktree_path))).await
}

#[tauri::command]
pub async fn git_session_worktree_remove(
    repo_path: String,
    worktree_path: String,
    force: bool,
) -> Result<(), String> {
    if repo_path.is_empty() {
        return Err("Repository path is required".to_string());
    }
    blocking(move || remove_worktree(&repo_path, &worktree_path, force)).await
}

#[tauri::command]
pub async fn git_session_branch_merged(repo_path: String, branch: String) -> Result<bool, String> {
    if repo_path.is_empty() {
        return Err("Repository path is required".to_string());
    }
    blocking(move || branch_merged(&repo_path, &branch)).await
}

#[tauri::command]
pub async fn git_session_delete_branch(repo_path: String, branch: String) -> Result<(), String> {
    if repo_path.is_empty() {
        return Err("Repository path is required".to_string());
    }
    blocking(move || delete_branch(&repo_path, &branch)).await
}

pub(crate) fn repo_check(repo_path: &str) -> SessionRepoCheck {
    let not_repo = || SessionRepoCheck {
        is_repo: false,
        reason: Some(NOT_A_REPO.to_string()),
    };
    if repo_path.is_empty() || !Path::new(repo_path).is_dir() {
        return not_repo();
    }
    match run_git(
        Some(repo_path),
        ["rev-parse", "--is-inside-work-tree"],
        DEFAULT_TIMEOUT_SECS,
    ) {
        Ok(output) if output.exit_code == Some(0) => {
            if String::from_utf8_lossy(&output.stdout).trim() == "true" {
                SessionRepoCheck {
                    is_repo: true,
                    reason: None,
                }
            } else {
                not_repo()
            }
        }
        _ => not_repo(),
    }
}

pub(crate) fn worktree_dir(app_data_dir: &Path, repo_path: &str, session_id: &str) -> PathBuf {
    app_data_dir
        .join("worktrees")
        .join(workspace_hash(repo_path))
        .join(session_id)
}

fn validate_session_id(session_id: &str) -> Result<(), String> {
    let valid = !session_id.is_empty()
        && !session_id.contains("..")
        && session_id
            .chars()
            .all(|c| c.is_ascii_hexdigit() || c == '-');
    if !valid {
        return Err("Session id may only contain hex digits and hyphens".to_string());
    }
    Ok(())
}

fn branch_suffix(session_id: &str) -> Result<String, String> {
    let compact: String = session_id.chars().filter(|c| *c != '-').collect();
    if compact.is_empty() {
        return Err("Session id has no hex characters".to_string());
    }
    let start = compact.len().saturating_sub(8);
    Ok(compact[start..].to_ascii_lowercase())
}

fn branch_exists(repo_path: &str, branch: &str) -> Result<bool, String> {
    let reference = format!("refs/heads/{branch}");
    let output = run_git(
        Some(repo_path),
        [
            OsStr::new("show-ref"),
            OsStr::new("--verify"),
            OsStr::new("--quiet"),
            OsStr::new(&reference),
        ],
        DEFAULT_TIMEOUT_SECS,
    )?;
    if output.timed_out {
        return Err("git show-ref timed out".to_string());
    }
    Ok(output.exit_code == Some(0))
}

fn unique_branch(repo_path: &str, suffix: &str) -> Result<String, String> {
    let mut branch = format!("pragma/{suffix}");
    let mut counter = 2u32;
    while branch_exists(repo_path, &branch)? {
        branch = format!("pragma/{suffix}-{counter}");
        counter += 1;
        if counter > 1000 {
            return Err("could not find a free worktree branch name".to_string());
        }
    }
    Ok(branch)
}

fn canonical_existing_ancestor(path: &Path) -> Option<PathBuf> {
    let mut current = path;
    loop {
        if let Ok(canonical) = current.canonicalize() {
            return Some(canonical);
        }
        current = current.parent()?;
    }
}

fn executable(path: &Path) -> bool {
    let metadata = match std::fs::metadata(path) {
        Ok(metadata) => metadata,
        Err(_) => return false,
    };
    if !metadata.is_file() {
        return false;
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        metadata.permissions().mode() & 0o111 != 0
    }
    #[cfg(not(unix))]
    {
        true
    }
}

fn run_script(script: &Path, cwd: &Path) -> (bool, String) {
    let mut cmd = crate::platform::new_std_command_for_program(script);
    cmd.current_dir(cwd)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let child = match SharedChild::spawn(&mut cmd) {
        Ok(child) => Arc::new(child),
        Err(e) => return (false, format!("failed to run script: {e}")),
    };
    let mut stdout = match child.take_stdout() {
        Some(pipe) => pipe,
        None => return (false, "script has no stdout".to_string()),
    };
    let mut stderr = match child.take_stderr() {
        Some(pipe) => pipe,
        None => return (false, "script has no stderr".to_string()),
    };
    let stdout_handle = thread::spawn(move || {
        let mut buf = Vec::new();
        let _ = stdout.read_to_end(&mut buf);
        buf
    });
    let stderr_handle = thread::spawn(move || {
        let mut buf = Vec::new();
        let _ = stderr.read_to_end(&mut buf);
        buf
    });

    let (tx, rx) = mpsc::channel();
    let waiter = Arc::clone(&child);
    thread::spawn(move || {
        let _ = tx.send(waiter.wait());
    });

    match rx.recv_timeout(Duration::from_secs(MAX_TIMEOUT_SECS)) {
        Ok(Ok(status)) => {
            let out = stdout_handle.join().unwrap_or_default();
            let err = stderr_handle.join().unwrap_or_default();
            let mut log = String::from_utf8_lossy(&out).into_owned();
            log.push_str(&String::from_utf8_lossy(&err));
            (status.success(), log)
        }
        Ok(Err(e)) => (false, format!("failed to run script: {e}")),
        Err(_) => {
            let _ = child.kill();
            let _ = child.wait();
            (false, "script timed out".to_string())
        }
    }
}

pub(crate) fn create_worktree(
    app_data_dir: &Path,
    repo_path: &str,
    session_id: &str,
) -> Result<SessionWorktreeCreate, String> {
    validate_session_id(session_id)?;

    let repo_canonical = Path::new(repo_path)
        .canonicalize()
        .map_err(|e| format!("failed to resolve repository path: {e}"))?;
    if !repo_canonical.is_dir() {
        return Err("Repository path is not a directory".to_string());
    }

    let path = worktree_dir(app_data_dir, repo_path, session_id);
    // The worktree must stay outside the user's checkout even if app data was relocated.
    if let Some(existing) = canonical_existing_ancestor(&path) {
        if existing.starts_with(&repo_canonical) {
            return Err("Worktree path would be inside the repository".to_string());
        }
    }

    let suffix = branch_suffix(session_id)?;
    let branch = unique_branch(repo_path, &suffix)?;

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("failed to create worktrees dir: {e}"))?;
    }
    let path_str = path.to_string_lossy().to_string();
    let output = run_git(
        Some(repo_path),
        [
            OsStr::new("worktree"),
            OsStr::new("add"),
            OsStr::new("-b"),
            OsStr::new(&branch),
            OsStr::new(&path_str),
            OsStr::new("HEAD"),
        ],
        DEFAULT_TIMEOUT_SECS,
    )?;
    if output.timed_out {
        return Err("git worktree add timed out".to_string());
    }
    if output.exit_code != Some(0) {
        return Err(format!(
            "git worktree add failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }

    let setup_script = Path::new(repo_path).join(".pragma").join("worktree-setup");
    let (status, setup_log) = if executable(&setup_script) {
        let (ok, log) = run_script(&setup_script, &path);
        if ok {
            ("ready".to_string(), log)
        } else {
            ("error".to_string(), log)
        }
    } else {
        ("ready".to_string(), String::new())
    };

    Ok(SessionWorktreeCreate {
        branch,
        path: path_str,
        setup_log,
        status,
    })
}

pub(crate) fn worktree_dirty(worktree_path: &str) -> Result<bool, String> {
    if worktree_path.is_empty() {
        return Err("Worktree path is required".to_string());
    }
    let output = run_git(
        Some(worktree_path),
        ["status", "--porcelain"],
        DEFAULT_TIMEOUT_SECS,
    )?;
    if output.timed_out {
        return Err("git status timed out".to_string());
    }
    if output.exit_code != Some(0) {
        return Err(format!(
            "git status failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    Ok(!String::from_utf8_lossy(&output.stdout).trim().is_empty())
}

pub(crate) fn teardown(repo_path: &str, worktree_path: &str) -> SessionWorktreeTeardown {
    let script = Path::new(repo_path)
        .join(".pragma")
        .join("worktree-teardown");
    if !executable(&script) {
        return SessionWorktreeTeardown {
            ok: true,
            log: String::new(),
        };
    }
    let (ok, log) = run_script(&script, Path::new(worktree_path));
    SessionWorktreeTeardown { ok, log }
}

pub(crate) fn remove_worktree(
    repo_path: &str,
    worktree_path: &str,
    force: bool,
) -> Result<(), String> {
    let mut args: Vec<OsString> = vec!["worktree".into(), "remove".into()];
    if force {
        args.push("--force".into());
    }
    args.push(worktree_path.into());
    let output = run_git(Some(repo_path), args, DEFAULT_TIMEOUT_SECS)?;
    if output.timed_out {
        return Err("git worktree remove timed out".to_string());
    }
    if output.exit_code != Some(0) {
        return Err(format!(
            "git worktree remove failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    Ok(())
}

pub(crate) fn branch_merged(repo_path: &str, branch: &str) -> Result<bool, String> {
    if branch.is_empty() {
        return Err("Branch name is required".to_string());
    }
    let output = run_git(
        Some(repo_path),
        ["merge-base", "--is-ancestor", branch, "HEAD"],
        DEFAULT_TIMEOUT_SECS,
    )?;
    if output.timed_out {
        return Err("git merge-base timed out".to_string());
    }
    Ok(output.exit_code == Some(0))
}

fn is_pragma_branch(branch: &str) -> bool {
    let Some(rest) = branch.strip_prefix("pragma/") else {
        return false;
    };
    let (hex, counter) = match rest.split_once('-') {
        Some((hex, counter)) => (hex, Some(counter)),
        None => (rest, None),
    };
    if hex.len() != 8
        || !hex
            .chars()
            .all(|c| c.is_ascii_digit() || ('a'..='f').contains(&c))
    {
        return false;
    }
    match counter {
        None => true,
        Some(counter) => !counter.is_empty() && counter.chars().all(|c| c.is_ascii_digit()),
    }
}

pub(crate) fn delete_branch(repo_path: &str, branch: &str) -> Result<(), String> {
    if !is_pragma_branch(branch) {
        return Err("Only pragma worktree branches can be deleted".to_string());
    }
    let output = run_git(
        Some(repo_path),
        ["branch", "-D", branch],
        DEFAULT_TIMEOUT_SECS,
    )?;
    if output.timed_out {
        return Err("git branch -D timed out".to_string());
    }
    if output.exit_code != Some(0) {
        return Err(format!(
            "git branch -D failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    const SESSION_A: &str = "11111111-1111-1111-1111-111111111111";
    const SESSION_B: &str = "22222222-1111-1111-1111-111111111111";

    fn git(dir: &str, args: &[&str]) {
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

    fn make_executable(path: &Path) {
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut permissions = std::fs::metadata(path).expect("metadata").permissions();
            permissions.set_mode(0o755);
            std::fs::set_permissions(path, permissions).expect("chmod");
        }
        #[cfg(not(unix))]
        {
            let _ = path;
        }
    }

    #[test]
    fn repo_check_rejects_non_repo() {
        let dir = tempfile::tempdir().expect("tempdir");
        let check = repo_check(&dir.path().to_string_lossy());
        assert!(!check.is_repo);
        assert_eq!(
            check.reason.as_deref(),
            Some("This folder is not a git repository")
        );
    }

    #[test]
    fn create_worktree_uses_pragma_branch_and_isolates_files() {
        let (_repo, repo_path) = init_repo();
        let app_data = tempfile::tempdir().expect("tempdir");

        let created = create_worktree(app_data.path(), &repo_path, SESSION_A).expect("create");
        assert_eq!(created.branch, "pragma/11111111");
        assert_eq!(created.status, "ready");
        assert!(Path::new(&created.path).starts_with(app_data.path()));

        std::fs::write(Path::new(&created.path).join("session.txt"), b"work").expect("write");

        let output = run_git(Some(&repo_path), ["status", "--porcelain"], 30).expect("status");
        assert!(String::from_utf8_lossy(&output.stdout).trim().is_empty());
    }

    #[test]
    fn second_worktree_with_same_suffix_gets_counter() {
        let (_repo, repo_path) = init_repo();
        let app_data = tempfile::tempdir().expect("tempdir");

        let first = create_worktree(app_data.path(), &repo_path, SESSION_A).expect("first");
        let second = create_worktree(app_data.path(), &repo_path, SESSION_B).expect("second");

        assert_eq!(first.branch, "pragma/11111111");
        assert_eq!(second.branch, "pragma/11111111-2");
    }

    #[test]
    fn worktree_dirty_tracks_untracked_files() {
        let (_repo, repo_path) = init_repo();
        let app_data = tempfile::tempdir().expect("tempdir");
        let created = create_worktree(app_data.path(), &repo_path, SESSION_A).expect("create");

        assert!(!worktree_dirty(&created.path).expect("dirty"));
        std::fs::write(Path::new(&created.path).join("new.txt"), b"x").expect("write");
        assert!(worktree_dirty(&created.path).expect("dirty"));
    }

    #[test]
    fn remove_requires_force_when_dirty() {
        let (_repo, repo_path) = init_repo();
        let app_data = tempfile::tempdir().expect("tempdir");

        let clean = create_worktree(app_data.path(), &repo_path, SESSION_A).expect("create");
        remove_worktree(&repo_path, &clean.path, false).expect("remove clean");
        assert!(!Path::new(&clean.path).exists());

        let dirty = create_worktree(app_data.path(), &repo_path, SESSION_B).expect("create");
        std::fs::write(Path::new(&dirty.path).join("dirty.txt"), b"x").expect("write");
        assert!(remove_worktree(&repo_path, &dirty.path, false).is_err());
        assert!(Path::new(&dirty.path).exists());

        remove_worktree(&repo_path, &dirty.path, true).expect("force remove");
        assert!(!Path::new(&dirty.path).exists());
    }

    #[test]
    fn setup_failure_marks_error_and_keeps_worktree() {
        let (_repo, repo_path) = init_repo();
        let app_data = tempfile::tempdir().expect("tempdir");
        let pragma = Path::new(&repo_path).join(".pragma");
        std::fs::create_dir_all(&pragma).expect("mkdir");
        let script = pragma.join("worktree-setup");
        std::fs::write(&script, b"#!/bin/sh\nexit 1\n").expect("write script");
        make_executable(&script);

        let created = create_worktree(app_data.path(), &repo_path, SESSION_A).expect("create");
        assert_eq!(created.status, "error");
        assert!(Path::new(&created.path).exists());
    }

    #[test]
    fn teardown_failure_keeps_worktree() {
        let (_repo, repo_path) = init_repo();
        let app_data = tempfile::tempdir().expect("tempdir");
        let created = create_worktree(app_data.path(), &repo_path, SESSION_A).expect("create");

        let pragma = Path::new(&repo_path).join(".pragma");
        std::fs::create_dir_all(&pragma).expect("mkdir");
        let script = pragma.join("worktree-teardown");
        std::fs::write(&script, b"#!/bin/sh\nexit 1\n").expect("write script");
        make_executable(&script);

        let result = teardown(&repo_path, &created.path);
        assert!(!result.ok);
        assert!(Path::new(&created.path).exists());
    }

    #[test]
    fn delete_branch_rejects_main() {
        let (_repo, repo_path) = init_repo();
        assert!(delete_branch(&repo_path, "main").is_err());
    }

    #[test]
    fn legacy_session_metadata_without_worktree_fields_deserializes() {
        let json = r#"{"id":"s1","title":"t","created_at":1,"updated_at":2}"#;
        let session: crate::commands::chat_storage::ChatSessionMetadata =
            serde_json::from_str(json).expect("deserialize");
        assert!(session.kind.is_empty());
        assert!(session.environment.is_empty());
        assert!(session.worktree.is_none());
    }
}
