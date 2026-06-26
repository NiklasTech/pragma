use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// A CLI provider manifest defines how to install, authenticate, and chat
/// with an AI provider via their official CLI tool.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CLIManifest {
    pub id: String,
    pub name: String,
    pub description: String,

    /// Installation command (e.g. "npm install -g @moonshot-ai/kimi-code")
    pub install_cmd: String,

    /// Command to check if the CLI is installed (e.g. "kimi --version")
    pub check_cmd: String,

    /// Command to start the login flow (e.g. "kimi login")
    pub login_cmd: String,

    /// Command to check auth status (e.g. "kimi doctor")
    pub auth_check_cmd: Option<String>,

    /// Command to log out (e.g. "kimi logout")
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
///
/// Currently only Kimi Code is supported via the Agent Client Protocol (ACP).
/// Other CLIs differ too much in their protocol and output formats to support
/// them with the same integration effort.
pub fn built_in_manifests() -> Vec<CLIManifest> {
    vec![CLIManifest {
        id: "moonshot-kimi".to_string(),
        name: "Kimi Code".to_string(),
        description: "Moonshot Kimi Code CLI via Agent Client Protocol — supports tools and MCP"
            .to_string(),
        install_cmd: "npm install -g @moonshot-ai/kimi-code".to_string(),
        check_cmd: "kimi --version".to_string(),
        login_cmd: "kimi login".to_string(),
        auth_check_cmd: None,
        logout_cmd: None,
        chat_cmd: "kimi acp".to_string(),
        output_format: OutputFormat::StreamJson,
        supports_sessions: true,
        env: None,
    }]
}

pub fn get_manifest(id: &str) -> Option<CLIManifest> {
    built_in_manifests().into_iter().find(|m| m.id == id)
}
