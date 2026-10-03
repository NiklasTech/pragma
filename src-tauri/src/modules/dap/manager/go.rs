use crate::modules::dap::types::{DapAdapterConfig, DapTransport};
use crate::platform::resolve_program;
use std::path::{Path, PathBuf};

// Pinned Delve release; bump deliberately, never "latest".
pub(super) const DELVE_VERSION: &str = "v1.27.2";
pub(super) const DELVE_PACKAGE: &str = "github.com/go-delve/delve/cmd/dlv";

/// `go install` drops the binary into `GOBIN`, which points here during install.
pub(super) fn managed_go_bin_dir(adapters_dir: &Path) -> PathBuf {
    adapters_dir.join("go")
}

fn managed_dlv_binary(adapters_dir: &Path) -> PathBuf {
    let name = if cfg!(target_os = "windows") {
        "dlv.exe"
    } else {
        "dlv"
    };
    managed_go_bin_dir(adapters_dir).join(name)
}

fn configured_dlv_path() -> Option<String> {
    std::env::var("PRAGMA_DLV_PATH")
        .ok()
        .filter(|path| !path.is_empty())
}

/// `PRAGMA_DLV_PATH` or a `dlv` on PATH win over the managed copy; Delve speaks
/// DAP over TCP (`dlv dap --listen`).
pub(super) fn resolve_go(adapters_dir: Option<&Path>) -> DapAdapterConfig {
    let args = vec!["dap".to_string(), "--listen=127.0.0.1:{port}".to_string()];
    let command = configured_dlv_path()
        .or_else(|| resolve_program("dlv").ok().map(|_| "dlv".to_string()))
        .or_else(|| {
            adapters_dir
                .map(managed_dlv_binary)
                .filter(|path| path.is_file())
                .map(|path| path.to_string_lossy().to_string())
        })
        // Fall back to a bare name so the spawn error names the binary.
        .unwrap_or_else(|| "dlv".to_string());
    DapAdapterConfig {
        command,
        args,
        transport: DapTransport::Tcp,
    }
}

pub(super) fn go_available(adapters_dir: Option<&Path>) -> bool {
    if let Some(path) = configured_dlv_path() {
        return Path::new(&path).is_file();
    }
    resolve_program("dlv").is_ok()
        || adapters_dir
            .map(|dir| managed_dlv_binary(dir).is_file())
            .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn delve_listens_on_the_port_placeholder() {
        let config = resolve_go(None);
        assert_eq!(config.transport, DapTransport::Tcp);
        assert_eq!(config.args[0], "dap");
        assert!(config.args[1].contains("{port}"));
    }

    #[test]
    fn managed_binary_lives_in_the_go_adapter_dir() {
        let path = managed_dlv_binary(Path::new("/adapters"));
        assert!(path.starts_with("/adapters/go"));
        assert!(path.to_string_lossy().contains("dlv"));
    }

    #[test]
    fn delve_version_is_pinned() {
        assert!(DELVE_VERSION.starts_with('v'));
    }
}
