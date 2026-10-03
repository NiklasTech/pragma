use crate::modules::dap::install::{self, InstallSpec};
use crate::modules::dap::types::{DapAdapterConfig, DapTransport};
use crate::platform::resolve_program;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

use super::go::{go_available, resolve_go, DELVE_PACKAGE, DELVE_VERSION};
use super::java::{
    java_available, resolve_java, JAVA_DEBUG_ARTIFACT, JAVA_DEBUG_GROUP_PATH, JAVA_DEBUG_SHA256,
    JAVA_DEBUG_VERSION,
};
use super::python::{python_with_debugpy, python_with_module};

// Pinned CodeLLDB release; bump deliberately, never "latest".
const CODELLDB_TAG: &str = "v1.11.5";

pub(super) struct AdapterEntry {
    pub(super) id: &'static str,
    pub(super) label: &'static str,
    pub(super) dap_id: &'static str,
    pub(super) languages: &'static [&'static str],
    pub(super) install_hint: Option<&'static str>,
    pub(super) install: Option<InstallSpec>,
}

pub(super) const ADAPTERS: &[AdapterEntry] = &[
    AdapterEntry {
        id: "node",
        label: "Node.js (vscode-js-debug)",
        dap_id: "pwa-node",
        languages: &["javascript", "typescript"],
        install_hint: Some("npm install -g vscode-js-debug"),
        install: Some(InstallSpec::Npm {
            package: "vscode-js-debug",
        }),
    },
    AdapterEntry {
        id: "python",
        label: "Python (debugpy)",
        dap_id: "python",
        languages: &["python"],
        install_hint: Some("pip install debugpy"),
        install: Some(InstallSpec::Pip { package: "debugpy" }),
    },
    AdapterEntry {
        id: "lldb",
        label: "CodeLLDB",
        dap_id: "lldb",
        languages: &["rust", "c", "cpp"],
        install_hint: Some("Downloaded automatically from GitHub releases"),
        install: Some(InstallSpec::GitHubRelease {
            repo: "vadimcn/codelldb",
            tag: CODELLDB_TAG,
            asset_prefix: "codelldb",
        }),
    },
    AdapterEntry {
        id: "go",
        label: "Go (Delve)",
        dap_id: "go",
        languages: &["go"],
        install_hint: Some("Installed with 'go install github.com/go-delve/delve/cmd/dlv'"),
        install: Some(InstallSpec::GoInstall {
            package: DELVE_PACKAGE,
            version: DELVE_VERSION,
        }),
    },
    AdapterEntry {
        id: "java",
        label: "Java (java-debug)",
        dap_id: "java",
        languages: &["java"],
        install_hint: Some(
            "Requires jdtls on PATH (e.g. 'brew install jdtls'); the java-debug plugin is downloaded automatically",
        ),
        install: Some(InstallSpec::MavenJar {
            group_path: JAVA_DEBUG_GROUP_PATH,
            artifact: JAVA_DEBUG_ARTIFACT,
            version: JAVA_DEBUG_VERSION,
            sha256: JAVA_DEBUG_SHA256,
        }),
    },
];

/// Resolve a language id (or an adapter id directly) to its adapter.
pub(super) fn adapter_for_language(language: &str) -> Option<&'static AdapterEntry> {
    let normalized = language.to_ascii_lowercase();
    ADAPTERS.iter().find(|a| a.id == normalized).or_else(|| {
        ADAPTERS
            .iter()
            .find(|a| a.languages.contains(&normalized.as_str()))
    })
}

/// Managed adapters live outside the workspace: `<app_local_data>/adapters/`.
pub(super) fn adapters_dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("Cannot resolve app data dir: {e}"))?
        .join("adapters"))
}

fn managed_lldb_binary(adapters_dir: &Path) -> PathBuf {
    adapters_dir
        .join("lldb")
        .join(install::codelldb_binary_relative())
}

