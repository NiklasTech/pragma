use std::path::{Path, PathBuf};

use crate::ai::cli_accounts::{prefixed_dirs, same_dir, CliAccount, CODEX_PROVIDER_ID};

const CODEX_DIR_PREFIX: &str = ".codex";
/// Codex keeps its sign-in here; Pragma only checks that it exists and never reads it.
const CODEX_AUTH_FILE: &str = "auth.json";
const CODEX_CONFIG_FILE: &str = "config.toml";

fn codex_account(config_dir: Option<&Path>, home_dir: &Path) -> CliAccount {
    CliAccount {
        provider_id: CODEX_PROVIDER_ID.to_string(),
        config_dir: config_dir.map(|dir| dir.to_string_lossy().into_owned()),
        email: None,
        display_name: None,
        organization_name: None,
        signed_in: home_dir.join(CODEX_AUTH_FILE).is_file(),
        available: config_dir.map_or(true, Path::is_dir),
    }
}

/// Folders like `~/.codex-work` that hold a Codex sign-in or config of their own.
fn codex_account_dirs(home: &Path) -> Vec<PathBuf> {
    let mut dirs = prefixed_dirs(home, CODEX_DIR_PREFIX, CODEX_AUTH_FILE);
    for dir in prefixed_dirs(home, CODEX_DIR_PREFIX, CODEX_CONFIG_FILE) {
        if !dirs.contains(&dir) {
            dirs.push(dir);
        }
    }
    dirs.sort();
    dirs
}

/// Codex's default account (`CODEX_HOME`, else `~/.codex`), then found folders, then added ones, each once.
pub fn list_codex_accounts(
    home: &Path,
    env_codex_home: Option<&str>,
    added_dirs: &[PathBuf],
) -> Vec<CliAccount> {
    let default_dir = env_codex_home
        .filter(|dir| !dir.is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| home.join(CODEX_DIR_PREFIX));
    let mut seen = vec![default_dir.clone()];
    let mut accounts = vec![codex_account(None, &default_dir)];
    for dir in codex_account_dirs(home).iter().chain(added_dirs) {
        if seen.iter().any(|known| same_dir(known, dir)) {
            continue;
        }
        seen.push(dir.clone());
        accounts.push(codex_account(Some(dir), dir));
    }
    accounts
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lists_the_default_and_codex_folders_by_sign_in_or_config() {
        let home = tempfile::tempdir().unwrap();
        std::fs::create_dir(home.path().join(".codex")).unwrap();
        std::fs::write(home.path().join(".codex").join(CODEX_AUTH_FILE), "{}").unwrap();
        let work = home.path().join(".codex-work");
        std::fs::create_dir(&work).unwrap();
        std::fs::write(work.join(CODEX_CONFIG_FILE), "").unwrap();
        std::fs::create_dir(home.path().join(".codex-empty")).unwrap();

        let accounts = list_codex_accounts(home.path(), None, std::slice::from_ref(&work));

        assert_eq!(accounts.len(), 2);
        assert_eq!(accounts[0].config_dir, None);
        assert!(accounts[0].signed_in);
        assert_eq!(accounts[1].config_dir.as_deref(), work.to_str());
        assert!(!accounts[1].signed_in);
        assert!(accounts.iter().all(|account| account.email.is_none()));
    }

    #[test]
    fn a_codex_home_set_for_pragma_is_the_default() {
        let home = tempfile::tempdir().unwrap();
        let work = home.path().join(".codex-work");
        std::fs::create_dir(&work).unwrap();
        std::fs::write(work.join(CODEX_AUTH_FILE), "{}").unwrap();

        let accounts = list_codex_accounts(home.path(), work.to_str(), &[]);

        assert_eq!(accounts.len(), 1);
        assert!(accounts[0].signed_in);
    }
}
