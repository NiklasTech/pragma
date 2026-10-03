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

fn validate_header_name(name: &str) -> Result<()> {
    let valid = !name.is_empty()
        && name.len() <= 256
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_'));
    if valid {
        Ok(())
    } else {
        Err(McpError::Config(format!("invalid header name: {name}")))
    }
}

/// Which kind of value a keychain entry holds; each kind has its own account prefix.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SecretKind {
    Env,
    Header,
}

impl SecretKind {
    fn parse(kind: Option<&str>) -> Result<Self> {
        match kind {
            None | Some("env") => Ok(SecretKind::Env),
            Some("header") => Ok(SecretKind::Header),
            Some(other) => Err(McpError::Config(format!("invalid secret kind: {other}"))),
        }
    }
}

fn account(server_id: &str, key: &str, kind: SecretKind) -> Result<String> {
    validate_server_id(server_id)?;
    match kind {
        SecretKind::Env => {
            validate_env_key(key)?;
            Ok(format!("{server_id}/{key}"))
        }
        SecretKind::Header => {
            validate_header_name(key)?;
            Ok(format!("{server_id}/header:{key}"))
        }
    }
}

fn keychain_entry(account: &str) -> Result<keyring::Entry> {
    keyring::Entry::new(SERVICE_NAME, account)
        .map_err(|e| McpError::Keychain(format!("keyring entry failed: {e}")))
}

fn read_entry(account: &str) -> Result<Option<String>> {
    match keychain_entry(account)?.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(McpError::Keychain(format!("keyring read failed: {e}"))),
    }
}

fn delete_entry(account: &str) -> Result<()> {
    match keychain_entry(account)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(McpError::Keychain(format!("keyring delete failed: {e}"))),
    }
}

pub fn get_secret_of(server_id: &str, key: &str, kind: SecretKind) -> Result<Option<String>> {
    read_entry(&account(server_id, key, kind)?)
}

pub fn set_secret_of(server_id: &str, key: &str, value: &str, kind: SecretKind) -> Result<()> {
    if value.is_empty() || value.len() > MAX_VALUE_LEN {
        return Err(McpError::Config(format!("invalid value for {key}")));
    }
    keychain_entry(&account(server_id, key, kind)?)?
        .set_password(value)
        .map_err(|e| McpError::Keychain(format!("keyring write failed: {e}")))
}

pub fn delete_secret_of(server_id: &str, key: &str, kind: SecretKind) -> Result<()> {
    delete_entry(&account(server_id, key, kind)?)
}

pub fn get_secret(server_id: &str, key: &str) -> Result<Option<String>> {
    get_secret_of(server_id, key, SecretKind::Env)
}

pub fn set_secret(server_id: &str, key: &str, value: &str) -> Result<()> {
    set_secret_of(server_id, key, value, SecretKind::Env)
}

pub fn delete_secret(server_id: &str, key: &str) -> Result<()> {
    delete_secret_of(server_id, key, SecretKind::Env)
}

fn oauth_account(server_id: &str) -> Result<String> {
    validate_server_id(server_id)?;
    Ok(format!("{server_id}/oauth"))
}

/// OAuth tokens of a remote server, stored as one JSON document.
pub fn get_oauth_tokens(server_id: &str) -> Result<Option<String>> {
    read_entry(&oauth_account(server_id)?)
}

pub fn set_oauth_tokens(server_id: &str, json: &str) -> Result<()> {
    if json.len() > MAX_VALUE_LEN {
        return Err(McpError::Config("OAuth token set is too large".to_string()));
    }
    keychain_entry(&oauth_account(server_id)?)?
        .set_password(json)
        .map_err(|e| McpError::Keychain(format!("keyring write failed: {e}")))
}

