use super::config::server_config_for_language;
use super::{ServerEntry, SERVERS};
use crate::ai::cli::manager::enriched_path;
use crate::modules::lsp::manager::resolve_command;
use crate::modules::lsp::types::LspServerConfig;
use crate::platform::new_tokio_command;
use std::path::{Path, PathBuf};
use std::time::Duration;

const TOOLCHAIN_PROBE_TIMEOUT: Duration = Duration::from_secs(5);

/// Places a project can provide its own language server binary, tried before PATH.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum LocalCandidate {
    /// `<root>/node_modules/.bin/<command>`
    NodeModulesBin,
    /// `<root>/.venv` or `<root>/venv` scripts directory.
    PythonVenv,
    /// `<root>/bin/<command>` binstub, as Bundler generates it.
    ProjectBin,
    /// The workspace TypeScript's own `tsc --lsp` when it ships no `tsserver.js`.
    TypeScriptNativeLsp,
    /// The binary of the toolchain the project pins, via `rustup which`.
    RustupToolchain,
}

/// Resolves the server for a project root: local candidates in order, then the global command.
pub(super) async fn resolve_server_config(
    language: &str,
    project_root: &str,
) -> Option<LspServerConfig> {
    let entry = SERVERS.iter().find(|s| s.language == language)?;
    let global = server_config_for_language(language)?;

    let root = Path::new(project_root);
    if project_root.is_empty() || !root.is_dir() {
        return Some(global);
    }

    for candidate in entry.local {
        if let Some((command, args)) = resolve_candidate(*candidate, entry, root).await {
            return Some(LspServerConfig {
                command: command.to_string_lossy().to_string(),
                args,
                ..global
            });
        }
    }

    Some(global)
}

async fn resolve_candidate(
    candidate: LocalCandidate,
    entry: &ServerEntry,
    root: &Path,
) -> Option<(PathBuf, Vec<String>)> {
    let default_args = || entry.args.iter().map(|a| a.to_string()).collect();
    match candidate {
        LocalCandidate::NodeModulesBin => {
            node_modules_bin(root, entry.command).map(|path| (path, default_args()))
        }
        LocalCandidate::PythonVenv => {
            python_venv_bin(root, entry.command).map(|path| (path, default_args()))
        }
        LocalCandidate::ProjectBin => local_file(root, &root.join("bin").join(entry.command))
            .map(|path| (path, default_args())),
        LocalCandidate::TypeScriptNativeLsp => typescript_native_lsp(root).map(|path| {
            let args = ["--lsp", "--stdio"].iter().map(|a| a.to_string()).collect();
            (path, args)
        }),
        LocalCandidate::RustupToolchain => rustup_toolchain_bin(root, entry.command)
            .await
            .map(|path| (path, default_args())),
    }
}

fn node_modules_bin(root: &Path, command: &str) -> Option<PathBuf> {
    let bin = root.join("node_modules").join(".bin");
    let name = if cfg!(target_os = "windows") {
        format!("{command}.cmd")
    } else {
        command.to_string()
    };
    local_file(root, &bin.join(name))
}

fn python_venv_bin(root: &Path, command: &str) -> Option<PathBuf> {
    let (scripts, name) = if cfg!(target_os = "windows") {
        ("Scripts", format!("{command}.exe"))
    } else {
        ("bin", command.to_string())
    };
    [".venv", "venv"]
        .iter()
        .find_map(|venv| local_file(root, &root.join(venv).join(scripts).join(&name)))
}

/// Uses the native server only when the package has no `tsserver.js` for
/// typescript-language-server to wrap and ships the native compiler launcher instead.
fn typescript_native_lsp(root: &Path) -> Option<PathBuf> {
    let lib = root.join("node_modules").join("typescript").join("lib");
    if !lib.is_dir() || lib.join("tsserver.js").exists() || !lib.join("getExePath.js").is_file() {
        return None;
    }
    node_modules_bin(root, "tsc")
}

/// Runs `rustup which` in the project root so a pinned `rust-toolchain.toml` applies.
async fn rustup_toolchain_bin(root: &Path, command: &str) -> Option<PathBuf> {
    let path = enriched_path();
    let rustup = resolve_command("rustup", &path);
    let mut cmd = new_tokio_command(&rustup);
    cmd.args(["which", command])
        .current_dir(root)
        .env("PATH", &path)
        .kill_on_drop(true);
    let output = tokio::time::timeout(TOOLCHAIN_PROBE_TIMEOUT, cmd.output())
        .await
        .ok()?
        .ok()?;
    if !output.status.success() {
        return None;
    }
    toolchain_file(String::from_utf8_lossy(&output.stdout).trim())
}

