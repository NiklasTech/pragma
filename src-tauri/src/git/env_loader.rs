#[cfg(target_os = "windows")]
fn load_windows_env() {
    if std::env::var("SSH_AUTH_SOCK").is_ok() {
        return;
    }

    let pipe = r"\\.\pipe\openssh-ssh-agent";
    std::env::set_var("SSH_AUTH_SOCK", pipe);
}

#[cfg(not(target_os = "windows"))]
fn find_user_shell() -> String {
    if let Ok(shell) = std::env::var("SHELL") {
        if !shell.is_empty() && std::path::Path::new(&shell).exists() {
            return shell;
        }
    }

    for fallback in ["/bin/zsh", "/bin/bash", "/bin/sh"] {
        if std::path::Path::new(fallback).exists() {
            return fallback.to_string();
        }
    }

    "/bin/sh".to_string()
}

#[cfg(not(target_os = "windows"))]
fn parse_env_output(output: &[u8]) -> Vec<(String, String)> {
    let text = String::from_utf8_lossy(output);
    let mut result = Vec::new();

    for entry in text.split('\0') {
        if entry.is_empty() {
            continue;
        }
        if let Some((key, value)) = entry.split_once('=') {
            result.push((key.to_string(), value.to_string()));
        }
    }

    result
}

#[cfg(not(target_os = "windows"))]
fn find_ssh_agent_socket() -> Option<String> {
    if let Ok(sock) = std::env::var("SSH_AUTH_SOCK") {
        if std::path::Path::new(&sock).exists() {
            return Some(sock);
        }
    }

    // 1. /tmp/ssh-*/agent.* (standard ssh-agent)
    let tmp = std::path::Path::new("/tmp");
    if let Ok(entries) = std::fs::read_dir(tmp) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path
                .file_name()
                .and_then(|n| n.to_str())
                .map_or(false, |n| n.starts_with("ssh-"))
            {
                if let Ok(subentries) = std::fs::read_dir(&path) {
                    for sub in subentries.flatten() {
                        let subpath = sub.path();
                        if subpath
                            .file_name()
                            .and_then(|n| n.to_str())
                            .map_or(false, |n| n.starts_with("agent."))
                        {
                            if subpath.exists() {
                                return Some(subpath.to_string_lossy().to_string());
                            }
                        }
                    }
                }
            }
        }
    }

    // 2. /tmp/ssh-agent* (custom named sockets)
    if let Ok(entries) = std::fs::read_dir(tmp) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path
                .file_name()
                .and_then(|n| n.to_str())
                .map_or(false, |n| n.starts_with("ssh-agent"))
            {
                if path.exists() {
                    return Some(path.to_string_lossy().to_string());
                }
            }
        }
    }

    // 3. ~/.ssh/agent/* (some desktop environments / keychain tools)
    if let Some(home) = std::env::var_os("HOME").map(std::path::PathBuf::from) {
        let agent_dir = home.join(".ssh").join("agent");
        if let Ok(entries) = std::fs::read_dir(&agent_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .map_or(false, |n| n.contains("agent"))
                {
                    if path.exists() {
                        return Some(path.to_string_lossy().to_string());
                    }
                }
            }
        }
    }

    // 4. /run/user/*/ (systemd user runtime dir)
    let run_user = std::path::Path::new("/run/user");
    if let Ok(entries) = std::fs::read_dir(run_user) {
        for entry in entries.flatten() {
            let uid_dir = entry.path();
            if let Ok(subentries) = std::fs::read_dir(&uid_dir) {
                for sub in subentries.flatten() {
                    let subpath = sub.path();
                    if subpath
                        .file_name()
                        .and_then(|n| n.to_str())
                        .map_or(false, |n| n.contains("agent"))
                    {
                        if subpath.exists() {
                            return Some(subpath.to_string_lossy().to_string());
                        }
                    }
                }
            }
        }
    }

    None
}

#[cfg(not(target_os = "windows"))]
fn load_unix_env() {
    let shell = find_user_shell();

    let output = std::process::Command::new(&shell)
        .args(["-ilc", "env -0"])
        .output();

    let vars = match output {
        Ok(o) if o.status.success() => parse_env_output(&o.stdout),
        _ => {
            let output = std::process::Command::new(&shell)
                .args(["-lc", "env -0"])
                .output();
            match output {
                Ok(o) if o.status.success() => parse_env_output(&o.stdout),
                _ => Vec::new(),
            }
        }
    };

    let keys_to_import = ["SSH_AUTH_SOCK", "PATH", "HOME", "USER"];

    for (key, value) in vars {
        if keys_to_import.contains(&key.as_str()) {
            if std::env::var(&key).is_err() || key == "PATH" {
                std::env::set_var(&key, value);
            }
        }
    }

    if std::env::var("SSH_AUTH_SOCK").is_err() {
        if let Some(sock) = find_ssh_agent_socket() {
            std::env::set_var("SSH_AUTH_SOCK", sock);
        }
    }
}

pub fn load_shell_env() {
    #[cfg(target_os = "windows")]
    {
        load_windows_env();
    }
    #[cfg(not(target_os = "windows"))]
    {
        load_unix_env();
    }
}
