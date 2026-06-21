use std::env;
use std::path::PathBuf;
use std::process::Stdio;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::Command;
use tokio::time::timeout;

use super::manifest::{get_manifest, CLIManifest, OutputFormat};
use crate::ai::error::AIError;

// ─── Status Types ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CLIStatus {
    pub provider_id: String,
    pub installed: bool,
    pub version: Option<String>,
    pub authenticated: bool,
    pub user: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CLIChatRequest {
    pub provider_id: String,
    pub messages: Vec<CLIChatMessage>,
    pub session_id: Option<String>,
    pub cwd: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CLIChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CLIChunk {
    pub text: String,
    pub done: bool,
}

// ─── Manager ─────────────────────────────────────────────────────────────────

pub struct CLIManager;

/// Returns a modified PATH that includes common user bin directories.
/// This ensures CLIs installed via npm global, pipx, uv, cargo, etc.
/// are discoverable even when the app is launched from a desktop environment
/// with a restricted PATH.
fn enriched_path() -> String {
    let current = env::var("PATH").unwrap_or_default();
    let home = env::var("HOME").unwrap_or_default();

    let mut extra: Vec<PathBuf> = Vec::new();

    if !home.is_empty() {
        // npm global (default)
        extra.push(PathBuf::from(&home).join(".local/bin"));
        // npm global (legacy)
        extra.push(PathBuf::from(&home).join(".npm-global/bin"));
        // cargo
        extra.push(PathBuf::from(&home).join(".cargo/bin"));
        // pipx / uv tools
        extra.push(PathBuf::from(&home).join(".local/share/uv/tools"));
        extra.push(PathBuf::from(&home).join(".local/pipx/venvs"));
        // pnpm
        extra.push(PathBuf::from(&home).join(".pnpm-global"));
        // fnm / nvm
        extra.push(PathBuf::from(&home).join(".fnm"));
        extra.push(PathBuf::from(&home).join(".nvm/versions/node"));
        // Homebrew (macOS + Linux)
        extra.push(PathBuf::from("/opt/homebrew/bin"));
        extra.push(PathBuf::from("/usr/local/bin"));
    }

    // Flatten and join extra paths that actually exist
    let extra_str = extra
        .into_iter()
        .filter(|p| p.exists())
        .map(|p| p.to_string_lossy().to_string())
        .collect::<Vec<_>>()
        .join(":");

    if extra_str.is_empty() {
        current
    } else {
        format!("{}:{}", extra_str, current)
    }
}

impl CLIManager {
    pub fn new() -> Self {
        Self
    }

    // ── Discovery ────────────────────────────────────────────────────────────

    pub async fn check_status(&self, provider_id: &str) -> Result<CLIStatus, AIError> {
        let manifest = get_manifest(provider_id)
            .ok_or_else(|| AIError::ProviderNotFound(provider_id.to_string()))?;

        let version = self.run_check_cmd(&manifest).await;
        let installed = version.is_ok();

        let mut status = CLIStatus {
            provider_id: provider_id.to_string(),
            installed,
            version: version.ok(),
            authenticated: false,
            user: None,
            error: None,
        };

        if installed {
            if let Some(auth_check) = &manifest.auth_check_cmd {
                match self.run_auth_check(&manifest, auth_check).await {
                    Ok((auth, user)) => {
                        status.authenticated = auth;
                        status.user = user;
                    }
                    Err(e) => {
                        status.error = Some(e.to_string());
                    }
                }
            } else {
                // No explicit auth check command — assume authenticated if installed.
                // The user will discover auth issues when they actually try to chat.
                status.authenticated = true;
            }
        }

        Ok(status)
    }

    pub async fn check_all_statuses(&self) -> Vec<CLIStatus> {
        let manifests = super::manifest::built_in_manifests();
        let mut handles = Vec::new();

        for manifest in manifests {
            let id = manifest.id.clone();
            // Spawn each check in its own task so they run in parallel
            let handle = tokio::spawn(async move {
                let manager = CLIManager::new();
                match timeout(Duration::from_secs(10), manager.check_status(&id)).await {
                    Ok(Ok(status)) => status,
                    Ok(Err(e)) => CLIStatus {
                        provider_id: id,
                        installed: false,
                        version: None,
                        authenticated: false,
                        user: None,
                        error: Some(e.to_string()),
                    },
                    Err(_) => CLIStatus {
                        provider_id: id,
                        installed: false,
                        version: None,
                        authenticated: false,
                        user: None,
                        error: Some("status check timed out".to_string()),
                    },
                }
            });
            handles.push(handle);
        }

        let mut results = Vec::new();
        for handle in handles {
            if let Ok(status) = handle.await {
                results.push(status);
            }
        }
        results
    }

    // ── Installation ─────────────────────────────────────────────────────────

    pub async fn install(&self, provider_id: &str) -> Result<(), AIError> {
        let manifest = get_manifest(provider_id)
            .ok_or_else(|| AIError::ProviderNotFound(provider_id.to_string()))?;

        let parts = shellwords::split(&manifest.install_cmd)
            .map_err(|e| AIError::Provider(format!("invalid install command: {e}")))?;

        if parts.is_empty() {
            return Err(AIError::Provider("empty install command".to_string()));
        }

        let mut cmd = Command::new(&parts[0]);
        cmd.args(&parts[1..])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .env("PATH", enriched_path())
            .envs(env::vars());

        let output = cmd
            .output()
            .await
            .map_err(|e| AIError::Provider(format!("install failed: {e}")))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(AIError::Provider(format!("install failed: {stderr}")));
        }

        Ok(())
    }

    // ── Auth ─────────────────────────────────────────────────────────────────

    pub async fn start_login(&self, provider_id: &str) -> Result<String, AIError> {
        let manifest = get_manifest(provider_id)
            .ok_or_else(|| AIError::ProviderNotFound(provider_id.to_string()))?;

        // The login command typically opens a browser. We just run it and
        // let the CLI handle the OAuth flow. The user completes auth in the browser.
        let parts = shellwords::split(&manifest.login_cmd)
            .map_err(|e| AIError::Provider(format!("invalid login command: {e}")))?;

        if parts.is_empty() {
            return Err(AIError::Provider("empty login command".to_string()));
        }

        let mut cmd = Command::new(&parts[0]);
        cmd.args(&parts[1..])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .env("PATH", enriched_path());

        // Set up environment if specified
        if let Some(env_vars) = &manifest.env {
            for (key, value) in env_vars {
                cmd.env(key, value);
            }
        }

        let output = cmd
            .output()
            .await
            .map_err(|e| AIError::Provider(format!("login failed: {e}")))?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);

        if !output.status.success() {
            return Err(AIError::Provider(format!("login failed: {stderr}")));
        }

        // Return the output so the frontend can show login URL or success message
        Ok(format!("{stdout}\n{stderr}"))
    }

    pub async fn logout(&self, provider_id: &str) -> Result<(), AIError> {
        let manifest = get_manifest(provider_id)
            .ok_or_else(|| AIError::ProviderNotFound(provider_id.to_string()))?;

        let logout_cmd = manifest
            .logout_cmd
            .ok_or_else(|| AIError::Provider("logout not supported".to_string()))?;

        let parts = shellwords::split(&logout_cmd)
            .map_err(|e| AIError::Provider(format!("invalid logout command: {e}")))?;

        if parts.is_empty() {
            return Err(AIError::Provider("empty logout command".to_string()));
        }

        let mut cmd = Command::new(&parts[0]);
        cmd.args(&parts[1..])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .env("PATH", enriched_path())
            .envs(env::vars());

        let output = cmd
            .output()
            .await
            .map_err(|e| AIError::Provider(format!("logout failed: {e}")))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(AIError::Provider(format!("logout failed: {stderr}")));
        }

        Ok(())
    }

    // ── Chat ─────────────────────────────────────────────────────────────────

    pub async fn chat(
        &self,
        req: CLIChatRequest,
    ) -> Result<tokio::sync::mpsc::Receiver<CLIChunk>, AIError> {
        let manifest = get_manifest(&req.provider_id)
            .ok_or_else(|| AIError::ProviderNotFound(req.provider_id.clone()))?;

        let (tx, rx) = tokio::sync::mpsc::channel(32);

        let chat_cmd = build_chat_command(&manifest, &req);
        let output_format = manifest.output_format.clone();
        let prompt = build_prompt(&req);

        tokio::spawn(async move {
            if let Err(e) = run_chat_process(chat_cmd, output_format, prompt, tx).await {
                tracing::error!("CLI chat error: {e}");
            }
        });

        Ok(rx)
    }

    // ── Internal Helpers ─────────────────────────────────────────────────────

    async fn run_check_cmd(&self, manifest: &CLIManifest) -> Result<String, AIError> {
        let parts = shellwords::split(&manifest.check_cmd)
            .map_err(|e| AIError::Provider(format!("invalid check command: {e}")))?;

        if parts.is_empty() {
            return Err(AIError::Provider("empty check command".to_string()));
        }

        let output = Command::new(&parts[0])
            .args(&parts[1..])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .env("PATH", enriched_path())
            .envs(env::vars())
            .output()
            .await
            .map_err(|e| AIError::Provider(format!("check failed: {e}")))?;

        if !output.status.success() {
            return Err(AIError::Provider("not installed".to_string()));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        Ok(stdout.trim().to_string())
    }

    async fn run_auth_check(
        &self,
        _manifest: &CLIManifest,
        auth_check_cmd: &str,
    ) -> Result<(bool, Option<String>), AIError> {
        let parts = shellwords::split(auth_check_cmd)
            .map_err(|e| AIError::Provider(format!("invalid auth check command: {e}")))?;

        if parts.is_empty() {
            return Ok((false, None));
        }

        let output = Command::new(&parts[0])
            .args(&parts[1..])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .env("PATH", enriched_path())
            .envs(env::vars())
            .output()
            .await
            .map_err(|e| AIError::Provider(format!("auth check failed: {e}")))?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);

        // Heuristic: if the command succeeds and doesn't mention "not authenticated",
        // we assume the user is authenticated
        let is_authenticated = output.status.success()
            && !stdout.to_lowercase().contains("not authenticated")
            && !stdout.to_lowercase().contains("not logged in")
            && !stderr.to_lowercase().contains("unauthorized")
            && !stderr.to_lowercase().contains("401");

        // Try to extract user info from output (provider-specific heuristics)
        let user = extract_user_from_auth_output(&stdout);

        Ok((is_authenticated, user))
    }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

