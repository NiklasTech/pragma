use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::ai::subscription_usage::{claude_config_path, CLAUDE_PROVIDER_ID};

const CLAUDE_CONFIG_ENV: &str = "CLAUDE_CONFIG_DIR";
const CLAUDE_DIR_PREFIX: &str = ".claude";
const CLAUDE_CONFIG_FILE: &str = ".claude.json";

/// One account of a coding CLI, which the CLI keeps in its own config folder.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CliAccount {
    pub provider_id: String,
    /// The folder the CLI is started with; None is the CLI's default account.
    pub config_dir: Option<String>,
    pub email: Option<String>,
    pub display_name: Option<String>,
    pub organization_name: Option<String>,
    /// False when an added folder no longer exists.
    pub available: bool,
}

/// The account a terminal session starts its CLI with.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CliAccountLaunch {
    pub provider_id: String,
    pub config_dir: String,
}

/// The variable that points a CLI at another account's config folder.
pub fn account_env_var(provider_id: &str) -> Option<&'static str> {
    (provider_id == CLAUDE_PROVIDER_ID).then_some(CLAUDE_CONFIG_ENV)
}

/// Checks a launch request and returns the variable and folder to set.
pub fn account_env(launch: &CliAccountLaunch) -> Result<(&'static str, PathBuf), String> {
    let var = account_env_var(&launch.provider_id)
        .ok_or_else(|| "This CLI does not support several accounts".to_string())?;
    Ok((var, existing_account_dir(&launch.config_dir)?))
}

/// An absolute folder that exists; anything else is rejected.
pub fn existing_account_dir(config_dir: &str) -> Result<PathBuf, String> {
    let dir = PathBuf::from(config_dir);
    if !dir.is_absolute() {
        return Err("The account folder must be an absolute path".to_string());
    }
    if !dir.is_dir() {
        return Err(format!("The account folder {config_dir} does not exist"));
    }
    Ok(dir)
}

