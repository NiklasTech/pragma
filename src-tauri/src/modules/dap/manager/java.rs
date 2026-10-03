use crate::modules::dap::install::maven_jar_name;
use crate::modules::dap::types::{DapAdapterConfig, DapTransport};
use crate::platform::resolve_program;
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};

// Pinned java-debug plugin from Maven Central; bump the version and checksum together.
pub(super) const JAVA_DEBUG_VERSION: &str = "0.53.1";
pub(super) const JAVA_DEBUG_SHA256: &str =
    "4f4778d452a6a0665536f43ce4e32403a24be6593336b80dc85a322912859e24";
pub(super) const JAVA_DEBUG_GROUP_PATH: &str = "com/microsoft/java";
pub(super) const JAVA_DEBUG_ARTIFACT: &str = "com.microsoft.java.debug.plugin";

pub(super) fn java_adapter_dir(adapters_dir: &Path) -> PathBuf {
    adapters_dir.join("java")
}

fn java_debug_jar(adapters_dir: &Path) -> PathBuf {
    java_adapter_dir(adapters_dir).join(maven_jar_name(JAVA_DEBUG_ARTIFACT, JAVA_DEBUG_VERSION))
}

/// One jdtls data directory per workspace, so project imports do not collide.
fn jdtls_data_dir(adapters_dir: &Path, workspace_root: &str) -> PathBuf {
    let digest = Sha256::digest(workspace_root.as_bytes());
    let key: String = digest
        .iter()
        .take(8)
        .map(|byte| format!("{byte:02x}"))
        .collect();
    java_adapter_dir(adapters_dir).join("workspaces").join(key)
}

/// java-debug runs inside jdtls: Pragma starts a dedicated jdtls with the
/// plugin bundle, asks it to open a debug session and talks DAP to the port
/// it returns.
pub(super) fn resolve_java(
    adapters_dir: Option<&Path>,
    workspace_root: &str,
) -> Option<DapAdapterConfig> {
    let dir = adapters_dir?;
    Some(DapAdapterConfig {
        command: "jdtls".to_string(),
        args: vec![
            "-data".to_string(),
            jdtls_data_dir(dir, workspace_root)
                .to_string_lossy()
                .to_string(),
        ],
        transport: DapTransport::Jdtls {
            bundle: java_debug_jar(dir).to_string_lossy().to_string(),
            root: workspace_root.to_string(),
        },
    })
}

pub(super) fn jdtls_available() -> bool {
    resolve_program("jdtls").is_ok()
}

pub(super) fn java_available(adapters_dir: Option<&Path>) -> bool {
    jdtls_available()
        && adapters_dir
            .map(|dir| java_debug_jar(dir).is_file())
            .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn checksum_is_a_sha256_hex_digest() {
        assert_eq!(JAVA_DEBUG_SHA256.len(), 64);
        assert!(JAVA_DEBUG_SHA256.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn resolves_to_jdtls_with_bundle_and_root() {
        let config = resolve_java(Some(Path::new("/adapters")), "/ws/app").unwrap();
        assert_eq!(config.command, "jdtls");
        assert_eq!(config.args[0], "-data");
        assert!(Path::new(&config.args[1]).starts_with("/adapters/java/workspaces"));
        match config.transport {
            DapTransport::Jdtls { bundle, root } => {
                assert!(bundle.ends_with("com.microsoft.java.debug.plugin-0.53.1.jar"));
                assert_eq!(root, "/ws/app");
            }
            other => panic!("expected the jdtls transport, got {other:?}"),
        }
    }

    #[test]
    fn data_dirs_differ_per_workspace() {
        let dir = Path::new("/adapters");
        assert_ne!(jdtls_data_dir(dir, "/a"), jdtls_data_dir(dir, "/b"));
        assert_eq!(jdtls_data_dir(dir, "/a"), jdtls_data_dir(dir, "/a"));
    }

    #[test]
    fn needs_the_managed_adapters_dir() {
        assert!(resolve_java(None, "/ws").is_none());
    }
}