fn build_prompt(req: &CLIChatRequest) -> String {
    req.messages
        .iter()
        .map(|m| format!("{}: {}", m.role, m.content))
        .collect::<Vec<_>>()
        .join("\n\n")
}

fn build_chat_command(manifest: &CLIManifest, req: &CLIChatRequest) -> Vec<String> {
    let mut cmd = shellwords::split(&manifest.chat_cmd).unwrap_or_default();

    // Replace placeholders in chat_cmd
    let cmd_str = cmd.join(" ");
    let cmd_str = cmd_str.replace("{cwd}", &req.cwd.clone().unwrap_or_else(|| ".".to_string()));
    let cmd_str = cmd_str.replace("{session_id}", &req.session_id.clone().unwrap_or_default());

    cmd = shellwords::split(&cmd_str).unwrap_or_default();
    cmd
}

async fn run_chat_process(
    cmd_parts: Vec<String>,
    output_format: OutputFormat,
    prompt: String,
    tx: tokio::sync::mpsc::Sender<CLIChunk>,
) -> Result<(), AIError> {
    if cmd_parts.is_empty() {
        return Err(AIError::Provider("empty chat command".to_string()));
    }

    let mut child = Command::new(&cmd_parts[0])
        .args(&cmd_parts[1..])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::piped())
        .env("PATH", enriched_path())
        .envs(env::vars())
        .spawn()
        .map_err(|e| AIError::Provider(format!("failed to spawn chat: {e}")))?;

    // Write the conversation prompt to stdin and close it
    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(prompt.as_bytes())
            .await
            .map_err(|e| AIError::Provider(format!("failed to write prompt: {e}")))?;
        // Close stdin to signal EOF to the child process
        drop(stdin);
    }

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| AIError::Provider("no stdout".to_string()))?;

    let mut reader = BufReader::new(stdout).lines();

    // Read output lines and parse according to format
    while let Ok(Ok(Some(line))) = timeout(Duration::from_secs(30), reader.next_line()).await {
        let chunk = match output_format {
            OutputFormat::StreamJson | OutputFormat::Json => parse_json_chunk(&line),
            OutputFormat::Text => CLIChunk {
                text: line,
                done: false,
            },
        };

        if tx.send(chunk).await.is_err() {
            break;
        }
    }

    // Send done marker
    let _ = tx
        .send(CLIChunk {
            text: String::new(),
            done: true,
        })
        .await;

    // Clean up child process
    let _ = child.kill().await;

    Ok(())
}

