use std::collections::HashSet;
use std::io::{BufRead, BufReader};
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

/// The ids of the messages in a transcript. Claude Code also appends housekeeping lines, for example
/// when it exits; those differ between accounts and say nothing about the conversation.
fn message_ids(transcript: &Path) -> std::io::Result<HashSet<String>> {
    let mut ids = HashSet::new();
    for line in BufReader::new(std::fs::File::open(transcript)?).split(b'\n') {
        let Ok(entry) = serde_json::from_slice::<serde_json::Value>(&line?) else {
            continue;
        };
        if !matches!(entry["type"].as_str(), Some("user" | "assistant")) {
            continue;
        }
        if let Some(id) = entry["uuid"].as_str() {
            ids.insert(id.to_string());
        }
    }
    Ok(ids)
}

/// Makes a session's transcript visible to the other account, so `--resume` finds it there.
/// Folders that share `projects`, for example through a link, need no copy. An older copy there is
/// brought up to date; one that went its own way is never overwritten.
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
        let same_file = matches!(
            (source.canonicalize(), target.canonicalize()),
            (Ok(a), Ok(b)) if a == b
        );
        if same_file {
            return Ok(());
        }
        let read_error = |error| format!("Could not read the session: {error}");
        let ours = message_ids(&source).map_err(read_error)?;
        let theirs = message_ids(&target).map_err(read_error)?;
        if !theirs.is_subset(&ours) {
            return Err("The other account went on with this conversation on its own".to_string());
        }
        if theirs.len() == ours.len() {
            return Ok(());
        }
    }
    std::fs::create_dir_all(&target_dir)
        .map_err(|error| format!("Could not prepare the other account: {error}"))?;
    // Copied beside the target first, so a failed copy never leaves half a conversation.
    let partial = target.with_extension("jsonl.pragma-partial");
    std::fs::copy(&source, &partial)
        .and_then(|_| std::fs::rename(&partial, &target))
        .map_err(|error| {
            let _ = std::fs::remove_file(&partial);
            format!("Could not copy the session: {error}")
        })
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

    fn append(path: &Path, lines: &str) {
        use std::io::Write;
        let mut file = std::fs::OpenOptions::new().append(true).open(path).unwrap();
        file.write_all(lines.as_bytes()).unwrap();
    }

    fn message(id: &str) -> String {
        format!("{{\"type\":\"assistant\",\"uuid\":\"{id}\"}}\n")
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

    #[test]
    fn handing_back_brings_the_work_of_the_other_account() {
        let home = tempfile::tempdir().unwrap();
        let first = home.path().join(".claude");
        let second = home.path().join(".claude-work");
        let original = write_transcript(&first, "-Users-me-repo");
        append(&original, &message("one"));

        share_transcript(&first, &second, ID).unwrap();
        // The first account's CLI writes these as it exits, after the copy was made.
        append(&original, "{\"type\":\"cost-state\"}\n");
        let copy = find_transcript(&second, ID).unwrap();
        append(&copy, &message("two"));

        share_transcript(&second, &first, ID).unwrap();
        assert_eq!(
            std::fs::read(&original).unwrap(),
            std::fs::read(&copy).unwrap()
        );
        let files = std::fs::read_dir(original.parent().unwrap())
            .unwrap()
            .count();
        assert_eq!(files, 1);
    }

    #[test]
    fn a_session_that_went_on_in_both_accounts_is_left_alone() {
        let home = tempfile::tempdir().unwrap();
        let first = home.path().join(".claude");
        let second = home.path().join(".claude-work");
        let original = write_transcript(&first, "-Users-me-repo");
        share_transcript(&first, &second, ID).unwrap();
        append(&original, &message("mine"));
        append(&find_transcript(&second, ID).unwrap(), &message("theirs"));

        let before = std::fs::read(&original).unwrap();
        assert!(share_transcript(&second, &first, ID).is_err());
        assert_eq!(std::fs::read(&original).unwrap(), before);
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
