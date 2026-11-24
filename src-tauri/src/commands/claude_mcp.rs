use std::collections::BTreeSet;
use std::path::{Path, PathBuf};

use serde_json::Value;
use tauri::{AppHandle, Manager, Runtime};

use crate::ai::subscription_usage::claude_config_path;
use crate::modules::mcp::cli_configs::claude_local_servers;
use crate::modules::mcp::import::{read_document, MAX_CLAUDE_CONFIG_BYTES, MAX_CONFIG_BYTES};

fn server_names(document: &Value) -> BTreeSet<String> {
    document
        .get("mcpServers")
        .and_then(Value::as_object)
        .map(|servers| servers.keys().cloned().collect())
        .unwrap_or_default()
}

/// The folder Claude Code keeps local settings under: a repository's main checkout, also from its
/// subfolders and worktrees, else the folder itself.
fn project_folder(folder: &Path) -> PathBuf {
    for dir in folder.ancestors() {
        let git = dir.join(".git");
        if git.is_dir() {
            return dir.to_path_buf();
        }
        if !git.is_file() {
            continue;
        }
        let main = std::fs::read_to_string(&git).ok().and_then(|content| {
            let git_dir = dir.join(content.strip_prefix("gitdir:")?.trim());
            let worktrees = git_dir.parent()?;
            if worktrees.file_name()? != "worktrees" {
                return None;
            }
            Some(worktrees.parent()?.parent()?.to_path_buf())
        });
        return main.unwrap_or_else(|| dir.to_path_buf());
    }
    folder.to_path_buf()
}

/// The servers of an account: the user-wide ones and those it keeps for the project.
fn account_servers(document: &Value, project: &Path) -> BTreeSet<String> {
    let mut names = server_names(document);
    let real = project.canonicalize().ok();
    for folder in [Some(project), real.as_deref()].into_iter().flatten() {
        if let Some(local) = claude_local_servers(document, folder) {
            names.extend(server_names(&local));
        }
    }
    names
}

/// The servers one account has for `folder` that the other account lacks. Servers from the
/// project's `.mcp.json` are there for every account.
pub fn missing_servers(from: &Value, to: &Value, folder: &Path) -> Vec<String> {
    let project = project_folder(folder);
    let shared = read_document(&folder.join(".mcp.json"), MAX_CONFIG_BYTES)
        .map(|document| server_names(&document))
        .unwrap_or_default();
    let there = account_servers(to, &project);
    account_servers(from, &project)
        .into_iter()
        .filter(|name| !there.contains(name) && !shared.contains(name))
        .collect()
}

fn account_config(
    config_dir: Option<&str>,
    env_dir: Option<&str>,
    home: &Path,
) -> Result<Value, String> {
    let chosen = config_dir.or(env_dir).filter(|dir| !dir.is_empty());
    if chosen.is_some_and(|dir| !Path::new(dir).is_absolute()) {
        return Err("The account folder must be an absolute path".to_string());
    }
    read_document(&claude_config_path(chosen, home), MAX_CLAUDE_CONFIG_BYTES)
        .ok_or_else(|| "This folder holds no Claude Code account".to_string())
}

/// Names the MCP servers a Claude Code session would lose by going on with another account.
#[tauri::command]
pub async fn claude_mcp_missing<R: Runtime>(
    app: AppHandle<R>,
    from_dir: Option<String>,
    to_dir: Option<String>,
    folder: String,
) -> Result<Vec<String>, String> {
    let home = app
        .path()
        .home_dir()
        .map_err(|error| format!("Could not resolve the home folder: {error}"))?;
    let folder = PathBuf::from(folder);
    if !folder.is_absolute() {
        return Err("The working folder must be an absolute path".to_string());
    }
    let env_dir = std::env::var("CLAUDE_CONFIG_DIR").ok();
    tauri::async_runtime::spawn_blocking(move || {
        let from = account_config(from_dir.as_deref(), env_dir.as_deref(), &home)?;
        let to = account_config(to_dir.as_deref(), env_dir.as_deref(), &home)?;
        Ok(missing_servers(&from, &to, &folder))
    })
    .await
    .map_err(|error| format!("Could not compare the accounts: {error}"))?
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn names_the_user_wide_and_local_servers_the_other_account_lacks() {
        let dir = tempfile::tempdir().unwrap();
        let folder = dir.path().to_string_lossy().into_owned();
        let from = json!({
            "mcpServers": { "github": {}, "linear": {} },
            "projects": { folder.as_str(): { "mcpServers": { "db": {} } } },
        });
        let to = json!({ "mcpServers": { "linear": {}, "extra": {} } });
        assert_eq!(missing_servers(&from, &to, dir.path()), ["db", "github"]);
        assert!(missing_servers(&from, &from, dir.path()).is_empty());
    }

    #[test]
    fn servers_of_the_project_file_are_never_missing() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(
            dir.path().join(".mcp.json"),
            r#"{"mcpServers":{"github":{}}}"#,
        )
        .unwrap();
        let from = json!({ "mcpServers": { "github": {}, "linear": {} } });
        assert_eq!(missing_servers(&from, &json!({}), dir.path()), ["linear"]);
    }

    #[test]
    fn servers_of_other_folders_do_not_count() {
        let dir = tempfile::tempdir().unwrap();
        let from = json!({ "projects": { "/elsewhere": { "mcpServers": { "db": {} } } } });
        assert!(missing_servers(&from, &json!({}), dir.path()).is_empty());
    }

    #[test]
    fn worktrees_and_subfolders_use_the_main_checkout() {
        let dir = tempfile::tempdir().unwrap();
        let repo = dir.path().join("repo");
        let worktree = dir.path().join("worktree");
        std::fs::create_dir_all(repo.join(".git/worktrees/one")).unwrap();
        std::fs::create_dir_all(repo.join("src")).unwrap();
        std::fs::create_dir_all(&worktree).unwrap();
        std::fs::write(
            worktree.join(".git"),
            format!("gitdir: {}\n", repo.join(".git/worktrees/one").display()),
        )
        .unwrap();

        assert_eq!(project_folder(&repo), repo);
        assert_eq!(project_folder(&repo.join("src")), repo);
        assert_eq!(project_folder(&worktree), repo);
        let plain = dir.path().join("plain");
        assert_eq!(project_folder(&plain), plain);
    }

    #[test]
    fn refuses_relative_and_missing_account_folders() {
        let home = tempfile::tempdir().unwrap();
        assert!(account_config(Some("relative"), None, home.path()).is_err());
        assert!(account_config(None, None, home.path()).is_err());
        std::fs::write(home.path().join(".claude.json"), "{}").unwrap();
        assert!(account_config(None, None, home.path()).is_ok());
    }
}
