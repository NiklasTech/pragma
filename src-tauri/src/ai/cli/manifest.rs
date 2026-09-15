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
/// Each entry speaks the Agent Client Protocol (ACP), so the session manager
/// is manifest-driven and works for any id in this table.
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
        CLIManifest {
            id: "anthropic-claude".to_string(),
            name: "Claude Code".to_string(),
            description:
                "Anthropic Claude Code CLI via Agent Client Protocol — uses your Claude Pro/Max plan"
                    .to_string(),
            install_cmd: "npm install -g @anthropic-ai/claude-code".to_string(),
            check_cmd: "claude --version".to_string(),
            login_cmd: "claude auth login".to_string(),
            auth_check_cmd: Some("claude auth status".to_string()),
            logout_cmd: Some("claude auth logout".to_string()),
            chat_cmd: "npx -y @agentclientprotocol/claude-agent-acp".to_string(),
            output_format: OutputFormat::StreamJson,
            supports_sessions: true,
            uses_acp: true,
            env: None,
            path_env: None,
        },
        CLIManifest {
            id: "google-gemini".to_string(),
            name: "Gemini CLI".to_string(),
            description:
                "Google Gemini CLI via Agent Client Protocol — uses your Gemini/Google account"
                    .to_string(),
            install_cmd: "npm install -g @google/gemini-cli".to_string(),
            check_cmd: "gemini --version".to_string(),
            login_cmd: "gemini".to_string(),
            auth_check_cmd: None,
            logout_cmd: None,
            chat_cmd: "gemini --acp".to_string(),
            output_format: OutputFormat::StreamJson,
            supports_sessions: true,
            uses_acp: true,
            env: None,
            path_env: None,
        },
        CLIManifest {
            id: "github-copilot".to_string(),
            name: "GitHub Copilot CLI".to_string(),
            description:
                "GitHub Copilot CLI via Agent Client Protocol — uses your Copilot plan"
                    .to_string(),
            install_cmd: "npm install -g @github/copilot".to_string(),
            check_cmd: "copilot --version".to_string(),
            login_cmd: "copilot login".to_string(),
            auth_check_cmd: None,
            logout_cmd: None,
            chat_cmd: "copilot --acp".to_string(),
            output_format: OutputFormat::StreamJson,
            supports_sessions: true,
            uses_acp: true,
            env: None,
            path_env: None,
        },
        CLIManifest {
            id: "xai-grok".to_string(),
            name: "Grok Build".to_string(),
            description:
                "xAI Grok Build CLI via Agent Client Protocol — uses your Grok/SuperGrok plan"
                    .to_string(),
            install_cmd: "npm install -g @xai-official/grok".to_string(),
            check_cmd: "grok --version".to_string(),
            login_cmd: "grok login".to_string(),
            auth_check_cmd: None,
            logout_cmd: Some("grok logout".to_string()),
            chat_cmd: "grok agent stdio".to_string(),
            output_format: OutputFormat::StreamJson,
            supports_sessions: true,
            uses_acp: true,
            env: None,
            path_env: None,
        },
        CLIManifest {
            id: "cursor-agent".to_string(),
            name: "Cursor CLI".to_string(),
            description: "Cursor Agent CLI via Agent Client Protocol — uses your Cursor plan"
                .to_string(),
            install_cmd: "bash -lc \"curl https://cursor.com/install -fsS | bash\"".to_string(),
            check_cmd: "cursor-agent --version".to_string(),
            login_cmd: "cursor-agent login".to_string(),
            auth_check_cmd: None,
            logout_cmd: None,
            chat_cmd: "cursor-agent acp".to_string(),
            output_format: OutputFormat::StreamJson,
            supports_sessions: true,
            uses_acp: true,
            env: None,
            path_env: None,
        },
        CLIManifest {
            id: "opencode".to_string(),
            name: "OpenCode".to_string(),
            description: "OpenCode CLI via Agent Client Protocol".to_string(),
            install_cmd: "npm install -g @opencode/cli".to_string(),
            check_cmd: "opencode --version".to_string(),
            login_cmd: "opencode auth login".to_string(),
            auth_check_cmd: None,
            logout_cmd: Some("opencode auth logout".to_string()),
            chat_cmd: "opencode acp".to_string(),
            output_format: OutputFormat::StreamJson,
            supports_sessions: true,
            uses_acp: true,
            env: None,
            path_env: None,
        },
        CLIManifest {
            id: "hermes-agent".to_string(),
            name: "Hermes Agent".to_string(),
            description: "Nous Hermes Agent CLI via Agent Client Protocol".to_string(),
            install_cmd: "bash -lc \"curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash\""
                .to_string(),
            check_cmd: "hermes --version".to_string(),
            login_cmd: "hermes login".to_string(),
            auth_check_cmd: None,
            logout_cmd: None,
            chat_cmd: "hermes acp".to_string(),
            output_format: OutputFormat::StreamJson,
            supports_sessions: true,
            uses_acp: true,
            env: None,
            path_env: None,
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
    fn built_in_manifests_include_all_nine_providers() {
        let ids: Vec<String> = built_in_manifests().into_iter().map(|m| m.id).collect();
        assert!(ids.contains(&"moonshot-kimi".to_string()));
        assert!(ids.contains(&"openai-codex".to_string()));
        assert!(ids.contains(&"anthropic-claude".to_string()));
        assert!(ids.contains(&"google-gemini".to_string()));
        assert!(ids.contains(&"github-copilot".to_string()));
        assert!(ids.contains(&"xai-grok".to_string()));
        assert!(ids.contains(&"cursor-agent".to_string()));
        assert!(ids.contains(&"opencode".to_string()));
        assert!(ids.contains(&"hermes-agent".to_string()));
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

    #[test]
    fn anthropic_claude_manifest_uses_acp_with_official_commands() {
        let manifest = get_manifest("anthropic-claude").expect("claude manifest");
        assert!(manifest.uses_acp);
        assert_eq!(
            manifest.install_cmd,
            "npm install -g @anthropic-ai/claude-code"
        );
        assert_eq!(manifest.check_cmd, "claude --version");
        assert_eq!(manifest.login_cmd, "claude auth login");
        assert_eq!(
            manifest.auth_check_cmd.as_deref(),
            Some("claude auth status")
        );
        assert_eq!(manifest.logout_cmd.as_deref(), Some("claude auth logout"));
        assert_eq!(
            manifest.chat_cmd,
            "npx -y @agentclientprotocol/claude-agent-acp"
        );
    }

    #[test]
    fn google_gemini_manifest_uses_acp_with_official_commands() {
        let manifest = get_manifest("google-gemini").expect("gemini manifest");
        assert!(manifest.uses_acp);
        assert_eq!(manifest.install_cmd, "npm install -g @google/gemini-cli");
        assert_eq!(manifest.check_cmd, "gemini --version");
        assert_eq!(manifest.login_cmd, "gemini");
        assert_eq!(manifest.auth_check_cmd, None);
        assert_eq!(manifest.logout_cmd, None);
        assert_eq!(manifest.chat_cmd, "gemini --acp");
    }

    #[test]
    fn github_copilot_manifest_uses_acp_with_official_commands() {
        let manifest = get_manifest("github-copilot").expect("copilot manifest");
        assert!(manifest.uses_acp);
        assert_eq!(manifest.install_cmd, "npm install -g @github/copilot");
        assert_eq!(manifest.check_cmd, "copilot --version");
        assert_eq!(manifest.login_cmd, "copilot login");
        assert_eq!(manifest.auth_check_cmd, None);
        assert_eq!(manifest.logout_cmd, None);
        assert_eq!(manifest.chat_cmd, "copilot --acp");
    }

    #[test]
    fn xai_grok_manifest_uses_acp_with_official_commands() {
        let manifest = get_manifest("xai-grok").expect("grok manifest");
        assert!(manifest.uses_acp);
        assert_eq!(manifest.install_cmd, "npm install -g @xai-official/grok");
        assert_eq!(manifest.check_cmd, "grok --version");
        assert_eq!(manifest.login_cmd, "grok login");
        assert_eq!(manifest.auth_check_cmd, None);
        assert_eq!(manifest.logout_cmd.as_deref(), Some("grok logout"));
        assert_eq!(manifest.chat_cmd, "grok agent stdio");
    }

    #[test]
    fn cursor_agent_manifest_uses_acp_with_official_commands() {
        let manifest = get_manifest("cursor-agent").expect("cursor manifest");
        assert!(manifest.uses_acp);
        assert_eq!(
            manifest.install_cmd,
            "bash -lc \"curl https://cursor.com/install -fsS | bash\""
        );
        assert_eq!(manifest.check_cmd, "cursor-agent --version");
        assert_eq!(manifest.login_cmd, "cursor-agent login");
        assert_eq!(manifest.auth_check_cmd, None);
        assert_eq!(manifest.logout_cmd, None);
        assert_eq!(manifest.chat_cmd, "cursor-agent acp");
    }

    #[test]
    fn opencode_manifest_uses_acp_with_official_commands() {
        let manifest = get_manifest("opencode").expect("opencode manifest");
        assert!(manifest.uses_acp);
        assert_eq!(manifest.install_cmd, "npm install -g @opencode/cli");
        assert_eq!(manifest.check_cmd, "opencode --version");
        assert_eq!(manifest.login_cmd, "opencode auth login");
        assert_eq!(manifest.auth_check_cmd, None);
        assert_eq!(manifest.logout_cmd.as_deref(), Some("opencode auth logout"));
        assert_eq!(manifest.chat_cmd, "opencode acp");
    }

    #[test]
    fn hermes_agent_manifest_uses_acp_with_official_commands() {
        let manifest = get_manifest("hermes-agent").expect("hermes manifest");
        assert!(manifest.uses_acp);
        assert_eq!(
            manifest.install_cmd,
            "bash -lc \"curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash\""
        );
        assert_eq!(manifest.check_cmd, "hermes --version");
        assert_eq!(manifest.login_cmd, "hermes login");
        assert_eq!(manifest.auth_check_cmd, None);
        assert_eq!(manifest.logout_cmd, None);
        assert_eq!(manifest.chat_cmd, "hermes acp");
    }
}