fn parse_json_chunk(line: &str) -> CLIChunk {
    // Try to parse as JSON and extract text content
    if let Ok(value) = serde_json::from_str::<serde_json::Value>(line) {
        // Try common fields
        if let Some(text) = value.get("content").and_then(|v| v.as_str()) {
            return CLIChunk {
                text: text.to_string(),
                done: false,
            };
        }
        // Kimi Code CLI returns content as an array of blocks:
        // [{"type":"think","think":"..."}, {"type":"text","text":"..."}]
        if let Some(content) = value.get("content").and_then(|v| v.as_array()) {
            let mut text_parts = Vec::new();
            for block in content {
                if let Some(text) = block.get("text").and_then(|v| v.as_str()) {
                    text_parts.push(text.to_string());
                }
            }
            if !text_parts.is_empty() {
                return CLIChunk {
                    text: text_parts.join(""),
                    done: false,
                };
            }
        }
        if let Some(text) = value.get("text").and_then(|v| v.as_str()) {
            return CLIChunk {
                text: text.to_string(),
                done: false,
            };
        }
        if let Some(delta) = value.get("delta").and_then(|v| v.as_str()) {
            return CLIChunk {
                text: delta.to_string(),
                done: false,
            };
        }
    }

    // If not valid JSON with expected fields, return raw line
    CLIChunk {
        text: line.to_string(),
        done: false,
    }
}

fn extract_user_from_auth_output(output: &str) -> Option<String> {
    // Heuristic extraction of user info from auth check output
    // This would be provider-specific in a full implementation
    for line in output.lines() {
        let lower = line.to_lowercase();
        if lower.contains("user:") || lower.contains("account:") || lower.contains("email:") {
            if let Some(idx) = line.find(':') {
                let user = line[idx + 1..].trim();
                if !user.is_empty() {
                    return Some(user.to_string());
                }
            }
        }
    }
    None
}
