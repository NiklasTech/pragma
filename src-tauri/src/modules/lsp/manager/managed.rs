//! Language servers Pragma installs into its own data folder, so an install never needs write
//! access to a system prefix such as `/usr/local/lib/node_modules` (EACCES without sudo).

use crate::platform::new_tokio_command;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

/// How a missing language server is installed.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum Installer {
    /// npm packages in `<servers>/npm/node_modules`.
    Npm(&'static [&'static str]),
    /// pip packages in the virtual environment `<servers>/python`.
    Pip(&'static [&'static str]),
    /// A toolchain command that installs into the user's own toolchain folder.
    Command {
        program: &'static str,
        args: &'static [&'static str],
    },
}

/// `<app_local_data>/language-servers`, next to the managed debug adapters.
pub fn servers_dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("Cannot resolve app data dir: {e}"))?
        .join("language-servers"))
}

fn npm_prefix(servers: &Path) -> PathBuf {
    servers.join("npm")
}

/// The folder npm links the installed packages' binaries into.
pub(super) fn npm_bin_dir(servers: &Path) -> PathBuf {
    npm_prefix(servers).join("node_modules").join(".bin")
}

fn python_venv(servers: &Path) -> PathBuf {
    servers.join("python")
}

fn venv_bin(venv: &Path, command: &str) -> PathBuf {
    if cfg!(target_os = "windows") {
        venv.join("Scripts").join(format!("{command}.exe"))
    } else {
        venv.join("bin").join(command)
    }
}

/// The binary of `command` that an earlier install put into the servers folder.
pub(super) fn managed_binary(
    servers: &Path,
    installer: Option<Installer>,
    command: &str,
) -> Option<PathBuf> {
    let binary = match installer? {
        Installer::Npm(_) => {
            let name = if cfg!(target_os = "windows") {
                format!("{command}.cmd")
            } else {
                command.to_string()
            };
            npm_bin_dir(servers).join(name)
        }
        Installer::Pip(_) => venv_bin(&python_venv(servers), command),
        Installer::Command { .. } => return None,
    };
    binary.is_file().then_some(binary)
}

/// The commands to run in order; each is a program and its arguments.
pub(super) fn install_steps(servers: &Path, installer: Installer) -> Vec<(PathBuf, Vec<String>)> {
    let owned = |args: &[&str]| args.iter().map(|a| a.to_string()).collect::<Vec<_>>();
    match installer {
        Installer::Npm(packages) => {
            let mut args = vec![
                "install".to_string(),
                "--prefix".to_string(),
                npm_prefix(servers).to_string_lossy().to_string(),
                "--no-audit".to_string(),
                "--no-fund".to_string(),
            ];
            args.extend(owned(packages));
            vec![(PathBuf::from("npm"), args)]
        }
        Installer::Pip(packages) => {
            let venv = python_venv(servers);
            let system_python = if cfg!(target_os = "windows") {
                "python"
            } else {
                "python3"
            };
            let venv_python = venv_bin(&venv, "python");
            let mut pip = vec![
                "-m".to_string(),
                "pip".to_string(),
                "install".to_string(),
                "--upgrade".to_string(),
            ];
            pip.extend(owned(packages));
            let mut steps = Vec::new();
            if !venv_python.is_file() {
                steps.push((
                    PathBuf::from(system_python),
                    vec![
                        "-m".to_string(),
                        "venv".to_string(),
                        venv.to_string_lossy().to_string(),
                    ],
                ));
            }
            steps.push((venv_python, pip));
            steps
        }
        Installer::Command { program, args } => vec![(PathBuf::from(program), owned(args))],
    }
}

