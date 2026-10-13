use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use super::chat_storage::{
    save_session, sessions_dir, validate_session_id, write_file, ChatSessionMetadata,
    SESSION_IO_LOCK,
};
use crate::modules::git::worktree::validate_environment_id;

const ENVIRONMENTS_FILE: &str = "environments.json";
const KINDS: &[&str] = &["checkout", "worktree"];
const SETUP_STATUSES: &[&str] = &["ready", "error"];

/// A checkout or worktree that one or more sessions of a workspace work in.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct WorkEnvironment {
    pub id: String,
    pub kind: String,
    pub path: String,
    #[serde(default)]
    pub branch: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub base_branch: Option<String>,
    pub setup_status: String,
    #[serde(default)]
    pub setup_log: String,
}

#[derive(Debug, Deserialize)]
pub struct LoadEnvironmentsRequest {
    pub root_path: String,
}

#[derive(Debug, Deserialize)]
pub struct SaveEnvironmentRequest {
    pub root_path: String,
    pub environment: WorkEnvironment,
}

#[derive(Debug, Deserialize)]
pub struct DeleteEnvironmentRequest {
    pub root_path: String,
    pub environment_id: String,
}

fn environments_file(sessions_dir: &Path) -> PathBuf {
    sessions_dir.join(ENVIRONMENTS_FILE)
}

fn validate_environment(environment: &WorkEnvironment) -> Result<(), String> {
    validate_environment_id(&environment.id)?;
    if !KINDS.contains(&environment.kind.as_str()) {
        return Err(format!("unknown environment kind: {}", environment.kind));
    }
    if !SETUP_STATUSES.contains(&environment.setup_status.as_str()) {
        return Err(format!(
            "unknown environment setup status: {}",
            environment.setup_status
        ));
    }
    if environment.path.is_empty() {
        return Err("Environment path is required".to_string());
    }
    if environment.kind == "worktree" && environment.branch.is_empty() {
        return Err("A worktree environment needs a branch".to_string());
    }
    Ok(())
}

async fn load_environments(file: &Path) -> Result<Vec<WorkEnvironment>, String> {
    let content = match tokio::fs::read_to_string(file).await {
        Ok(content) => content,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(e) => return Err(format!("failed to read environments: {e}")),
    };
    if content.trim().is_empty() {
        return Ok(Vec::new());
    }
    serde_json::from_str(&content).map_err(|e| format!("failed to parse environments: {e}"))
}

async fn write_environments(file: &Path, environments: &[WorkEnvironment]) -> Result<(), String> {
    let content = serde_json::to_string_pretty(environments)
        .map_err(|e| format!("failed to serialize environments: {e}"))?;
    write_file(file, content.as_bytes()).await
}

async fn upsert_environment(file: &Path, environment: WorkEnvironment) -> Result<(), String> {
    let mut environments = load_environments(file).await?;
    match environments
        .iter_mut()
        .find(|item| item.id == environment.id)
    {
        Some(existing) => *existing = environment,
        None => environments.push(environment),
    }
    write_environments(file, &environments).await
}

async fn remove_environment(file: &Path, environment_id: &str) -> Result<(), String> {
    let mut environments = load_environments(file).await?;
    let before = environments.len();
    environments.retain(|item| item.id != environment_id);
    if environments.len() == before {
        return Ok(());
    }
    write_environments(file, &environments).await
}

/// Moves each legacy session worktree into an environment named after the session.
pub(crate) async fn migrate_session_worktrees(
    sessions_dir: &Path,
    sessions: &mut [ChatSessionMetadata],
) -> Result<(), String> {
    let file = environments_file(sessions_dir);
    let mut environments = load_environments(&file).await?;
    let mut migrated = Vec::new();

    for (index, session) in sessions.iter_mut().enumerate() {
        if validate_session_id(&session.id).is_err() {
            continue;
        }
        let Some(worktree) = session.worktree.take() else {
            continue;
        };
        let id = session
            .environment_id
            .clone()
            .unwrap_or_else(|| session.id.clone());
        if !environments.iter().any(|item| item.id == id) {
            environments.push(WorkEnvironment {
                id: id.clone(),
                kind: "worktree".to_string(),
                path: worktree.path,
                branch: worktree.branch,
                base_branch: None,
                setup_status: worktree.status,
                setup_log: worktree.setup_log,
            });
        }
        session.environment_id = Some(id);
        migrated.push(index);
    }

    if migrated.is_empty() {
        return Ok(());
    }
    // Environments first, so an interrupted migration still finds them on the next load.
    write_environments(&file, &environments).await?;
    for index in migrated {
        let session = &sessions[index];
        save_session(&sessions_dir.join(&session.id), session).await?;
    }
    Ok(())
}

