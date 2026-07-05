use std::path::Path;
use std::process::Command;

#[cfg(unix)]
const SHELL_ENVS_TO_IMPORT: &[&str] = &[
    "PATH",
    "HOME",
    "USER",
    "SHELL",
    "SSH_AUTH_SOCK",
    "DOCKER_HOST",
    "DOCKER_CONFIG",
    "COLORTERM",
    "TERM",
    "LANG",
    "LC_ALL",
];

fn login_shell_from_passwd() -> Option<String> {
    #[cfg(target_os = "macos")]
    {
        let user = std::env::var("USER").ok()?;
        let output = Command::new("dscl")
            .args([".", "-read", &format!("/Users/{user}"), "UserShell"])
            .output()
            .ok()?;
        if !output.status.success() {
            return None;
        }
        let line = String::from_utf8_lossy(&output.stdout);
        let shell = line
            .lines()
            .find(|l| l.starts_with("UserShell:"))
            .and_then(|l| l.split_whitespace().nth(1))
            .map(|s| s.to_string())?;
        if Path::new(&shell).is_file() {
            return Some(shell);
        }
    }

    #[cfg(target_os = "linux")]
    {
        let user = std::env::var("USER").ok()?;
        let output = Command::new("getent")
            .args(["passwd", &user])
            .output()
            .ok()?;
        if !output.status.success() {
            return None;
        }
        let line = String::from_utf8_lossy(&output.stdout);
        let shell = line.trim().split(':').nth(6)?.to_string();
        if Path::new(&shell).is_file() {
            return Some(shell);
        }
    }

    None
}

pub fn default_shell() -> String {
    std::env::var("SHELL")
        .ok()
        .filter(|s| !s.is_empty() && Path::new(s).is_file())
        .or_else(login_shell_from_passwd)
        .unwrap_or_else(|| {
            for candidate in ["/bin/zsh", "/bin/bash", "/bin/sh"] {
                if Path::new(candidate).is_file() {
                    return candidate.to_string();
                }
            }
            "/bin/sh".to_string()
        })
}

#[cfg(unix)]
fn append_path_entries(entries: &[&str]) {
    let current = std::env::var("PATH").unwrap_or_default();
    let mut parts: Vec<String> = std::env::split_paths(&current)
        .map(|p| p.to_string_lossy().to_string())
        .collect();

    for entry in entries {
        let expanded = if entry.starts_with("$HOME/") {
            match std::env::var("HOME") {
                Ok(home) if !home.is_empty() => format!("{}{}", home, &entry[5..]),
                _ => continue,
            }
        } else {
            entry.to_string()
        };

        if Path::new(&expanded).is_dir() && !parts.contains(&expanded) {
            parts.push(expanded);
        }
    }

    if let Ok(new_path) = std::env::join_paths(parts) {
        std::env::set_var("PATH", new_path);
    }
}

#[cfg(unix)]
pub fn load_shell_env() -> Result<(), String> {
    let shell = default_shell();

    let result = Command::new(&shell)
        .args(["-ilc", "env -0"])
        .output()
        .map_err(|e| format!("Failed to run shell env command from {shell}: {e}"));

    if let Ok(output) = result {
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            for entry in stdout.split('\0') {
                let Some((key, value)) = entry.split_once('=') else {
                    continue;
                };

                if !SHELL_ENVS_TO_IMPORT.contains(&key) {
                    continue;
                }

                match key {
                    "PATH" => {
                        if !value.is_empty() {
                            std::env::set_var(key, value);
                        }
                    }
                    _ => {
                        let current = std::env::var(key).unwrap_or_default();
                        if current.is_empty() && !value.is_empty() {
                            std::env::set_var(key, value);
                        }
                    }
                }
            }
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
        }
    } else if let Err(e) = result {
    }

    append_path_entries(&[
        "/usr/local/bin",
        "/opt/homebrew/bin",
        "/opt/podman/bin",
        "$HOME/.docker/bin",
        "$HOME/.local/bin",
    ]);

    if let Ok(path) = std::env::var("PATH") {}

    Ok(())
}

#[cfg(windows)]
pub fn load_shell_env() -> Result<(), String> {
    const ENV_NAMES: &[&str] = &[
        "PATH",
        "HOME",
        "USERPROFILE",
        "DOCKER_HOST",
        "DOCKER_CONFIG",
    ];

    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            "Get-ChildItem Env: | ForEach-Object { \"$($_.Name)=$($_.Value)`0\" }",
        ])
        .output()
        .map_err(|e| format!("Failed to run PowerShell env command: {e}"))?;

    if !output.status.success() {
        let _stderr = String::from_utf8_lossy(&output.stderr);
        return Ok(());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    for entry in stdout.split('\0') {
        let Some((key, value)) = entry.split_once('=') else {
            continue;
        };
        if !ENV_NAMES.contains(&key) {
            continue;
        }
        match key {
            "PATH" => {
                if !value.is_empty() {
                    std::env::set_var(key, value);
                }
            }
            _ => {
                let current = std::env::var(key).unwrap_or_default();
                if current.is_empty() && !value.is_empty() {
                    std::env::set_var(key, value);
                }
            }
        }
    }

    if let Ok(_path) = std::env::var("PATH") {}

    Ok(())
}
