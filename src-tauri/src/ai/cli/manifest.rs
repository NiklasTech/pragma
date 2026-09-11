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

    /// Whether the CLI speaks the Agent Client Protocol over stdio.
    pub uses_acp: bool,

    /// Extra environment variables to set when running the CLI
    pub env: Option<HashMap<String, String>>,

    /// Environment variables whose value is the path of a binary resolved on
    /// PATH (e.g. `CODEX_PATH` -> `codex`). Unresolved binaries are skipped.
    pub path_env: Option<HashMap<String, String>>,
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
/// OpenAI Codex and Kimi Code both speak the Agent Client Protocol (ACP), so
/// the ACP session manager is manifest-driven and works for any entry here.
pub fn built_in_manifests() -> Vec<CLIManifest> {
    vec![
        CLIManifest {
            id: "moonshot-kimi".to_string(),
            name: "Kimi Code".to_string(),
            description:
                "Moonshot Kimi Code CLI via Agent Client Protocol — supports tools and MCP"
                    .to_string(),
            install_cmd: "npm install -g @moonshot-ai/kimi-code".to_string(),
            check_cmd: "kimi --version".to_string(),
            login_cmd: "kimi login".to_string(),
            auth_check_cmd: None,
            logout_cmd: None,
            chat_cmd: "kimi acp".to_string(),
            output_format: OutputFormat::StreamJson,
            supports_sessions: true,
            uses_acp: true,
            env: None,
            path_env: None,
        },
        CLIManifest {
            id: "openai-codex".to_string(),
            name: "OpenAI Codex".to_string(),
            description:
                "OpenAI Codex CLI via Agent Client Protocol — uses your ChatGPT Plus/Pro plan"
                    .to_string(),
            install_cmd: "npm install -g @openai/codex".to_string(),
            check_cmd: "codex --version".to_string(),
            login_cmd: "codex login".to_string(),
            auth_check_cmd: Some("codex login status".to_string()),
            logout_cmd: Some("codex logout".to_string()),
            chat_cmd: "npx -y @agentclientprotocol/codex-acp".to_string(),
            output_format: OutputFormat::StreamJson,
            supports_sessions: true,
            uses_acp: true,
            env: None,
            path_env: Some(HashMap::from([(
                "CODEX_PATH".to_string(),
                "codex".to_string(),
            )])),
        },
    ]
}

pub fn get_manifest(id: &str) -> Option<CLIManifest> {
    built_in_manifests().into_iter().find(|m| m.id == id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn built_in_manifests_include_kimi_and_codex() {
        let ids: Vec<String> = built_in_manifests().into_iter().map(|m| m.id).collect();
        assert!(ids.contains(&"moonshot-kimi".to_string()));
        assert!(ids.contains(&"openai-codex".to_string()));
    }

    #[test]
    fn kimi_manifest_uses_acp() {
        let manifest = get_manifest("moonshot-kimi").expect("kimi manifest");
        assert!(manifest.uses_acp);
        assert_eq!(manifest.chat_cmd, "kimi acp");
    }

    #[test]
    fn codex_manifest_uses_acp_with_official_commands() {
        let manifest = get_manifest("openai-codex").expect("codex manifest");
        assert!(manifest.uses_acp);
        assert_eq!(manifest.install_cmd, "npm install -g @openai/codex");
        assert_eq!(manifest.check_cmd, "codex --version");
        assert_eq!(manifest.login_cmd, "codex login");
        assert_eq!(
            manifest.auth_check_cmd.as_deref(),
            Some("codex login status")
        );
        assert_eq!(manifest.logout_cmd.as_deref(), Some("codex logout"));
        assert_eq!(manifest.chat_cmd, "npx -y @agentclientprotocol/codex-acp");
    }

    #[test]
    fn codex_manifest_resolves_codex_path_from_path() {
        let manifest = get_manifest("openai-codex").expect("codex manifest");
        let path_env = manifest.path_env.expect("codex path_env");
        assert_eq!(
            path_env.get("CODEX_PATH").map(String::as_str),
            Some("codex")
        );
    }
}