pub fn delete_oauth_tokens(server_id: &str) -> Result<()> {
    delete_entry(&oauth_account(server_id)?)
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

/// Plain headers plus the secret header values from the keychain; fails if one is missing.
pub fn resolve_headers(config: &McpServerConfig) -> Result<HashMap<String, String>> {
    let mut headers = config.headers.clone();
    for name in &config.secret_headers {
        let value = get_secret_of(&config.id, name, SecretKind::Header)?.ok_or_else(|| {
            McpError::Config(format!(
                "secret header {name} for MCP server {} is not set",
                config.name
            ))
        })?;
        headers.insert(name.clone(), value);
    }
    Ok(headers)
}

/// Keeps secret values out of the plain env and header maps and drops duplicate secret keys.
pub fn sanitize(config: &mut McpServerConfig) {
    let mut seen = HashSet::new();
    config.secret_env.retain(|key| seen.insert(key.clone()));
    for key in &config.secret_env {
        config.env.remove(key);
    }
    let mut seen = HashSet::new();
    config
        .secret_headers
        .retain(|name| seen.insert(name.clone()));
    for name in &config.secret_headers {
        config.headers.remove(name);
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
    let kept_headers: HashSet<(&str, &str)> = next
        .iter()
        .flat_map(|s| s.secret_headers.iter().map(|k| (s.id.as_str(), k.as_str())))
        .collect();
    let kept_servers: HashSet<&str> = next.iter().map(|s| s.id.as_str()).collect();
    for server in previous {
        for key in &server.secret_env {
            if !kept.contains(&(server.id.as_str(), key.as_str())) {
                let _ = delete_secret(&server.id, key);
            }
        }
        for name in &server.secret_headers {
            if !kept_headers.contains(&(server.id.as_str(), name.as_str())) {
                let _ = delete_secret_of(&server.id, name, SecretKind::Header);
            }
        }
        if !kept_servers.contains(server.id.as_str()) {
            let _ = delete_oauth_tokens(&server.id);
        }
    }
}

#[tauri::command]
pub async fn mcp_set_secret(
    server_id: String,
    key: String,
    value: String,
    kind: Option<String>,
) -> std::result::Result<(), String> {
    let kind = SecretKind::parse(kind.as_deref()).map_err(|e| e.to_string())?;
    set_secret_of(&server_id, &key, &value, kind).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn mcp_missing_secrets(
    server_id: String,
    keys: Vec<String>,
    kind: Option<String>,
) -> std::result::Result<Vec<String>, String> {
    let kind = SecretKind::parse(kind.as_deref()).map_err(|e| e.to_string())?;
    let mut missing = Vec::new();
    for key in keys {
        if get_secret_of(&server_id, &key, kind)
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
            env: env
                .iter()
                .map(|(k, v)| (k.to_string(), v.to_string()))
                .collect(),
            secret_env: secret_env.iter().map(|k| k.to_string()).collect(),
            ..Default::default()
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
    fn sanitize_removes_secret_header_values() {
        let mut server = config(&[], &[]);
        server
            .headers
            .insert("Authorization".to_string(), "Bearer x".to_string());
        server
            .headers
            .insert("X-Region".to_string(), "eu".to_string());
        server.secret_headers = vec!["Authorization".to_string(), "Authorization".to_string()];
        sanitize(&mut server);
        assert_eq!(server.secret_headers, vec!["Authorization".to_string()]);
        assert!(!server.headers.contains_key("Authorization"));
        assert_eq!(
            server.headers.get("X-Region").map(String::as_str),
            Some("eu")
        );
    }

    #[test]
    fn secret_kinds_use_separate_accounts() {
        assert_eq!(
            account("mcp-1", "GITHUB_TOKEN", SecretKind::Env).unwrap(),
            "mcp-1/GITHUB_TOKEN"
        );
        assert_eq!(
            account("mcp-1", "X-Api-Key", SecretKind::Header).unwrap(),
            "mcp-1/header:X-Api-Key"
        );
        assert!(account("mcp-1", "X-Api-Key", SecretKind::Env).is_err());
        assert!(account("mcp-1", "Bad Header", SecretKind::Header).is_err());
        assert_eq!(oauth_account("mcp-1").unwrap(), "mcp-1/oauth");
        assert!(SecretKind::parse(Some("token")).is_err());
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
