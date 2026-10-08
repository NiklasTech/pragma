use base64::Engine;
use portable_pty::CommandBuilder;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

const ZSHENV: &str = include_str!("scripts/zshenv.zsh");
const ZSHRC: &str = include_str!("scripts/zshrc.zsh");
const BASH: &str = include_str!("scripts/bash.sh");
const FISH: &str = include_str!("scripts/fish.fish");
const POWERSHELL: &str = include_str!("scripts/powershell.ps1");

#[derive(Debug, PartialEq, Eq)]
enum ShellKind {
    Zsh,
    Bash,
    Fish,
    PowerShell,
}

fn shell_kind(shell: &str) -> Option<ShellKind> {
    let file_name = shell.rsplit(['/', '\\']).next()?.to_ascii_lowercase();
    let name = file_name.strip_suffix(".exe").unwrap_or(&file_name);
    match name {
        "zsh" => Some(ShellKind::Zsh),
        // The System32 bash.exe launches WSL, which cannot read a Windows path as its init file.
        "bash" if !shell.to_ascii_lowercase().contains("system32") => Some(ShellKind::Bash),
        "fish" => Some(ShellKind::Fish),
        "pwsh" | "powershell" => Some(ShellKind::PowerShell),
        _ => None,
    }
}

/// Writes `contents` only when it changed, through a rename so a starting shell never reads a partial file.
fn install_file(path: &Path, contents: &str) -> std::io::Result<()> {
    if std::fs::read_to_string(path).is_ok_and(|existing| existing == contents) {
        return Ok(());
    }
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let temp = path.with_extension(format!("tmp-{}", uuid::Uuid::new_v4()));
    std::fs::write(&temp, contents)?;
    std::fs::rename(&temp, path).inspect_err(|_| {
        let _ = std::fs::remove_file(&temp);
    })
}

fn fish_quote(value: &str) -> String {
    format!("'{}'", value.replace('\\', "\\\\").replace('\'', "\\'"))
}

fn powershell_encoded_command(script: &str) -> String {
    let utf16: Vec<u8> = script.encode_utf16().flat_map(u16::to_le_bytes).collect();
    base64::engine::general_purpose::STANDARD.encode(utf16)
}

fn user_zdotdir(cmd: &CommandBuilder, zsh_dir: &Path) -> Option<String> {
    let zdotdir = cmd
        .get_env("ZDOTDIR")
        .filter(|value| !value.is_empty() && Path::new(value) != zsh_dir)
        .or_else(|| cmd.get_env("HOME"))?;
    Some(zdotdir.to_string_lossy().into_owned())
}

/// Points a supported shell at the integration script that reports prompts and commands with OSC 133.
fn inject(cmd: &mut CommandBuilder, shell: &str, dir: &Path) -> std::io::Result<()> {
    let Some(kind) = shell_kind(shell) else {
        return Ok(());
    };
    match kind {
        ShellKind::Zsh => {
            let zsh_dir = dir.join("zsh");
            install_file(&zsh_dir.join(".zshenv"), ZSHENV)?;
            install_file(&zsh_dir.join(".zshrc"), ZSHRC)?;
            if let Some(zdotdir) = user_zdotdir(cmd, &zsh_dir) {
                cmd.env("PRAGMA_USER_ZDOTDIR", zdotdir);
            }
            cmd.env("ZDOTDIR", zsh_dir);
        }
        ShellKind::Bash => {
            let script = dir.join("bash").join("pragma.bash");
            install_file(&script, BASH)?;
            cmd.arg("--init-file");
            cmd.arg(script);
        }
        ShellKind::Fish => {
            let script = dir.join("fish").join("pragma.fish");
            install_file(&script, FISH)?;
            cmd.arg("--init-command");
            cmd.arg(format!("source {}", fish_quote(&script.to_string_lossy())));
        }
        ShellKind::PowerShell => {
            let has_no_exit = cmd
                .get_argv()
                .iter()
                .any(|arg| arg.to_string_lossy().eq_ignore_ascii_case("-NoExit"));
            if !has_no_exit {
                cmd.arg("-NoExit");
            }
            cmd.arg("-EncodedCommand");
            cmd.arg(powershell_encoded_command(POWERSHELL));
        }
    }
    Ok(())
}

fn integration_dir(app: &AppHandle) -> tauri::Result<PathBuf> {
    Ok(app.path().app_cache_dir()?.join("shell-integration"))
}

