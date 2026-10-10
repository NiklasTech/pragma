use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::Duration;

use chrono::{DateTime, Utc};
use serde::Serialize;
use serde_json::Value;
use tokio::sync::Mutex;
use tokio::time::timeout;

use crate::ai::cli::enriched_path;
use crate::platform::new_tokio_command_on_path;

pub const CLAUDE_PROVIDER_ID: &str = "anthropic-claude";

/// Windows of `cachedUsageUtilization.utilization`, as `/usage` names them.
const CLAUDE_WINDOWS: [(&str, &str); 4] = [
    ("five_hour", "Current session"),
    ("seven_day", "Current week"),
    ("seven_day_opus", "Current week (Opus)"),
    ("seven_day_sonnet", "Current week (Sonnet)"),
];

/// Claude Code skips its cache write while the cached copy is younger than this.
const CLAUDE_CACHE_MIN_AGE_MS: i64 = 60_000;
const REFRESH_TIMEOUT: Duration = Duration::from_secs(30);
const MAX_ERROR_CHARS: usize = 200;

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct UsageWindow {
    pub id: String,
    pub label: String,
    pub used_percent: f64,
    pub resets_at_ms: Option<i64>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SubscriptionUsage {
    pub provider_id: String,
    pub windows: Vec<UsageWindow>,
    /// When the CLI fetched these values; None when it has none cached.
    pub fetched_at_ms: Option<i64>,
}

impl SubscriptionUsage {
    fn empty(provider_id: &str) -> Self {
        Self {
            provider_id: provider_id.to_string(),
            windows: Vec::new(),
            fetched_at_ms: None,
        }
    }
}

/// Where Claude Code keeps its global config, `CLAUDE_CONFIG_DIR` first.
pub fn claude_config_path(config_dir: Option<&str>, home: &Path) -> PathBuf {
    match config_dir.filter(|dir| !dir.is_empty()) {
        Some(dir) => PathBuf::from(dir).join(".claude.json"),
        None => home.join(".claude.json"),
    }
}

/// The plan usage Claude Code cached from its last usage fetch, if it belongs to the signed-in account.
pub fn parse_claude_usage(config: &Value) -> SubscriptionUsage {
    let empty = SubscriptionUsage::empty(CLAUDE_PROVIDER_ID);
    let Some(cache) = config.get("cachedUsageUtilization") else {
        return empty;
    };
    let account = config
        .pointer("/oauthAccount/accountUuid")
        .and_then(Value::as_str);
    if cache.get("accountUuid").and_then(Value::as_str) != account {
        return empty;
    }
    let Some(utilization) = cache.get("utilization") else {
        return empty;
    };

    let windows = CLAUDE_WINDOWS
        .iter()
        .filter_map(|(id, label)| {
            let window = utilization.get(*id)?;
            let used_percent = window.get("utilization")?.as_f64()?;
            let resets_at_ms = window
                .get("resets_at")
                .and_then(Value::as_str)
                .and_then(|value| DateTime::parse_from_rfc3339(value).ok())
                .map(|time| time.timestamp_millis());
            Some(UsageWindow {
                id: (*id).to_string(),
                label: (*label).to_string(),
                used_percent,
                resets_at_ms,
            })
        })
        .collect();

    SubscriptionUsage {
        provider_id: CLAUDE_PROVIDER_ID.to_string(),
        windows,
        fetched_at_ms: cache
            .get("fetchedAtMs")
            .and_then(Value::as_f64)
            .map(|ms| ms as i64),
    }
}

pub async fn read_claude_usage(path: &Path) -> Result<SubscriptionUsage, String> {
    let bytes = match tokio::fs::read(path).await {
        Ok(bytes) => bytes,
        Err(error) if error.kind() == ErrorKind::NotFound => {
            return Ok(SubscriptionUsage::empty(CLAUDE_PROVIDER_ID));
        }
        Err(error) => return Err(format!("Could not read the Claude Code config: {error}")),
    };
    let config: Value = serde_json::from_slice(&bytes)
        .map_err(|error| format!("Could not parse the Claude Code config: {error}"))?;
    Ok(parse_claude_usage(&config))
}

fn is_recent(fetched_at_ms: Option<i64>, now_ms: i64) -> bool {
    fetched_at_ms.is_some_and(|fetched| (0..CLAUDE_CACHE_MIN_AGE_MS).contains(&(now_ms - fetched)))
}

fn truncate(text: &str) -> String {
    let trimmed = text.trim();
    match trimmed.char_indices().nth(MAX_ERROR_CHARS) {
        Some((end, _)) => format!("{}...", &trimmed[..end]),
        None => trimmed.to_string(),
    }
}

/// An error that `claude -p /usage --output-format json` reports on stdout.
fn usage_command_error(stdout: &[u8]) -> Option<String> {
    let result: Value = serde_json::from_slice(stdout).ok()?;
    if result.get("is_error").and_then(Value::as_bool) != Some(true) {
        return None;
    }
    let message = result
        .get("result")
        .and_then(Value::as_str)
        .unwrap_or("Claude Code could not load the usage");
    Some(truncate(message))
}

static REFRESH_LOCK: Mutex<()> = Mutex::const_new(());

/// Lets Claude Code fetch the usage with its own credentials in a separate, non-interactive
/// process, then reads the cache it wrote. Pragma never sees the credentials.
pub async fn refresh_claude_usage(path: &Path, cwd: &Path) -> Result<SubscriptionUsage, String> {
    let _guard = REFRESH_LOCK.lock().await;
    let current = read_claude_usage(path).await?;
    if is_recent(current.fetched_at_ms, Utc::now().timestamp_millis()) {
        return Ok(current);
    }

    let path_var = enriched_path();
    let mut command = new_tokio_command_on_path("claude", &path_var);
    command
        .args([
            "-p",
            "/usage",
            "--output-format",
            "json",
            "--no-session-persistence",
            "--strict-mcp-config",
        ])
        .current_dir(cwd)
        .env("PATH", path_var)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);

    let output = timeout(REFRESH_TIMEOUT, command.output())
        .await
        .map_err(|_| "Claude Code did not answer in time".to_string())?
        .map_err(|error| format!("Could not run Claude Code: {error}"))?;
    if let Some(error) = usage_command_error(&output.stdout) {
        return Err(error);
    }
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(if stderr.trim().is_empty() {
            "Claude Code could not load the usage".to_string()
        } else {
            truncate(&stderr)
        });
    }
    read_claude_usage(path).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn config(account: &str, cached_account: &str) -> Value {
        json!({
            "oauthAccount": { "accountUuid": account },
            "cachedUsageUtilization": {
                "fetchedAtMs": 1_791_671_158_098_i64,
                "accountUuid": cached_account,
                "utilization": {
                    "five_hour": {
                        "utilization": 45,
                        "resets_at": "2026-10-11T00:39:59.997686+00:00"
                    },
                    "seven_day": {
                        "utilization": 31.5,
                        "resets_at": "2026-10-15T00:59:59.997711+00:00"
                    },
                    "seven_day_opus": null,
                    "seven_day_sonnet": null
                }
            }
        })
    }

    #[test]
    fn reads_the_cached_windows() {
        let usage = parse_claude_usage(&config("a", "a"));
        assert_eq!(usage.fetched_at_ms, Some(1_791_671_158_098));
        assert_eq!(usage.windows.len(), 2);
        assert_eq!(usage.windows[0].id, "five_hour");
        assert_eq!(usage.windows[0].label, "Current session");
        assert_eq!(usage.windows[0].used_percent, 45.0);
        assert_eq!(usage.windows[0].resets_at_ms, Some(1_791_679_199_997));
        assert_eq!(usage.windows[1].used_percent, 31.5);
    }

    #[test]
    fn ignores_a_cache_of_another_account() {
        let usage = parse_claude_usage(&config("a", "b"));
        assert!(usage.windows.is_empty());
        assert_eq!(usage.fetched_at_ms, None);
    }

    #[test]
    fn missing_cache_is_empty() {
        let usage = parse_claude_usage(&json!({ "oauthAccount": { "accountUuid": "a" } }));
        assert!(usage.windows.is_empty());
        assert_eq!(usage.provider_id, CLAUDE_PROVIDER_ID);
    }

    #[test]
    fn config_dir_wins_over_home() {
        let home = Path::new("/home/me");
        assert_eq!(
            claude_config_path(None, home),
            PathBuf::from("/home/me/.claude.json")
        );
        assert_eq!(
            claude_config_path(Some(""), home),
            PathBuf::from("/home/me/.claude.json")
        );
        assert_eq!(
            claude_config_path(Some("/cfg"), home),
            PathBuf::from("/cfg/.claude.json")
        );
    }

    #[test]
    fn recent_means_younger_than_a_minute() {
        assert!(is_recent(Some(1_000), 30_000));
        assert!(!is_recent(Some(1_000), 70_000));
        assert!(!is_recent(Some(90_000), 30_000));
        assert!(!is_recent(None, 30_000));
    }

    #[test]
    fn reads_an_error_result() {
        let stdout = br#"{"is_error":true,"result":"Not logged in"}"#;
        assert_eq!(
            usage_command_error(stdout),
            Some("Not logged in".to_string())
        );
        assert_eq!(usage_command_error(br#"{"is_error":false}"#), None);
        assert_eq!(usage_command_error(b"not json"), None);
    }

    #[tokio::test]
    async fn missing_config_file_is_empty() {
        let usage = read_claude_usage(Path::new("/nonexistent/.claude.json"))
            .await
            .expect("usage");
        assert!(usage.windows.is_empty());
    }
}
