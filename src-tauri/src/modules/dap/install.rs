//! Adapter installation: install specs (pip/npm/GitHub release) and the
//! download + extraction of release assets into the managed adapters dir.

use serde::Serialize;
use std::path::{Path, PathBuf};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

const DOWNLOAD_TIMEOUT: Duration = Duration::from_secs(600);

/// How an adapter is provisioned when it is missing.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InstallSpec {
    /// `python -m pip install <package>` (Windows) / `pip install <package>`.
    Pip { package: &'static str },
    /// `npm install -g <package>`.
    Npm { package: &'static str },
    /// Download a platform asset from a pinned GitHub release and extract it.
    GitHubRelease {
        repo: &'static str,
        tag: &'static str,
        asset_prefix: &'static str,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum InstallStage {
    Downloading,
    Extracting,
    Installing,
    Done,
    Error,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DapInstallProgress {
    pub adapter_id: String,
    pub stage: InstallStage,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub percent: Option<u8>,
    pub message: String,
}

pub fn emit_progress(
    app: &AppHandle,
    adapter_id: &str,
    stage: InstallStage,
    percent: Option<u8>,
    message: impl Into<String>,
) {
    let _ = app.emit(
        "dap_install_progress",
        DapInstallProgress {
            adapter_id: adapter_id.to_string(),
            stage,
            percent,
            message: message.into(),
        },
    );
}

/// The `(program, args)` for package-manager based specs; GitHub releases are
/// downloaded directly instead of running a command.
pub fn spec_command(spec: &InstallSpec) -> Option<(&'static str, Vec<String>)> {
    match spec {
        InstallSpec::Pip { package } => {
            // Windows resolves `python` reliably via resolve_program, while a
            // bare `pip` is often missing from PATH; elsewhere `pip` is the
            // conventional entrypoint.
            #[cfg(target_os = "windows")]
            {
                Some((
                    "python",
                    vec![
                        "-m".to_string(),
                        "pip".to_string(),
                        "install".to_string(),
                        package.to_string(),
                    ],
                ))
            }
            #[cfg(not(target_os = "windows"))]
            {
                Some(("pip", vec!["install".to_string(), package.to_string()]))
            }
        }
        InstallSpec::Npm { package } => Some((
            "npm",
            vec!["install".to_string(), "-g".to_string(), package.to_string()],
        )),
        InstallSpec::GitHubRelease { .. } => None,
    }
}

/// Platform triple used in CodeLLDB asset names, e.g. `win32-x64`.
fn platform_target() -> Result<&'static str, String> {
    let os = match std::env::consts::OS {
        "windows" => "win32",
        "linux" => "linux",
        "macos" => "darwin",
        other => return Err(format!("Unsupported OS '{other}'")),
    };
    let arch = match std::env::consts::ARCH {
        "x86_64" => "x64",
        "aarch64" => "arm64",
        other => return Err(format!("Unsupported architecture '{other}'")),
    };
    Ok(match (os, arch) {
        ("win32", "x64") => "win32-x64",
        ("linux", "x64") => "linux-x64",
        ("linux", "arm64") => "linux-arm64",
        ("darwin", "x64") => "darwin-x64",
        ("darwin", "arm64") => "darwin-arm64",
        _ => return Err(format!("Unsupported platform '{os}-{arch}'")),
    })
}

/// Asset file name for the current platform, e.g. `codelldb-win32-x64.vsix`.
pub fn github_asset_name(asset_prefix: &str) -> Result<String, String> {
    Ok(format!("{asset_prefix}-{}.vsix", platform_target()?))
}

pub fn github_download_url(repo: &str, tag: &str, asset: &str) -> String {
    format!("https://github.com/{repo}/releases/download/{tag}/{asset}")
}

async fn download_file(
    app: &AppHandle,
    adapter_id: &str,
    url: &str,
    dest: &Path,
) -> Result<(), String> {
    let response = reqwest::Client::new()
        .get(url)
        .header(reqwest::header::USER_AGENT, "pragma")
        .send()
        .await
        .map_err(|e| format!("Download failed: {e}"))?;
    if !response.status().is_success() {
        return Err(format!("Download failed: HTTP {}", response.status()));
    }
    let total = response.content_length();

    if let Some(parent) = dest.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Cannot create {}: {e}", parent.display()))?;
    }
    let mut file = tokio::fs::File::create(dest)
        .await
        .map_err(|e| format!("Cannot write {}: {e}", dest.display()))?;

    use futures_util::StreamExt;
    use tokio::io::AsyncWriteExt;
    let mut stream = response.bytes_stream();
    let mut downloaded: u64 = 0;
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Download failed: {e}"))?;
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("Cannot write {}: {e}", dest.display()))?;
        downloaded += chunk.len() as u64;
        let percent = total.map(|t| ((downloaded * 100) / t.max(1)).min(100) as u8);
        emit_progress(
            app,
            adapter_id,
            InstallStage::Downloading,
            percent,
            format!("Downloading ({})", format_size(downloaded)),
        );
    }
    file.flush()
        .await
        .map_err(|e| format!("Cannot write {}: {e}", dest.display()))?;
    Ok(())
}

fn format_size(bytes: u64) -> String {
    const MIB: u64 = 1024 * 1024;
    if bytes >= MIB {
        format!("{:.1} MB", bytes as f64 / MIB as f64)
    } else {
        format!("{:.0} KB", bytes as f64 / 1024.0)
    }
}