/// Runs the install steps with `path` as PATH; returns the output of the last step.
pub(super) async fn run_install(
    servers: &Path,
    installer: Installer,
    path: &str,
) -> Result<String, String> {
    if !matches!(installer, Installer::Command { .. }) {
        std::fs::create_dir_all(servers)
            .map_err(|e| format!("Cannot create {}: {e}", servers.display()))?;
    }

    let mut last = String::new();
    for (program, args) in install_steps(servers, installer) {
        let program = super::resolve_command(&program.to_string_lossy(), path);
        let output = new_tokio_command(&program)
            .args(&args)
            .env("PATH", path)
            .output()
            .await
            .map_err(|e| format!("Failed to run {program}: {e}"))?;

        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        if !output.status.success() {
            let message = if stderr.is_empty() { stdout } else { stderr };
            return Err(format!(
                "Installation failed with exit code {}: {message}",
                output.status.code().unwrap_or(-1)
            ));
        }
        last = if stdout.is_empty() { stderr } else { stdout };
    }
    Ok(last)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("pragma-lsp-managed-{name}"));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn touch(path: &Path) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, "").unwrap();
    }

    const TS: Installer = Installer::Npm(&["typescript-language-server", "typescript"]);
    const PYLSP: Installer = Installer::Pip(&["python-lsp-server"]);

    #[test]
    fn npm_installs_into_the_servers_folder_never_globally() {
        let servers = Path::new("/data/language-servers");
        let steps = install_steps(servers, TS);
        assert_eq!(steps.len(), 1);
        let (program, args) = &steps[0];
        assert_eq!(program, Path::new("npm"));
        assert!(!args.iter().any(|a| a == "-g" || a == "--global"));
        let prefix = args.iter().position(|a| a == "--prefix").unwrap();
        assert_eq!(Path::new(&args[prefix + 1]), servers.join("npm"));
        assert!(args.ends_with(&["typescript-language-server".into(), "typescript".into()]));
    }

    #[test]
    fn pip_creates_a_venv_once_and_installs_into_it() {
        let servers = temp_dir("pip");
        let steps = install_steps(&servers, PYLSP);
        assert_eq!(steps.len(), 2);
        assert_eq!(steps[0].1[..2], ["-m".to_string(), "venv".to_string()]);
        assert_eq!(steps[1].0, venv_bin(&servers.join("python"), "python"));

        touch(&venv_bin(&servers.join("python"), "python"));
        let steps = install_steps(&servers, PYLSP);
        assert_eq!(steps.len(), 1);
        assert!(steps[0].1.ends_with(&["python-lsp-server".to_string()]));

        let _ = fs::remove_dir_all(&servers);
    }

    #[test]
    fn toolchain_commands_run_unchanged() {
        let installer = Installer::Command {
            program: "rustup",
            args: &["component", "add", "rust-analyzer"],
        };
        let steps = install_steps(Path::new("/unused"), installer);
        assert_eq!(steps[0].0, Path::new("rustup"));
        assert_eq!(steps[0].1, ["component", "add", "rust-analyzer"]);
    }

    #[test]
    fn finds_binaries_only_after_an_install() {
        let servers = temp_dir("binary");
        assert_eq!(
            managed_binary(&servers, Some(TS), "typescript-language-server"),
            None
        );

        let name = if cfg!(target_os = "windows") {
            "typescript-language-server.cmd"
        } else {
            "typescript-language-server"
        };
        let npm_bin = servers.join("npm/node_modules/.bin").join(name);
        touch(&npm_bin);
        assert_eq!(
            managed_binary(&servers, Some(TS), "typescript-language-server"),
            Some(npm_bin)
        );

        let pylsp = venv_bin(&servers.join("python"), "pylsp");
        touch(&pylsp);
        assert_eq!(managed_binary(&servers, Some(PYLSP), "pylsp"), Some(pylsp));

        let rustup = Installer::Command {
            program: "rustup",
            args: &[],
        };
        assert_eq!(
            managed_binary(&servers, Some(rustup), "rust-analyzer"),
            None
        );
        assert_eq!(managed_binary(&servers, None, "clangd"), None);

        let _ = fs::remove_dir_all(&servers);
    }
}