#[tauri::command]
pub async fn ai_load_environments(
    app: AppHandle,
    req: LoadEnvironmentsRequest,
) -> Result<Vec<WorkEnvironment>, String> {
    let dir = sessions_dir(&app, &req.root_path)?;
    load_environments(&environments_file(&dir)).await
}

#[tauri::command]
pub async fn ai_save_environment(
    app: AppHandle,
    req: SaveEnvironmentRequest,
) -> Result<(), String> {
    validate_environment(&req.environment)?;
    let _guard = SESSION_IO_LOCK.lock().await;
    let dir = sessions_dir(&app, &req.root_path)?;
    upsert_environment(&environments_file(&dir), req.environment).await
}

#[tauri::command]
pub async fn ai_delete_environment(
    app: AppHandle,
    req: DeleteEnvironmentRequest,
) -> Result<(), String> {
    validate_environment_id(&req.environment_id)?;
    let _guard = SESSION_IO_LOCK.lock().await;
    let dir = sessions_dir(&app, &req.root_path)?;
    remove_environment(&environments_file(&dir), &req.environment_id).await
}

#[cfg(test)]
mod tests {
    use super::super::chat_storage::load_sessions;
    use super::*;

    const ENVIRONMENT_ID: &str = "11111111-2222-3333-4444-555555555555";
    const SESSION_ID: &str = "aaaaaaaa-2222-3333-4444-555555555555";

    fn worktree_environment(id: &str, path: &str) -> WorkEnvironment {
        WorkEnvironment {
            id: id.to_string(),
            kind: "worktree".to_string(),
            path: path.to_string(),
            branch: "pragma/11111111".to_string(),
            base_branch: Some("main".to_string()),
            setup_status: "ready".to_string(),
            setup_log: String::new(),
        }
    }

    fn legacy_session(id: &str) -> serde_json::Value {
        serde_json::json!({
            "id": id,
            "title": "Legacy",
            "created_at": 1,
            "updated_at": 2,
            "kind": "agent",
            "environment": "worktree",
            "worktree": {
                "branch": "pragma/aaaaaaaa",
                "path": "/data/worktrees/hash/aaaaaaaa",
                "setup_log": "installed",
                "status": "ready"
            }
        })
    }

    #[tokio::test]
    async fn environments_load_empty_when_nothing_is_stored() {
        let dir = tempfile::tempdir().unwrap();
        let file = environments_file(dir.path());
        assert!(load_environments(&file).await.unwrap().is_empty());

        std::fs::write(&file, "  ").unwrap();
        assert!(load_environments(&file).await.unwrap().is_empty());
    }

    #[tokio::test]
    async fn saved_environments_round_trip_and_replace_by_id() {
        let dir = tempfile::tempdir().unwrap();
        let file = environments_file(dir.path());
        let first = worktree_environment(ENVIRONMENT_ID, "/wt/one");
        let other = worktree_environment("22222222-2222-3333-4444-555555555555", "/wt/two");

        upsert_environment(&file, first.clone()).await.unwrap();
        upsert_environment(&file, other.clone()).await.unwrap();
        let updated = WorkEnvironment {
            setup_status: "error".to_string(),
            setup_log: "failed".to_string(),
            ..first
        };
        upsert_environment(&file, updated.clone()).await.unwrap();

        assert_eq!(
            load_environments(&file).await.unwrap(),
            vec![updated, other]
        );
    }

    #[tokio::test]
    async fn removing_an_environment_keeps_the_others() {
        let dir = tempfile::tempdir().unwrap();
        let file = environments_file(dir.path());
        let keep = worktree_environment("22222222-2222-3333-4444-555555555555", "/wt/two");
        upsert_environment(&file, worktree_environment(ENVIRONMENT_ID, "/wt/one"))
            .await
            .unwrap();
        upsert_environment(&file, keep.clone()).await.unwrap();

        remove_environment(&file, ENVIRONMENT_ID).await.unwrap();
        remove_environment(&file, ENVIRONMENT_ID).await.unwrap();

        assert_eq!(load_environments(&file).await.unwrap(), vec![keep]);
    }

    #[tokio::test]
    async fn corrupt_environments_file_is_an_error() {
        let dir = tempfile::tempdir().unwrap();
        let file = environments_file(dir.path());
        std::fs::write(&file, "{broken").unwrap();

        assert!(load_environments(&file)
            .await
            .unwrap_err()
            .starts_with("failed to parse environments"));
    }

