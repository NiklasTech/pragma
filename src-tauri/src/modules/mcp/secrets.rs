use crate::modules::mcp::error::{McpError, Result};
use crate::modules::mcp::McpServerConfig;
use std::collections::{HashMap, HashSet};

const SERVICE_NAME: &str = "pragma-mcp";
const SECRET_KEY_SUFFIXES: [&str; 3] = ["_TOKEN", "_KEY", "_SECRET"];
const MAX_VALUE_LEN: usize = 16 * 1024;

fn validate_server_id(server_id: &str) -> Result<()> {
    let valid = !server_id.is_empty()
        && server_id.len() <= 128
        && server_id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'));
    if valid {
        Ok(())
    } else {
        Err(McpError::Config(format!("invalid server id: {server_id}")))
    }
}

fn validate_env_key(key: &str) -> Result<()> {
    let mut chars = key.chars();
    let valid = key.len() <= 256
        && chars
            .next()
            .is_some_and(|c| c.is_ascii_alphabetic() || c == '_')
        && chars.all(|c| c.is_ascii_alphanumeric() || c == '_');
    if valid {
        Ok(())
    } else {
        Err(McpError::Config(format!(
            "invalid environment variable name: {key}"
        )))
    }
}

fn entry(server_id: &str, key: &str) -> Result<keyring::Entry> {
    validate_server_id(server_id)?;
    validate_env_key(key)?;
    keyring::Entry::new(SERVICE_NAME, &format!("{server_id}/{key}"))
        .map_err(|e| McpError::Keychain(format!("keyring entry failed: {e}")))
}

pub fn get_secret(server_id: &str, key: &str) -> Result<Option<String>> {
    match entry(server_id, key)?.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(McpError::Keychain(format!("keyring read failed: {e}"))),
    }
}

pub fn set_secret(server_id: &str, key: &str, value: &str) -> Result<()> {
    if value.is_empty() || value.len() > MAX_VALUE_LEN {
        return Err(McpError::Config(format!("invalid value for {key}")));
    }
    entry(server_id, key)?
        .set_password(value)
        .map_err(|e| McpError::Keychain(format!("keyring write failed: {e}")))
}

pub fn delete_secret(server_id: &str, key: &str) -> Result<()> {
    match entry(server_id, key)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(McpError::Keychain(format!("keyring delete failed: {e}"))),
    }
}

pub fn looks_secret(key: &str) -> bool {
    let upper = key.to_ascii_uppercase();
    SECRET_KEY_SUFFIXES
        .iter()
        .any(|suffix| upper.ends_with(suffix))
}

/// Plain env plus the secret values from the keychain; fails if a secret is missing.
pub fn resolve_env(config: &McpServerConfig) -> Result<HashMap<String, String>> {
    let mut env = config.env.clone();
    for key in &config.secret_env {
        let value = get_secret(&config.id, key)?.ok_or_else(|| {
            McpError::Config(format!(
                "secret {key} for MCP server {} is not set",
                config.name
            ))
        })?;
        env.insert(key.clone(), value);
    }
    Ok(env)
}

/// Keeps secret values out of the plain env map and drops duplicate secret keys.
pub fn sanitize(config: &mut McpServerConfig) {
    let mut seen = HashSet::new();
    config.secret_env.retain(|key| seen.insert(key.clone()));
    for key in &config.secret_env {
        config.env.remove(key);
    }
}

/// Moves plain values whose names look like secrets into the keychain.
/// A value the keychain rejects stays in the plain env so it is never lost.
pub fn migrate_plain_secrets(servers: &mut [McpServerConfig]) {
    for server in servers.iter_mut() {
        let keys: Vec<String> = server
            .env
            .keys()
            .filter(|key| looks_secret(key))
            .cloned()
            .collect();
        for key in keys {
            let Some(value) = server.env.get(&key) else {
                continue;
            };
            if set_secret(&server.id, &key, value).is_ok() {
                server.env.remove(&key);
                server.secret_env.push(key);
            }
        }
    }
}

/// Deletes keychain entries that the new config no longer references.
pub fn delete_orphaned(previous: &[McpServerConfig], next: &[McpServerConfig]) {
    let kept: HashSet<(&str, &str)> = next
        .iter()
        .flat_map(|s| s.secret_env.iter().map(|k| (s.id.as_str(), k.as_str())))
        .collect();
    for server in previous {
        for key in &server.secret_env {
            if !kept.contains(&(server.id.as_str(), key.as_str())) {
                let _ = delete_secret(&server.id, key);
            }
        }
    }
}

#[tauri::command]
pub async fn mcp_set_secret(
    server_id: String,
    key: String,
    value: String,
) -> std::result::Result<(), String> {
    set_secret(&server_id, &key, &value).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn mcp_missing_secrets(
    server_id: String,
    keys: Vec<String>,
) -> std::result::Result<Vec<String>, String> {
    let mut missing = Vec::new();
    for key in keys {
        if get_secret(&server_id, &key)
            .map_err(|e| e.to_string())?
            .is_none()
        {
            missing.push(key);
        }
    }
    Ok(missing)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn config(env: &[(&str, &str)], secret_env: &[&str]) -> McpServerConfig {
        McpServerConfig {
            id: "mcp-1".to_string(),
            name: "Test".to_string(),
            command: "node".to_string(),
            args: Vec::new(),
            env: env
                .iter()
                .map(|(k, v)| (k.to_string(), v.to_string()))
                .collect(),
            secret_env: secret_env.iter().map(|k| k.to_string()).collect(),
            autostart: false,
        }
    }

    #[test]
    fn detects_secret_like_names() {
        assert!(looks_secret("GITHUB_TOKEN"));
        assert!(looks_secret("openai_api_key"));
        assert!(looks_secret("CLIENT_SECRET"));
        assert!(!looks_secret("NODE_ENV"));
        assert!(!looks_secret("TOKEN_URL"));
    }

    #[test]
    fn rejects_invalid_names() {
        assert!(validate_env_key("GITHUB_TOKEN").is_ok());
        assert!(validate_env_key("_PRIVATE").is_ok());
        assert!(validate_env_key("").is_err());
        assert!(validate_env_key("1KEY").is_err());
        assert!(validate_env_key("KEY=VALUE").is_err());
        assert!(validate_server_id("mcp-123-abc").is_ok());
        assert!(validate_server_id("a/b").is_err());
        assert!(validate_server_id("").is_err());
    }

    #[test]
    fn sanitize_removes_secret_values_from_env() {
        let mut server = config(
            &[("GITHUB_TOKEN", "ghp_x"), ("NODE_ENV", "production")],
            &["GITHUB_TOKEN", "GITHUB_TOKEN"],
        );
        sanitize(&mut server);
        assert_eq!(server.secret_env, vec!["GITHUB_TOKEN".to_string()]);
        assert!(!server.env.contains_key("GITHUB_TOKEN"));
        assert_eq!(
            server.env.get("NODE_ENV").map(String::as_str),
            Some("production")
        );
    }

    #[test]
    fn serializes_secret_env_in_camel_case() {
        let server = config(&[], &["GITHUB_TOKEN"]);
        let json = serde_json::to_value(&server).unwrap();
        assert_eq!(json["secretEnv"][0], "GITHUB_TOKEN");

        let legacy: McpServerConfig =
            serde_json::from_str(r#"{"id":"a","name":"b","command":"c"}"#).unwrap();
        assert!(legacy.secret_env.is_empty());
    }
}