/// A toolchain binary lives outside the project, so it only has to be an existing file.
fn toolchain_file(reported: &str) -> Option<PathBuf> {
    if reported.is_empty() {
        return None;
    }
    let path = PathBuf::from(reported);
    let canonical = path.canonicalize().ok()?;
    canonical.is_file().then_some(path)
}

/// Accepts `path` only if it is an existing file that resolves to a location inside `root`.
fn local_file(root: &Path, path: &Path) -> Option<PathBuf> {
    let canonical_root = root.canonicalize().ok()?;
    let canonical = path.canonicalize().ok()?;
    (canonical.starts_with(&canonical_root) && canonical.is_file()).then(|| path.to_path_buf())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn temp_root(name: &str) -> PathBuf {
        let temp = std::env::temp_dir().join(format!("pragma-lsp-resolve-{name}"));
        let _ = fs::remove_dir_all(&temp);
        fs::create_dir_all(&temp).unwrap();
        temp
    }

    fn touch(path: &Path) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, "").unwrap();
    }

    fn bin_name(command: &str) -> String {
        if cfg!(target_os = "windows") {
            format!("{command}.cmd")
        } else {
            command.to_string()
        }
    }

    fn typescript_package(root: &Path, ships_tsserver: bool) {
        let lib = root.join("node_modules/typescript/lib");
        touch(&lib.join("getExePath.js"));
        if ships_tsserver {
            touch(&lib.join("tsserver.js"));
        }
        touch(&root.join("node_modules/.bin").join(bin_name("tsc")));
    }

    async fn resolve(language: &str, root: &Path) -> LspServerConfig {
        resolve_server_config(language, root.to_str().unwrap())
            .await
            .unwrap()
    }

    #[tokio::test]
    async fn typescript_without_tsserver_uses_the_native_server() {
        let root = temp_root("ts-native");
        typescript_package(&root, false);
        touch(
            &root
                .join("node_modules/.bin")
                .join(bin_name("typescript-language-server")),
        );

        for language in ["typescript", "javascript"] {
            let config = resolve(language, &root).await;
            assert_eq!(
                PathBuf::from(&config.command),
                root.join("node_modules/.bin").join(bin_name("tsc"))
            );
            assert_eq!(config.args, vec!["--lsp", "--stdio"]);
        }

        let _ = fs::remove_dir_all(&root);
    }

    #[tokio::test]
    async fn typescript_with_tsserver_prefers_the_local_wrapper() {
        let root = temp_root("ts-tsserver");
        typescript_package(&root, true);
        let wrapper = root
            .join("node_modules/.bin")
            .join(bin_name("typescript-language-server"));
        touch(&wrapper);

        let config = resolve("typescript", &root).await;
        assert_eq!(PathBuf::from(&config.command), wrapper);
        assert_eq!(config.args, vec!["--stdio"]);

        let _ = fs::remove_dir_all(&root);
    }

    #[tokio::test]
    async fn typescript_with_tsserver_and_no_local_wrapper_falls_back_to_path() {
        let root = temp_root("ts-global");
        typescript_package(&root, true);

        let config = resolve("typescript", &root).await;
        assert_eq!(config.command, "typescript-language-server");
        assert_eq!(config.args, vec!["--stdio"]);

        let _ = fs::remove_dir_all(&root);
    }

    #[tokio::test]
    async fn typescript_without_native_launcher_falls_back_to_path() {
        let root = temp_root("ts-no-launcher");
        touch(&root.join("node_modules/typescript/lib/tsc.js"));
        touch(&root.join("node_modules/.bin").join(bin_name("tsc")));

        let config = resolve("typescript", &root).await;
        assert_eq!(config.command, "typescript-language-server");

        let _ = fs::remove_dir_all(&root);
    }

    #[tokio::test]
    async fn npm_servers_use_node_modules_bin() {
        let root = temp_root("npm-bin");
        for (language, command) in [
            ("html", "vscode-html-language-server"),
            ("css", "vscode-css-language-server"),
            ("shell", "bash-language-server"),
        ] {
            let binary = root.join("node_modules/.bin").join(bin_name(command));
            touch(&binary);
            let config = resolve(language, &root).await;
            assert_eq!(PathBuf::from(&config.command), binary, "{language}");
        }

        let _ = fs::remove_dir_all(&root);
    }

    #[tokio::test]
    async fn python_uses_the_project_venv() {
        let root = temp_root("python-venv");
        let binary = if cfg!(target_os = "windows") {
            root.join("venv/Scripts/pylsp.exe")
        } else {
            root.join("venv/bin/pylsp")
        };
        touch(&binary);

        let config = resolve("python", &root).await;
        assert_eq!(PathBuf::from(&config.command), binary);

        let dot_venv = if cfg!(target_os = "windows") {
            root.join(".venv/Scripts/pylsp.exe")
        } else {
            root.join(".venv/bin/pylsp")
        };
        touch(&dot_venv);
        let config = resolve("python", &root).await;
        assert_eq!(PathBuf::from(&config.command), dot_venv);

        let _ = fs::remove_dir_all(&root);
    }

    #[tokio::test]
    async fn ruby_uses_the_project_binstub() {
        let root = temp_root("ruby-binstub");
        let binary = root.join("bin/ruby-lsp");
        touch(&binary);

        let config = resolve("ruby", &root).await;
        assert_eq!(PathBuf::from(&config.command), binary);

        let _ = fs::remove_dir_all(&root);
    }

    #[tokio::test]
    async fn missing_local_binaries_fall_back_to_path() {
        let root = temp_root("fallback");
        for (language, command) in [
            ("typescript", "typescript-language-server"),
            ("html", "vscode-html-language-server"),
            ("python", "pylsp"),
            ("ruby", "ruby-lsp"),
            ("go", "gopls"),
        ] {
            let config = resolve(language, &root).await;
            assert_eq!(config.command, command, "{language}");
        }

        let _ = fs::remove_dir_all(&root);
    }

    #[tokio::test]
    async fn an_empty_or_missing_root_uses_the_global_command() {
        let config = resolve_server_config("typescript", "").await.unwrap();
        assert_eq!(config.command, "typescript-language-server");

        let missing = std::env::temp_dir().join("pragma-lsp-resolve-does-not-exist");
        let config = resolve("python", &missing).await;
        assert_eq!(config.command, "pylsp");
    }

    #[tokio::test]
    async fn unknown_languages_resolve_to_nothing() {
        let root = temp_root("unknown");
        assert!(resolve_server_config("cobol", root.to_str().unwrap())
            .await
            .is_none());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn local_file_rejects_directories_and_missing_paths() {
        let root = temp_root("local-file");
        fs::create_dir_all(root.join("bin/ruby-lsp")).unwrap();
        assert!(local_file(&root, &root.join("bin/ruby-lsp")).is_none());
        assert!(local_file(&root, &root.join("bin/missing")).is_none());

        let _ = fs::remove_dir_all(&root);
    }

    #[cfg(unix)]
    #[test]
    fn local_file_rejects_symlinks_that_leave_the_root() {
        let root = temp_root("escape");
        let outside = temp_root("escape-target");
        let target = outside.join("pylsp");
        touch(&target);
        fs::create_dir_all(root.join(".venv/bin")).unwrap();
        std::os::unix::fs::symlink(&target, root.join(".venv/bin/pylsp")).unwrap();

        assert!(local_file(&root, &root.join(".venv/bin/pylsp")).is_none());

        let _ = fs::remove_dir_all(&root);
        let _ = fs::remove_dir_all(&outside);
    }

    #[test]
    fn toolchain_file_requires_an_existing_file() {
        let root = temp_root("toolchain");
        let binary = root.join("rust-analyzer");
        touch(&binary);

        assert_eq!(toolchain_file(binary.to_str().unwrap()), Some(binary));
        assert!(toolchain_file("").is_none());
        assert!(toolchain_file(root.join("missing").to_str().unwrap()).is_none());
        assert!(toolchain_file(root.to_str().unwrap()).is_none());

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn servers_declare_their_local_candidates() {
        let local = |language: &str| {
            SERVERS
                .iter()
                .find(|s| s.language == language)
                .map(|s| s.local)
                .unwrap()
        };
        assert_eq!(
            local("typescript"),
            [
                LocalCandidate::TypeScriptNativeLsp,
                LocalCandidate::NodeModulesBin
            ]
        );
        assert_eq!(local("rust"), [LocalCandidate::RustupToolchain]);
        assert!(local("go").is_empty());
    }
}