/// Resolves an adapter id to a spawnable command.
///
/// Node: `PRAGMA_JS_DEBUG_PATH` may point at the vscode-js-debug
/// `dapDebugServer.js` entry (run through `node`); otherwise the
/// `js-debug-dap` binary from the `vscode-js-debug` npm package is used.
/// Python: `python -m debugpy.adapter` from the `debugpy` package.
/// CodeLLDB: `PRAGMA_CODELLDB_PATH` or a `codelldb` on PATH win over the
/// managed copy under the adapters dir; it speaks DAP over TCP (`--port`).
/// Go and Java: see `go.rs` and `java.rs`.
pub(super) fn resolve_adapter(
    id: &str,
    adapters_dir: Option<&Path>,
    workspace_root: &str,
) -> Option<DapAdapterConfig> {
    match id {
        "node" => {
            if let Ok(path) = std::env::var("PRAGMA_JS_DEBUG_PATH") {
                if !path.is_empty() {
                    return Some(DapAdapterConfig {
                        command: "node".to_string(),
                        args: vec![path],
                        transport: DapTransport::Stdio,
                    });
                }
            }
            Some(DapAdapterConfig {
                command: "js-debug-dap".to_string(),
                args: Vec::new(),
                transport: DapTransport::Stdio,
            })
        }
        "python" => {
            let python = python_with_debugpy()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|| "python".to_string());
            Some(DapAdapterConfig {
                command: python,
                args: vec!["-m".to_string(), "debugpy.adapter".to_string()],
                transport: DapTransport::Stdio,
            })
        }
        "lldb" => {
            let args = vec!["--port".to_string(), "{port}".to_string()];
            if let Ok(path) = std::env::var("PRAGMA_CODELLDB_PATH") {
                if !path.is_empty() {
                    return Some(DapAdapterConfig {
                        command: path,
                        args,
                        transport: DapTransport::Tcp,
                    });
                }
            }
            if resolve_program("codelldb").is_ok() {
                return Some(DapAdapterConfig {
                    command: "codelldb".to_string(),
                    args,
                    transport: DapTransport::Tcp,
                });
            }
            if let Some(dir) = adapters_dir {
                let managed = managed_lldb_binary(dir);
                if managed.is_file() {
                    return Some(DapAdapterConfig {
                        command: managed.to_string_lossy().to_string(),
                        args,
                        transport: DapTransport::Tcp,
                    });
                }
            }
            // Fall back to a bare name so the spawn error names the binary.
            Some(DapAdapterConfig {
                command: "codelldb".to_string(),
                args,
                transport: DapTransport::Tcp,
            })
        }
        "go" => Some(resolve_go(adapters_dir)),
        "java" => resolve_java(adapters_dir, workspace_root),
        _ => None,
    }
}

pub(super) async fn check_adapter_available(id: &str, adapters_dir: Option<&Path>) -> bool {
    match id {
        "node" => {
            if let Ok(path) = std::env::var("PRAGMA_JS_DEBUG_PATH") {
                if !path.is_empty() {
                    return std::path::Path::new(&path).is_file()
                        && resolve_program("node").is_ok();
                }
            }
            resolve_program("js-debug-dap").is_ok()
        }
        "python" => python_with_module("debugpy").await.is_some(),
        "lldb" => {
            if let Ok(path) = std::env::var("PRAGMA_CODELLDB_PATH") {
                if !path.is_empty() {
                    return std::path::Path::new(&path).is_file();
                }
            }
            resolve_program("codelldb").is_ok()
                || adapters_dir
                    .map(|dir| managed_lldb_binary(dir).is_file())
                    .unwrap_or(false)
        }
        "go" => go_available(adapters_dir),
        "java" => java_available(adapters_dir),
        _ => false,
    }
}

