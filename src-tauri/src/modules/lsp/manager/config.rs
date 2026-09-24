use super::{LspManager, SERVERS};
use crate::ai::cli::manager::enriched_path;
use crate::modules::lsp::types::LspServerConfig;
use crate::platform::new_tokio_command;

impl LspManager {
    pub async fn check_server_installed(language: &str) -> Result<bool, String> {
        let config = server_config_for_language(language)
            .ok_or_else(|| format!("No LSP server configured for language '{language}'"))?;

        let path = enriched_path();
        let command = resolve_command(&config.command, &path);
        let output = new_tokio_command(&command)
            .arg("--version")
            .env("PATH", &path)
            .output()
            .await;

        match output {
            Ok(out) if out.status.success() => Ok(true),
            _ => Ok(false),
        }
    }

    pub async fn install_server(language: &str) -> Result<String, String> {
        let config = server_config_for_language(language)
            .ok_or_else(|| format!("No LSP server configured for language '{language}'"))?;

        let program = config
            .install_program
            .ok_or_else(|| format!("Automatic installation is not supported for '{language}'"))?;

        if config.install_args.is_empty() {
            return Err(format!("No install arguments configured for '{language}'"));
        }

        let path = enriched_path();
        let program = resolve_command(&program, &path);
        let output = new_tokio_command(&program)
            .args(&config.install_args)
            .env("PATH", &path)
            .output()
            .await
            .map_err(|e| format!("Failed to run installer: {e}"))?;

        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

        if !output.status.success() {
            let message = if stderr.is_empty() { stdout } else { stderr };
            return Err(format!(
                "Installation failed with exit code {}: {message}",
                output.status.code().unwrap_or(-1)
            ));
        }

        // Verify the server is actually discoverable after a reported success.
        if !Self::check_server_installed(language).await? {
            let output = if stdout.is_empty() { stderr } else { stdout };
            return Err(format!(
                "Installation reported success but '{}' is still not in PATH. Output: {output}",
                config.command
            ));
        }

        Ok(if stdout.is_empty() { stderr } else { stdout })
    }
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

pub(super) fn server_config_for_language(language: &str) -> Option<LspServerConfig> {
    SERVERS
        .iter()
        .find(|s| s.language == language)
        .map(|s| LspServerConfig {
            command: s.command.to_string(),
            args: s.args.iter().map(|a| a.to_string()).collect(),
            install_program: s.install_program.map(|p| p.to_string()),
            install_args: s.install_args.iter().map(|a| a.to_string()).collect(),
        })
}

#[cfg(test)]
mod tests {
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
    fn html_and_css_use_the_langservers_extracted_package() {
        for language in ["html", "css"] {
            let config = server_config_for_language(language).unwrap();
            let expected: Vec<String> = ["install", "-g", "vscode-langservers-extracted"]
                .iter()
                .map(|arg| arg.to_string())
                .collect();
            assert_eq!(
                config.install_args, expected,
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