fn text(config: &Value, pointer: &str) -> Option<String> {
    config
        .pointer(pointer)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn read_config(path: &Path) -> Option<Value> {
    let bytes = std::fs::read(path).ok()?;
    serde_json::from_slice(&bytes).ok()
}

fn claude_account(config_dir: Option<&Path>, config_path: &Path) -> CliAccount {
    let available = config_dir.map_or(true, Path::is_dir);
    let config = read_config(config_path).unwrap_or(Value::Null);
    CliAccount {
        provider_id: CLAUDE_PROVIDER_ID.to_string(),
        config_dir: config_dir.map(|dir| dir.to_string_lossy().into_owned()),
        email: text(&config, "/oauthAccount/emailAddress"),
        display_name: text(&config, "/oauthAccount/displayName"),
        organization_name: text(&config, "/oauthAccount/organizationName"),
        available,
    }
}

/// Folders like `~/.claude-work` that hold a Claude Code config of their own.
pub fn claude_account_dirs(home: &Path) -> Vec<PathBuf> {
    let Ok(entries) = std::fs::read_dir(home) else {
        return Vec::new();
    };
    let mut dirs: Vec<PathBuf> = entries
        .flatten()
        .filter(|entry| {
            let name = entry.file_name();
            let name = name.to_string_lossy();
            name.starts_with(CLAUDE_DIR_PREFIX) && name != CLAUDE_DIR_PREFIX
        })
        .map(|entry| entry.path())
        .filter(|path| path.is_dir() && path.join(CLAUDE_CONFIG_FILE).is_file())
        .collect();
    dirs.sort();
    dirs
}

fn same_dir(a: &Path, b: &Path) -> bool {
    match (a.canonicalize(), b.canonicalize()) {
        (Ok(a), Ok(b)) => a == b,
        _ => a == b,
    }
}

/// The default account first, then found folders, then folders added by hand, each once.
pub fn list_claude_accounts(
    home: &Path,
    env_config_dir: Option<&str>,
    added_dirs: &[PathBuf],
) -> Vec<CliAccount> {
    let default_path = claude_config_path(env_config_dir, home);
    let default_dir = env_config_dir
        .filter(|dir| !dir.is_empty())
        .map(PathBuf::from);
    let mut seen: Vec<PathBuf> = default_dir.into_iter().collect();
    let mut accounts = vec![claude_account(None, &default_path)];

    let found = claude_account_dirs(home);
    for dir in found.iter().chain(added_dirs) {
        if seen.iter().any(|known| same_dir(known, dir)) {
            continue;
        }
        seen.push(dir.clone());
        accounts.push(claude_account(Some(dir), &dir.join(CLAUDE_CONFIG_FILE)));
    }
    accounts
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn write_config(dir: &Path, email: &str) {
        std::fs::create_dir_all(dir).unwrap();
        let config = json!({
            "oauthAccount": {
                "emailAddress": email,
                "displayName": "Sam",
                "organizationName": "Work Org"
            }
        });
        std::fs::write(dir.join(CLAUDE_CONFIG_FILE), config.to_string()).unwrap();
    }

    #[test]
    fn lists_the_default_and_every_claude_folder_once() {
        let home = tempfile::tempdir().unwrap();
        std::fs::write(
            home.path().join(CLAUDE_CONFIG_FILE),
            json!({ "oauthAccount": { "emailAddress": "me@home.test" } }).to_string(),
        )
        .unwrap();
        std::fs::create_dir(home.path().join(".claude")).unwrap();
        write_config(&home.path().join(".claude-work"), "me@work.test");
        std::fs::create_dir(home.path().join(".claude-empty")).unwrap();
        let elsewhere = tempfile::tempdir().unwrap();
        write_config(elsewhere.path(), "me@else.test");

        let added = vec![
            home.path().join(".claude-work"),
            elsewhere.path().to_path_buf(),
        ];
        let accounts = list_claude_accounts(home.path(), None, &added);

        let emails: Vec<_> = accounts
            .iter()
            .map(|account| account.email.as_deref())
            .collect();
        assert_eq!(
            emails,
            vec![
                Some("me@home.test"),
                Some("me@work.test"),
                Some("me@else.test")
            ]
        );
        assert_eq!(accounts[0].config_dir, None);
        assert_eq!(accounts[1].organization_name.as_deref(), Some("Work Org"));
        assert!(accounts.iter().all(|account| account.available));
    }

    #[test]
    fn a_config_dir_set_for_pragma_is_the_default_and_not_listed_again() {
        let home = tempfile::tempdir().unwrap();
        let work = home.path().join(".claude-work");
        write_config(&work, "me@work.test");

        let accounts = list_claude_accounts(home.path(), work.to_str(), &[]);

        assert_eq!(accounts.len(), 1);
        assert_eq!(accounts[0].config_dir, None);
        assert_eq!(accounts[0].email.as_deref(), Some("me@work.test"));
    }

    #[test]
    fn a_removed_folder_is_unavailable_and_signed_out() {
        let home = tempfile::tempdir().unwrap();
        let gone = home.path().join("gone");

        let accounts = list_claude_accounts(home.path(), None, &[gone]);

        assert_eq!(accounts.len(), 2);
        assert!(!accounts[1].available);
        assert_eq!(accounts[1].email, None);
    }

    #[test]
    fn launch_needs_a_supported_cli_and_an_existing_absolute_folder() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().to_string_lossy().into_owned();
        let launch = |provider_id: &str, config_dir: &str| CliAccountLaunch {
            provider_id: provider_id.to_string(),
            config_dir: config_dir.to_string(),
        };

        let (var, folder) = account_env(&launch(CLAUDE_PROVIDER_ID, &path)).unwrap();
        assert_eq!(var, "CLAUDE_CONFIG_DIR");
        assert_eq!(folder, dir.path());
        assert!(account_env(&launch("openai-codex", &path)).is_err());
        assert!(account_env(&launch(CLAUDE_PROVIDER_ID, "relative/dir")).is_err());
        assert!(account_env(&launch(CLAUDE_PROVIDER_ID, &format!("{path}/missing"))).is_err());
    }
}
