use super::managed::{managed_binary, run_install};
use super::{LspManager, SERVERS};
use crate::ai::cli::manager::enriched_path;
use crate::modules::lsp::types::LspServerConfig;
use crate::platform::new_tokio_command;
use std::path::{Path, PathBuf};

impl LspManager {
    /// True when Pragma installed the server into `servers` or its command answers on PATH.
    pub async fn check_server_installed(
        servers: Option<&Path>,
        language: &str,
    ) -> Result<bool, String> {
        let config = server_config_for_language(language)
            .ok_or_else(|| format!("No LSP server configured for language '{language}'"))?;

        if servers
            .and_then(|dir| managed_server(dir, language))
            .is_some()
        {
            return Ok(true);
        }

        let path = enriched_path();
        let command = resolve_command(&config.command, &path);
        let output = new_tokio_command(&command)
            .arg(version_probe_arg(&config.command))
            .env("PATH", &path)
            .output()
            .await;

        match output {
            Ok(out) if out.status.success() => Ok(true),
            _ => Ok(false),
        }
    }

    pub async fn install_server(servers: &Path, language: &str) -> Result<String, String> {
        let entry = SERVERS
            .iter()
            .find(|s| s.language == language)
            .ok_or_else(|| format!("No LSP server configured for language '{language}'"))?;
        let installer = entry
            .install
            .ok_or_else(|| format!("Automatic installation is not supported for '{language}'"))?;

        let output = run_install(servers, installer, &enriched_path()).await?;

        // Verify the server is actually discoverable after a reported success.
        if !Self::check_server_installed(Some(servers), language).await? {
            return Err(format!(
                "Installation reported success but '{}' is still not found. Output: {output}",
                entry.command
            ));
        }

        Ok(output)
    }
}

/// The binary an earlier install put into the servers folder for `language`.
pub(super) fn managed_server(servers: &Path, language: &str) -> Option<PathBuf> {
    let entry = SERVERS.iter().find(|s| s.language == language)?;
    managed_binary(servers, entry.install, entry.command)
}

/// Resolves a command name to an executable path.
///
/// On Windows, Rust's `Command::new` only searches for `.exe` files by default,
/// but npm global packages install `.cmd` wrappers. This helper searches PATH
/// (with common Windows extensions) and falls back to the original name.
pub fn resolve_command(command: &str, path: &str) -> String {
    if !cfg!(target_os = "windows") || command.contains('.') {
        return command.to_string();
    }

    for dir in std::env::split_paths(path) {
        for ext in ["cmd", "bat", "exe"] {
            let candidate = dir.join(format!("{command}.{ext}"));
            if candidate.is_file() {
                return candidate.to_string_lossy().to_string();
            }
        }
    }

    command.to_string()
}

/// sourcekit-lsp rejects `--version` with exit code 64, so probe it with `--help`.
fn version_probe_arg(command: &str) -> &'static str {
    if command == "sourcekit-lsp" {
        "--help"
    } else {
        "--version"
    }
}

pub(super) fn server_config_for_language(language: &str) -> Option<LspServerConfig> {
    SERVERS
        .iter()
        .find(|s| s.language == language)
        .map(|s| LspServerConfig {
            command: s.command.to_string(),
            args: s.args.iter().map(|a| a.to_string()).collect(),
        })
}

#[cfg(test)]
mod tests {
    use super::super::managed::Installer;
    use super::*;
    use std::fs;

    #[test]
    fn resolve_command_prefers_cmd_wrapper_on_windows() {
        if !cfg!(target_os = "windows") {
            return;
        }

        let temp = std::env::temp_dir().join("pragma-resolve-command-test");
        let _ = fs::remove_dir_all(&temp);
        fs::create_dir_all(&temp).unwrap();
        fs::write(temp.join("typescript-language-server.cmd"), "").unwrap();
        fs::write(temp.join("typescript-language-server.exe"), "").unwrap();

        let path = temp.to_string_lossy().to_string();
        let resolved = resolve_command("typescript-language-server", &path);
        assert!(
            resolved.ends_with(".cmd"),
            "expected .cmd wrapper, got {resolved}"
        );

        let _ = fs::remove_dir_all(&temp);
    }

    #[test]
    fn resolve_command_returns_original_on_unix() {
        if cfg!(target_os = "windows") {
            return;
        }

        let resolved = resolve_command("typescript-language-server", "/usr/bin");
        assert_eq!(resolved, "typescript-language-server");
    }

    #[test]
    fn sourcekit_lsp_is_probed_with_help() {
        assert_eq!(version_probe_arg("sourcekit-lsp"), "--help");
        assert_eq!(version_probe_arg("zls"), "--version");
    }

    #[test]
    fn new_language_presets_are_configured() {
        for (language, command) in [
            ("shell", "bash-language-server"),
            ("ruby", "ruby-lsp"),
            ("toml", "taplo"),
            ("csharp", "csharp-ls"),
            ("swift", "sourcekit-lsp"),
            ("zig", "zls"),
        ] {
            let config = server_config_for_language(language).unwrap();
            assert_eq!(config.command, command, "{language} server command");
        }
    }

    #[test]
    fn html_and_css_use_the_langservers_extracted_package() {
        for language in ["html", "css"] {
            let entry = SERVERS.iter().find(|s| s.language == language).unwrap();
            assert_eq!(
                entry.install,
                Some(Installer::Npm(&["vscode-langservers-extracted"])),
                "{language} must install the package that ships its binary"
            );
        }

        assert_eq!(
            server_config_for_language("html").unwrap().command,
            "vscode-html-language-server"
        );
        assert_eq!(
            server_config_for_language("css").unwrap().command,
            "vscode-css-language-server"
        );
    }
}