    #[test]
    fn environments_are_validated() {
        let valid = worktree_environment(ENVIRONMENT_ID, "/wt/one");
        assert!(validate_environment(&valid).is_ok());

        let checkout = WorkEnvironment {
            kind: "checkout".to_string(),
            branch: String::new(),
            ..valid.clone()
        };
        assert!(validate_environment(&checkout).is_ok());

        for invalid in [
            WorkEnvironment {
                id: "../escape".to_string(),
                ..valid.clone()
            },
            WorkEnvironment {
                kind: "container".to_string(),
                ..valid.clone()
            },
            WorkEnvironment {
                setup_status: "pending".to_string(),
                ..valid.clone()
            },
            WorkEnvironment {
                path: String::new(),
                ..valid.clone()
            },
            WorkEnvironment {
                branch: String::new(),
                ..valid.clone()
            },
        ] {
            assert!(validate_environment(&invalid).is_err(), "{invalid:?}");
        }
    }

    #[tokio::test]
    async fn legacy_worktree_sessions_migrate_into_environments() {
        let dir = tempfile::tempdir().unwrap();
        let session_dir = dir.path().join(SESSION_ID);
        std::fs::create_dir(&session_dir).unwrap();
        std::fs::write(
            session_dir.join("state.json"),
            legacy_session(SESSION_ID).to_string(),
        )
        .unwrap();
        let mut sessions: Vec<ChatSessionMetadata> = vec![
            serde_json::from_value(legacy_session(SESSION_ID)).unwrap(),
            serde_json::from_value(serde_json::json!({
                "id": "plain", "title": "Plain", "created_at": 1, "updated_at": 1
            }))
            .unwrap(),
        ];

        migrate_session_worktrees(dir.path(), &mut sessions)
            .await
            .unwrap();

        assert_eq!(sessions[0].environment_id.as_deref(), Some(SESSION_ID));
        assert!(sessions[0].worktree.is_none());
        assert!(sessions[1].environment_id.is_none());

        let environments = load_environments(&environments_file(dir.path()))
            .await
            .unwrap();
        assert_eq!(
            environments,
            vec![WorkEnvironment {
                id: SESSION_ID.to_string(),
                kind: "worktree".to_string(),
                path: "/data/worktrees/hash/aaaaaaaa".to_string(),
                branch: "pragma/aaaaaaaa".to_string(),
                base_branch: None,
                setup_status: "ready".to_string(),
                setup_log: "installed".to_string(),
            }]
        );

        let saved: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(session_dir.join("state.json")).unwrap())
                .unwrap();
        assert_eq!(saved["environment_id"], SESSION_ID);
        assert!(saved.get("worktree").is_none());
        assert_eq!(saved["environment"], "worktree");
    }

    #[tokio::test]
    async fn migration_keeps_an_environment_that_already_exists() {
        let dir = tempfile::tempdir().unwrap();
        let file = environments_file(dir.path());
        let existing = WorkEnvironment {
            base_branch: Some("main".to_string()),
            ..worktree_environment(SESSION_ID, "/data/worktrees/hash/aaaaaaaa")
        };
        upsert_environment(&file, existing.clone()).await.unwrap();
        let mut sessions: Vec<ChatSessionMetadata> =
            vec![serde_json::from_value(legacy_session(SESSION_ID)).unwrap()];

        migrate_session_worktrees(dir.path(), &mut sessions)
            .await
            .unwrap();

        assert_eq!(load_environments(&file).await.unwrap(), vec![existing]);
        assert_eq!(sessions[0].environment_id.as_deref(), Some(SESSION_ID));
    }

    #[tokio::test]
    async fn migrated_sessions_load_with_their_environment() {
        let dir = tempfile::tempdir().unwrap();
        let session_dir = dir.path().join(SESSION_ID);
        std::fs::create_dir(&session_dir).unwrap();
        std::fs::write(
            session_dir.join("state.json"),
            legacy_session(SESSION_ID).to_string(),
        )
        .unwrap();

        let mut sessions = load_sessions(dir.path()).await.unwrap();
        migrate_session_worktrees(dir.path(), &mut sessions)
            .await
            .unwrap();
        let reloaded = load_sessions(dir.path()).await.unwrap();

        assert_eq!(reloaded.len(), 1);
        assert_eq!(reloaded[0].environment_id.as_deref(), Some(SESSION_ID));
        assert!(reloaded[0].worktree.is_none());
    }
}