/// Last non-empty stderr lines, for compact error reporting.
pub(super) fn stderr_tail(stderr: &str) -> String {
    let lines: Vec<&str> = stderr.lines().filter(|l| !l.trim().is_empty()).collect();
    lines
        .iter()
        .rev()
        .take(3)
        .rev()
        .copied()
        .collect::<Vec<_>>()
        .join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_adapter_has_an_install_spec() {
        for entry in ADAPTERS {
            assert!(
                entry.install.is_some(),
                "adapter '{}' has no install spec",
                entry.id
            );
        }
    }

    #[test]
    fn language_resolution_maps_registry_languages() {
        assert_eq!(adapter_for_language("python").unwrap().id, "python");
        assert_eq!(adapter_for_language("javascript").unwrap().id, "node");
        assert_eq!(adapter_for_language("typescript").unwrap().id, "node");
        assert_eq!(adapter_for_language("rust").unwrap().id, "lldb");
        assert_eq!(adapter_for_language("c").unwrap().id, "lldb");
        assert_eq!(adapter_for_language("cpp").unwrap().id, "lldb");
        assert_eq!(adapter_for_language("go").unwrap().id, "go");
        assert_eq!(adapter_for_language("java").unwrap().id, "java");
    }

    #[test]
    fn language_resolution_accepts_adapter_ids() {
        assert_eq!(adapter_for_language("lldb").unwrap().id, "lldb");
        assert_eq!(adapter_for_language("node").unwrap().id, "node");
        assert!(adapter_for_language("ruby").is_none());
    }

    #[test]
    fn python_install_is_pip() {
        let entry = ADAPTERS.iter().find(|a| a.id == "python").unwrap();
        assert!(matches!(
            entry.install,
            Some(InstallSpec::Pip { package: "debugpy" })
        ));
    }

    #[test]
    fn node_install_is_npm() {
        let entry = ADAPTERS.iter().find(|a| a.id == "node").unwrap();
        assert!(matches!(
            entry.install,
            Some(InstallSpec::Npm {
                package: "vscode-js-debug"
            })
        ));
    }

    #[test]
    fn lldb_install_is_a_pinned_github_release() {
        let entry = ADAPTERS.iter().find(|a| a.id == "lldb").unwrap();
        match entry.install {
            Some(InstallSpec::GitHubRelease {
                repo,
                tag,
                asset_prefix,
            }) => {
                assert_eq!(repo, "vadimcn/codelldb");
                assert!(tag.starts_with('v'), "tag must be pinned, got '{tag}'");
                assert_eq!(asset_prefix, "codelldb");
            }
            other => panic!("lldb install spec must be a GitHub release, got {other:?}"),
        }
    }

    #[test]
    fn lldb_resolves_to_tcp_transport_with_port_placeholder() {
        let config = resolve_adapter("lldb", None, "/ws").unwrap();
        assert_eq!(config.transport, DapTransport::Tcp);
        assert!(config.args.iter().any(|a| a == "{port}"));
    }

    #[test]
    fn go_install_is_a_pinned_go_install() {
        let entry = ADAPTERS.iter().find(|a| a.id == "go").unwrap();
        match entry.install {
            Some(InstallSpec::GoInstall { package, version }) => {
                assert_eq!(package, "github.com/go-delve/delve/cmd/dlv");
                assert!(version.starts_with('v'), "version must be pinned");
            }
            other => panic!("go install spec must be a go install, got {other:?}"),
        }
    }

    #[test]
    fn java_install_is_a_checksummed_maven_jar() {
        let entry = ADAPTERS.iter().find(|a| a.id == "java").unwrap();
        assert!(matches!(
            entry.install,
            Some(InstallSpec::MavenJar {
                artifact: "com.microsoft.java.debug.plugin",
                ..
            })
        ));
    }

    #[test]
    fn stderr_tail_keeps_last_lines() {
        assert_eq!(stderr_tail("a\n\nb\nc\nd\ne\n"), "c\nd\ne");
        assert_eq!(stderr_tail(""), "");
    }
}