/// Adds shell integration to an interactive shell; the shell still starts without it on failure.
pub fn apply(app: &AppHandle, cmd: &mut CommandBuilder, shell: &str) {
    let result = integration_dir(app)
        .map_err(|e| e.to_string())
        .and_then(|dir| inject(cmd, shell, &dir).map_err(|e| e.to_string()));
    if let Err(e) = result {
        log::warn!("shell integration unavailable for {shell}: {e}");
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::ffi::{OsStr, OsString};

    #[test]
    fn shell_kind_detects_supported_shells() {
        assert_eq!(shell_kind("/bin/zsh"), Some(ShellKind::Zsh));
        assert_eq!(shell_kind("/opt/homebrew/bin/bash"), Some(ShellKind::Bash));
        assert_eq!(shell_kind("/usr/local/bin/fish"), Some(ShellKind::Fish));
        assert_eq!(
            shell_kind(r"C:\Program Files\PowerShell\7\PWSH.EXE"),
            Some(ShellKind::PowerShell)
        );
        assert_eq!(
            shell_kind(r"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"),
            Some(ShellKind::PowerShell)
        );
        assert_eq!(
            shell_kind(r"C:\Program Files\Git\bin\bash.exe"),
            Some(ShellKind::Bash)
        );
        assert_eq!(shell_kind(r"C:\Windows\System32\bash.exe"), None);
        assert_eq!(shell_kind("/bin/sh"), None);
        assert_eq!(shell_kind(r"C:\Windows\System32\cmd.exe"), None);
    }

    #[test]
    fn install_file_writes_and_replaces_contents() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("nested").join("script");

        install_file(&path, "one").unwrap();
        install_file(&path, "one").unwrap();
        install_file(&path, "two").unwrap();

        assert_eq!(std::fs::read_to_string(&path).unwrap(), "two");
        assert_eq!(
            std::fs::read_dir(path.parent().unwrap()).unwrap().count(),
            1
        );
    }

    #[test]
    fn inject_points_zsh_at_the_integration_dir() {
        let dir = tempfile::tempdir().unwrap();
        let mut cmd = CommandBuilder::new("/bin/zsh");
        cmd.env("HOME", "/home/user");
        cmd.env_remove("ZDOTDIR");

        inject(&mut cmd, "/bin/zsh", dir.path()).unwrap();

        let zsh_dir = dir.path().join("zsh");
        assert_eq!(cmd.get_env("ZDOTDIR"), Some(zsh_dir.as_os_str()));
        assert_eq!(
            cmd.get_env("PRAGMA_USER_ZDOTDIR"),
            Some(OsStr::new("/home/user"))
        );
        assert_eq!(
            std::fs::read_to_string(zsh_dir.join(".zshrc")).unwrap(),
            ZSHRC
        );
        assert!(zsh_dir.join(".zshenv").is_file());
    }

    #[test]
    fn inject_keeps_a_custom_zdotdir_but_not_its_own() {
        let dir = tempfile::tempdir().unwrap();
        let zsh_dir = dir.path().join("zsh");

        let mut custom = CommandBuilder::new("/bin/zsh");
        custom.env("HOME", "/home/user");
        custom.env("ZDOTDIR", "/home/user/.config/zsh");
        inject(&mut custom, "/bin/zsh", dir.path()).unwrap();

        let mut nested = CommandBuilder::new("/bin/zsh");
        nested.env("HOME", "/home/user");
        nested.env("ZDOTDIR", &zsh_dir);
        inject(&mut nested, "/bin/zsh", dir.path()).unwrap();

        assert_eq!(
            custom.get_env("PRAGMA_USER_ZDOTDIR"),
            Some(OsStr::new("/home/user/.config/zsh"))
        );
        assert_eq!(
            nested.get_env("PRAGMA_USER_ZDOTDIR"),
            Some(OsStr::new("/home/user"))
        );
    }

    #[test]
    fn inject_passes_init_scripts_to_bash_and_fish() {
        let dir = tempfile::tempdir().unwrap();
        let mut bash = CommandBuilder::new("/bin/bash");
        let mut fish = CommandBuilder::new("/usr/bin/fish");

        inject(&mut bash, "/bin/bash", dir.path()).unwrap();
        inject(&mut fish, "/usr/bin/fish", dir.path()).unwrap();

        let bash_script = dir.path().join("bash").join("pragma.bash");
        let fish_script = dir.path().join("fish").join("pragma.fish");
        assert_eq!(
            bash.get_argv()[1..],
            [OsString::from("--init-file"), bash_script.into_os_string()]
        );
        assert_eq!(
            fish.get_argv()[1..],
            [
                OsString::from("--init-command"),
                OsString::from(format!(
                    "source {}",
                    fish_quote(&fish_script.to_string_lossy())
                ))
            ]
        );
        assert!(fish_script.is_file());
    }

    #[test]
    fn inject_runs_the_powershell_script_once_and_keeps_the_shell_open() {
        let dir = tempfile::tempdir().unwrap();
        let mut pwsh = CommandBuilder::new("/usr/local/bin/pwsh");
        let mut windows = CommandBuilder::new("pwsh.exe");
        windows.arg("-NoExit");

        inject(&mut pwsh, "/usr/local/bin/pwsh", dir.path()).unwrap();
        inject(&mut windows, "pwsh.exe", dir.path()).unwrap();

        let encoded = OsString::from(powershell_encoded_command(POWERSHELL));
        assert_eq!(
            pwsh.get_argv()[1..],
            [
                OsString::from("-NoExit"),
                OsString::from("-EncodedCommand"),
                encoded.clone()
            ]
        );
        assert_eq!(
            windows.get_argv()[1..],
            [
                OsString::from("-NoExit"),
                OsString::from("-EncodedCommand"),
                encoded
            ]
        );
    }

    #[test]
    fn inject_leaves_other_shells_untouched() {
        let dir = tempfile::tempdir().unwrap();
        let mut cmd = CommandBuilder::new("/bin/sh");

        inject(&mut cmd, "/bin/sh", dir.path()).unwrap();

        assert_eq!(cmd.get_argv().len(), 1);
        assert_eq!(std::fs::read_dir(dir.path()).unwrap().count(), 0);
    }

    #[test]
    fn helpers_quote_and_encode() {
        assert_eq!(fish_quote(r"/a b/it's\x"), r"'/a b/it\'s\\x'");
        assert_eq!(powershell_encoded_command("A"), "QQA=");
    }
}
