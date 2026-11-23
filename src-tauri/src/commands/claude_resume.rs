use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager, Runtime};

use crate::ai::subscription_usage::claude_config_path;

const PROJECTS_DIR: &str = "projects";
const MAX_SESSION_ID_LEN: usize = 64;
const MIN_SESSION_ID_LEN: usize = 8;

fn valid_session_id(id: &str) -> bool {
    (MIN_SESSION_ID_LEN..=MAX_SESSION_ID_LEN).contains(&id.len())
        && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
}

/// The folder Claude Code keeps an account's data in: the given one, else its default.
fn data_dir(config_dir: Option<&str>, env_dir: Option<&str>, home: &Path) -> PathBuf {
    match config_dir.or(env_dir).filter(|dir| !dir.is_empty()) {
        Some(dir) => PathBuf::from(dir),
        None => home.join(".claude"),
    }
}

/// An account folder Pragma may touch: absolute, and holding a Claude Code config.
fn account_dir(
    config_dir: Option<&str>,
    env_dir: Option<&str>,
    home: &Path,
) -> Result<PathBuf, String> {
    let chosen = config_dir.or(env_dir).filter(|dir| !dir.is_empty());
    if chosen.is_some_and(|dir| !Path::new(dir).is_absolute()) {
        return Err("The account folder must be an absolute path".to_string());
    }
    if !claude_config_path(chosen, home).is_file() {
        return Err("This folder holds no Claude Code account".to_string());
    }
    Ok(data_dir(config_dir, env_dir, home))
}

/// The transcript of a session in an account's `projects` folder, one folder per working directory.
fn find_transcript(data_dir: &Path, session_id: &str) -> Option<PathBuf> {
    let file = format!("{session_id}.jsonl");
    std::fs::read_dir(data_dir.join(PROJECTS_DIR))
        .ok()?
        .flatten()
        .map(|entry| entry.path().join(&file))
        .find(|path| path.is_file())
}

/// Makes a session's transcript visible to the other account, so `--resume` finds it there.
/// Folders that share `projects`, for example through a link, need no copy.
pub fn share_transcript(from: &Path, to: &Path, session_id: &str) -> Result<(), String> {
    if !valid_session_id(session_id) {
        return Err("Invalid session id".to_string());
    }
    let source = find_transcript(from, session_id)
        .ok_or_else(|| "The session's transcript was not found".to_string())?;
    let project = source
        .parent()
        .and_then(Path::file_name)
        .ok_or_else(|| "The session's transcript was not found".to_string())?;
    let target_dir = to.join(PROJECTS_DIR).join(project);
    let target = target_dir.join(format!("{session_id}.jsonl"));
    if target.is_file() {
        return Ok(());
    }
    std::fs::create_dir_all(&target_dir)
        .map_err(|error| format!("Could not prepare the other account: {error}"))?;
    std::fs::copy(&source, &target)
        .map(|_| ())
        .map_err(|error| format!("Could not copy the session: {error}"))
}

/// Lets another Claude Code account resume a session that ran under `from_dir`.
#[tauri::command]
pub async fn claude_session_share<R: Runtime>(
    app: AppHandle<R>,
    session_id: String,
    from_dir: Option<String>,
    to_dir: Option<String>,
) -> Result<(), String> {
    let home = app
        .path()
        .home_dir()
        .map_err(|error| format!("Could not resolve the home folder: {error}"))?;
    let env_dir = std::env::var("CLAUDE_CONFIG_DIR").ok();
    tauri::async_runtime::spawn_blocking(move || {
        let from = account_dir(from_dir.as_deref(), env_dir.as_deref(), &home)?;
        let to = account_dir(to_dir.as_deref(), env_dir.as_deref(), &home)?;
        share_transcript(&from, &to, &session_id)
    })
    .await
    .map_err(|error| format!("Could not share the session: {error}"))?
}

#[cfg(test)]
mod tests {
    use super::*;

    const ID: &str = "1ec907fa-5571-4205-a484-3dd5c94e9e2f";

    fn write_transcript(data_dir: &Path, project: &str) -> PathBuf {
        let dir = data_dir.join(PROJECTS_DIR).join(project);
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join(format!("{ID}.jsonl"));
        std::fs::write(&path, "{\"type\":\"user\"}\n").unwrap();
        path
    }

    #[test]
    fn copies_the_transcript_into_the_same_project_folder() {
        let home = tempfile::tempdir().unwrap();
        let from = home.path().join(".claude");
        let to = home.path().join(".claude-work");
        write_transcript(&from, "-Users-me-repo");

        share_transcript(&from, &to, ID).unwrap();
        let copied = to
            .join(PROJECTS_DIR)
            .join("-Users-me-repo")
            .join(format!("{ID}.jsonl"));
        assert_eq!(
            std::fs::read_to_string(copied).unwrap(),
            "{\"type\":\"user\"}\n"
        );
        // A second share finds the copy and leaves it alone.
        share_transcript(&from, &to, ID).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn shared_projects_folders_need_no_copy() {
        let home = tempfile::tempdir().unwrap();
        let from = home.path().join(".claude");
        let to = home.path().join(".claude-work");
        write_transcript(&from, "-Users-me-repo");
        std::fs::create_dir_all(&to).unwrap();
        std::os::unix::fs::symlink(from.join(PROJECTS_DIR), to.join(PROJECTS_DIR)).unwrap();

        share_transcript(&from, &to, ID).unwrap();
        let entries = std::fs::read_dir(from.join(PROJECTS_DIR).join("-Users-me-repo"))
            .unwrap()
            .count();
        assert_eq!(entries, 1);
    }

    #[test]
    fn refuses_odd_ids_and_missing_transcripts() {
        let home = tempfile::tempdir().unwrap();
        let from = home.path().join(".claude");
        let to = home.path().join(".claude-work");
        assert!(share_transcript(&from, &to, "../../etc/passwd").is_err());
        assert!(share_transcript(&from, &to, "short").is_err());
        assert!(share_transcript(&from, &to, ID).is_err());
    }

    #[test]
    fn only_folders_with_a_claude_config_count_as_accounts() {
        let home = tempfile::tempdir().unwrap();
        let work = home.path().join(".claude-work");
        std::fs::create_dir_all(&work).unwrap();
        assert!(account_dir(Some(work.to_str().unwrap()), None, home.path()).is_err());
        std::fs::write(work.join(".claude.json"), "{}").unwrap();
        assert_eq!(
            account_dir(Some(work.to_str().unwrap()), None, home.path()).unwrap(),
            work
        );
        assert!(account_dir(Some("relative/dir"), None, home.path()).is_err());

        assert!(account_dir(None, None, home.path()).is_err());
        std::fs::write(home.path().join(".claude.json"), "{}").unwrap();
        assert_eq!(
            account_dir(None, None, home.path()).unwrap(),
            home.path().join(".claude")
        );
    }
}