/// Extract a `.vsix` (zip) into `dest_dir` and mark the adapter binary
/// executable on unix.
fn extract_vsix(archive: &Path, dest_dir: &Path, adapter_binary: &Path) -> Result<(), String> {
    let file = std::fs::File::open(archive)
        .map_err(|e| format!("Cannot open {}: {e}", archive.display()))?;
    let mut zip = zip::ZipArchive::new(file)
        .map_err(|e| format!("Invalid archive {}: {e}", archive.display()))?;

    for index in 0..zip.len() {
        let mut entry = zip
            .by_index(index)
            .map_err(|e| format!("Cannot read archive entry: {e}"))?;
        let Some(name) = entry.enclosed_name().map(|n| n.to_path_buf()) else {
            continue;
        };
        let target = dest_dir.join(&name);
        if entry.is_dir() {
            std::fs::create_dir_all(&target)
                .map_err(|e| format!("Cannot create {}: {e}", target.display()))?;
            continue;
        }
        if let Some(parent) = target.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Cannot create {}: {e}", parent.display()))?;
        }
        let mut out = std::fs::File::create(&target)
            .map_err(|e| format!("Cannot write {}: {e}", target.display()))?;
        std::io::copy(&mut entry, &mut out)
            .map_err(|e| format!("Cannot write {}: {e}", target.display()))?;
    }

    let binary = dest_dir.join(adapter_binary);
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if binary.is_file() {
            let mut permissions = std::fs::metadata(&binary)
                .map_err(|e| format!("Cannot stat {}: {e}", binary.display()))?
                .permissions();
            permissions.set_mode(0o755);
            std::fs::set_permissions(&binary, permissions)
                .map_err(|e| format!("Cannot chmod {}: {e}", binary.display()))?;
        }
    }
    let _ = binary;
    Ok(())
}

/// Run a GitHub release install: download the pinned asset and extract it into
/// the managed adapters dir (`<app_data>/adapters/<adapter_id>/`).
pub async fn install_from_github(
    app: &AppHandle,
    adapter_id: &str,
    repo: &str,
    tag: &str,
    asset_prefix: &str,
    adapters_dir: &Path,
    adapter_binary: &Path,
) -> Result<(), String> {
    let asset = github_asset_name(asset_prefix)?;
    let url = github_download_url(repo, tag, &asset);
    let target_dir = adapters_dir.join(adapter_id);
    let archive_path = target_dir.join(&asset);

    emit_progress(
        app,
        adapter_id,
        InstallStage::Downloading,
        Some(0),
        format!("Downloading {asset}"),
    );
    tokio::time::timeout(
        DOWNLOAD_TIMEOUT,
        download_file(app, adapter_id, &url, &archive_path),
    )
    .await
    .map_err(|_| format!("Download timed out after {}s", DOWNLOAD_TIMEOUT.as_secs()))??;

    emit_progress(
        app,
        adapter_id,
        InstallStage::Extracting,
        None,
        "Extracting adapter".to_string(),
    );
    let binary = adapter_binary.to_path_buf();
    let archive = archive_path.clone();
    let dest = target_dir.clone();
    tokio::task::spawn_blocking(move || extract_vsix(&archive, &dest, &binary))
        .await
        .map_err(|e| format!("Extraction failed: {e}"))??;

    let _ = tokio::fs::remove_file(&archive_path).await;
    Ok(())
}

/// Directory of the codelldb binary inside an extracted vsix.
pub fn codelldb_binary_relative() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        PathBuf::from("extension/adapter/codelldb.exe")
    }
    #[cfg(not(target_os = "windows"))]
    {
        PathBuf::from("extension/adapter/codelldb")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pip_spec_resolves_to_a_command() {
        let (program, args) = spec_command(&InstallSpec::Pip { package: "debugpy" }).unwrap();
        assert!(args.contains(&"debugpy".to_string()));
        #[cfg(target_os = "windows")]
        assert_eq!(program, "python");
        #[cfg(not(target_os = "windows"))]
        assert_eq!(program, "pip");
    }

    #[test]
    fn npm_spec_uses_global_install() {
        let (program, args) = spec_command(&InstallSpec::Npm {
            package: "vscode-js-debug",
        })
        .unwrap();
        assert_eq!(program, "npm");
        assert_eq!(args, ["install", "-g", "vscode-js-debug"]);
    }

    #[test]
    fn github_spec_has_no_command() {
        let spec = InstallSpec::GitHubRelease {
            repo: "vadimcn/codelldb",
            tag: "v1.11.5",
            asset_prefix: "codelldb",
        };
        assert!(spec_command(&spec).is_none());
    }

    #[test]
    fn asset_name_matches_current_platform() {
        let name = github_asset_name("codelldb").unwrap();
        let expected = match (std::env::consts::OS, std::env::consts::ARCH) {
            ("windows", "x86_64") => "codelldb-win32-x64.vsix",
            ("linux", "x86_64") => "codelldb-linux-x64.vsix",
            ("linux", "aarch64") => "codelldb-linux-arm64.vsix",
            ("macos", "x86_64") => "codelldb-darwin-x64.vsix",
            ("macos", "aarch64") => "codelldb-darwin-arm64.vsix",
            _ => panic!("unsupported test platform"),
        };
        assert_eq!(name, expected);
    }

    #[test]
    fn download_url_uses_pinned_tag() {
        let url = github_download_url("vadimcn/codelldb", "v1.11.5", "codelldb-win32-x64.vsix");
        assert_eq!(
            url,
            "https://github.com/vadimcn/codelldb/releases/download/v1.11.5/codelldb-win32-x64.vsix"
        );
    }

    #[test]
    fn codelldb_binary_path_is_inside_extension_dir() {
        let path = codelldb_binary_relative();
        assert!(path.starts_with("extension/adapter"));
        #[cfg(target_os = "windows")]
        assert!(path.ends_with("codelldb.exe"));
        #[cfg(not(target_os = "windows"))]
        assert!(path.ends_with("codelldb"));
    }
}
