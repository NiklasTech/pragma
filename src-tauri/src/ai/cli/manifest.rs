use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// A CLI provider manifest defines how to install, authenticate, and chat
/// with an AI provider via their official CLI tool.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CLIManifest {
    pub id: String,
    pub name: String,
    pub description: String,

    /// Installation command (e.g. "npm install -g @anthropic-ai/claude-code")
    pub install_cmd: String,

    /// Command to check if the CLI is installed (e.g. "claude --version")
    pub check_cmd: String,

    /// Command to start the login flow (e.g. "claude login")
    pub login_cmd: String,

    /// Command to check auth status (e.g. "claude doctor")
    pub auth_check_cmd: Option<String>,

    /// Command to log out (e.g. "claude logout")
    pub logout_cmd: Option<String>,

    /// Template for the chat command.
    /// Placeholders: {prompt}, {cwd}, {session_id}
    pub chat_cmd: String,

    /// Output format: "stream-json", "json", "text"
    pub output_format: OutputFormat,

    /// Whether the CLI supports session isolation (one chat = one session)
    pub supports_sessions: bool,

    /// Extra environment variables to set when running the CLI
    pub env: Option<HashMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum OutputFormat {
    StreamJson,
    Json,
    Text,
}

/// Built-in manifests for verified CLI providers.
pub fn built_in_manifests() -> Vec<CLIManifest> {
    vec![
        CLIManifest {
            id: "anthropic-claude".to_string(),
            name: "Claude Code".to_string(),
            description: "Anthropic Claude Code CLI — requires Claude Pro subscription".to_string(),
            install_cmd: "npm install -g @anthropic-ai/claude-code".to_string(),
            check_cmd: "claude --version".to_string(),
            login_cmd: "claude login".to_string(),
            auth_check_cmd: Some("claude doctor".to_string()),
            logout_cmd: Some("claude logout".to_string()),
            chat_cmd: "claude --print --output-format=stream-json --no-session-persistence --allowed-tools=None".to_string(),
            output_format: OutputFormat::StreamJson,
            supports_sessions: true,
            env: None,
        },
        CLIManifest {
            id: "openai-codex".to_string(),
            name: "OpenAI Codex".to_string(),
            description: "OpenAI Codex CLI — requires ChatGPT Plus or API credits".to_string(),
            install_cmd: "npm install -g @openai/codex".to_string(),
            check_cmd: "codex --version".to_string(),
            login_cmd: "codex login".to_string(),
            auth_check_cmd: Some("codex doctor".to_string()),
            logout_cmd: Some("codex logout".to_string()),
            chat_cmd: "codex exec --json".to_string(),
            output_format: OutputFormat::Json,
            supports_sessions: false,
            env: None,
        },
        CLIManifest {
            id: "moonshot-kimi".to_string(),
            name: "Kimi Code".to_string(),
            description: "Moonshot Kimi Code CLI — requires Kimi subscription".to_string(),
            install_cmd: "npm install -g @moonshot-ai/kimi-code".to_string(),
            check_cmd: "kimi --version".to_string(),
            login_cmd: "kimi login".to_string(),
            auth_check_cmd: None,
            logout_cmd: None,
            chat_cmd: "kimi --print --output-format=stream-json".to_string(),
            output_format: OutputFormat::StreamJson,
            supports_sessions: true,
            env: None,
        },
        CLIManifest {
            id: "google-gemini".to_string(),
            name: "Gemini CLI".to_string(),
            description: "Google Gemini CLI — requires Gemini subscription".to_string(),
            install_cmd: "npm install -g @google/gemini-cli".to_string(),
            check_cmd: "gemini --version".to_string(),
            login_cmd: "gemini login".to_string(),
            auth_check_cmd: None,
            logout_cmd: None,
            chat_cmd: "gemini --print".to_string(),
            output_format: OutputFormat::Text,
            supports_sessions: false,
            env: None,
        },
        CLIManifest {
            id: "moonshot-kimi-acp".to_string(),
            name: "Kimi Code (ACP)".to_string(),
            description: "Moonshot Kimi Code CLI via Agent Client Protocol — supports tools and MCP".to_string(),
            install_cmd: "npm install -g @moonshot-ai/kimi-code".to_string(),
            check_cmd: "kimi --version".to_string(),
            login_cmd: "kimi login".to_string(),
            auth_check_cmd: None,
            logout_cmd: None,
            chat_cmd: "kimi acp".to_string(),
            output_format: OutputFormat::StreamJson,
            supports_sessions: true,
            env: None,
        },
    ]
}

pub fn get_manifest(id: &str) -> Option<CLIManifest> {
    built_in_manifests().into_iter().find(|m| m.id == id)
}
