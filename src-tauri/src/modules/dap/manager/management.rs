use crate::modules::dap::install::{self, InstallSpec, InstallStage};
use crate::modules::dap::types::{DapAdapterInfo, DapEnsureResult, DapInstallResult};
use crate::platform::resolve_program;
use std::time::Duration;
use tauri::AppHandle;

use super::adapters::{
    adapter_for_language, adapters_dir, check_adapter_available, stderr_tail, AdapterEntry,
    ADAPTERS,
};
use super::go::managed_go_bin_dir;
use super::java::{java_adapter_dir, jdtls_available};
use super::python::python_with_module;
use super::DapManager;

const INSTALL_TIMEOUT: Duration = Duration::from_secs(180);

/// Reports the outcome of a download-style install through progress events.
fn finish_install(
    app: &AppHandle,
    entry: &AdapterEntry,
    result: Result<String, String>,
) -> DapInstallResult {
    match result {
        Ok(stdout) => {
            install::emit_progress(app, entry.id, InstallStage::Done, None, "Installed");
            DapInstallResult {
                stdout,
                stderr: String::new(),
                exit_code: 0,
            }
        }
        Err(e) => {
            install::emit_progress(app, entry.id, InstallStage::Error, None, &e);
            DapInstallResult {
                stdout: String::new(),
                stderr: e,
                exit_code: -1,
            }
        }
    }
}

impl DapManager {
    pub async fn list_adapters(app: &AppHandle) -> Vec<DapAdapterInfo> {
        let dir = adapters_dir(app).ok();
        let mut infos = Vec::with_capacity(ADAPTERS.len());
        for entry in ADAPTERS {
            infos.push(DapAdapterInfo {
                id: entry.id.to_string(),
                label: entry.label.to_string(),
                available: check_adapter_available(entry.id, dir.as_deref()).await,
                install_hint: entry.install_hint.map(|h| h.to_string()),
            });
        }
        infos
    }

    /// Run the adapter's install spec, emitting `dap_install_progress` events.
    /// Returns the captured stdout/stderr/exit code for command-based specs.
    pub async fn install_adapter(
        app: &AppHandle,
        adapter_id: &str,
    ) -> std::result::Result<DapInstallResult, String> {
        let entry = ADAPTERS
            .iter()
            .find(|a| a.id == adapter_id)
            .ok_or_else(|| format!("No debug adapter registered for '{adapter_id}'"))?;
        let spec = entry
            .install
            .ok_or_else(|| format!("No install command for adapter '{adapter_id}'"))?;

        match spec {
            InstallSpec::GitHubRelease {
                repo,
                tag,
                asset_prefix,
            } => {
                let dir = adapters_dir(app)?;
                let result = install::install_from_github(
                    app,
                    entry.id,
                    repo,
                    tag,
                    asset_prefix,
                    &dir,
                    &install::codelldb_binary_relative(),
                )
                .await;
                match result {
                    Ok(()) => {
                        install::emit_progress(
                            app,
                            entry.id,
                            InstallStage::Done,
                            None,
                            "Installed",
                        );
                        Ok(DapInstallResult {
                            stdout: format!("Installed '{}' to {}", entry.label, dir.display()),
                            stderr: String::new(),
                            exit_code: 0,
                        })
                    }
                    Err(e) => {
                        install::emit_progress(app, entry.id, InstallStage::Error, None, &e);
                        Ok(DapInstallResult {
                            stdout: String::new(),
                            stderr: e,
                            exit_code: -1,
                        })
                    }
                }
            }
            InstallSpec::MavenJar {
                group_path,
                artifact,
                version,
                sha256,
            } => {
                // The plugin only runs inside jdtls, so a missing jdtls fails before the download.
                if !jdtls_available() {
                    let hint = entry.install_hint.unwrap_or_default();
                    return Ok(finish_install(
                        app,
                        entry,
                        Err(format!("Cannot find 'jdtls' in PATH. {hint}")),
                    ));
                }
                let dir = java_adapter_dir(&adapters_dir(app)?);
                let result = install::install_maven_jar(
                    app, entry.id, group_path, artifact, version, sha256, &dir,
                )
                .await
                .map(|path| format!("Installed '{}' to {}", entry.label, path.display()));
                Ok(finish_install(app, entry, result))
            }
            InstallSpec::GoInstall { package, version } => {
                let go = resolve_program("go")
                    .map_err(|e| format!("Cannot install '{}': {e}", entry.label))?;
                let bin_dir = managed_go_bin_dir(&adapters_dir(app)?);
                let args = install::go_install_args(package, version);
                install::emit_progress(
                    app,
                    entry.id,
                    InstallStage::Installing,
                    None,
                    format!("Running go {}", args.join(" ")),
                );
                let output = tokio::time::timeout(
                    INSTALL_TIMEOUT,
                    crate::platform::new_tokio_command(&go)
                        .args(&args)
                        .env("GOBIN", &bin_dir)
                        .output(),
                )
                .await
                .map_err(|_| {
                    format!(
                        "Install of '{}' timed out after {}s",
                        entry.label,
                        INSTALL_TIMEOUT.as_secs()
                    )
                })?
                .map_err(|e| format!("Failed to run 'go': {e}"))?;
                let result = if output.status.success() {
                    Ok(format!(
                        "Installed '{}' to {}",
                        entry.label,
                        bin_dir.display()
                    ))
                } else {
                    Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
                };
                let mut reported = finish_install(app, entry, result);
                reported.exit_code = output.status.code().unwrap_or(-1);
                Ok(reported)
            }
            spec => {
                let (program, args) = install::spec_command(&spec)
                    .ok_or_else(|| format!("No install command for adapter '{adapter_id}'"))?;

                install::emit_progress(
                    app,
                    entry.id,
                    InstallStage::Installing,
                    None,
                    format!("Running {} {}", program, args.join(" ")),
                );
                let program_path = if matches!(spec, InstallSpec::Pip { .. }) {
                    python_with_module("pip").await.unwrap_or(program.into())
                } else {
                    resolve_program(program)
                        .map_err(|e| format!("Cannot install '{}': {e}", entry.label))?
                };
                let output = tokio::time::timeout(
                    INSTALL_TIMEOUT,
                    crate::platform::new_tokio_command(&program_path)
                        .args(&args)
                        .output(),
                )
                .await
                .map_err(|_| {
                    format!(
                        "Install of '{}' timed out after {}s",
                        entry.label,
                        INSTALL_TIMEOUT.as_secs()
                    )
                })?
                .map_err(|e| format!("Failed to run '{program}': {e}"))?;

                let result = DapInstallResult {
                    stdout: String::from_utf8_lossy(&output.stdout).to_string(),
                    stderr: String::from_utf8_lossy(&output.stderr).to_string(),
                    exit_code: output.status.code().unwrap_or(-1),
                };
                let stage = if result.exit_code == 0 {
                    InstallStage::Done
                } else {
                    InstallStage::Error
                };
                install::emit_progress(
                    app,
                    entry.id,
                    stage,
                    None,
                    if result.exit_code == 0 {
                        "Installed".to_string()
                    } else {
                        stderr_tail(&result.stderr)
                    },
                );
                Ok(result)
            }
        }
    }

    /// Resolve the adapter for a language, install it when missing, and report
    /// whether it is usable afterwards.
    pub async fn ensure_adapter(
        app: &AppHandle,
        language: &str,
    ) -> std::result::Result<DapEnsureResult, String> {
        let entry = adapter_for_language(language)
            .ok_or_else(|| format!("No debug adapter for language '{language}'"))?;
        let dir = adapters_dir(app).ok();

        if check_adapter_available(entry.id, dir.as_deref()).await {
            return Ok(DapEnsureResult {
                adapter_id: entry.id.to_string(),
                installed: false,
                available: true,
            });
        }

        Self::install_adapter(app, entry.id).await?;
        let available = check_adapter_available(entry.id, dir.as_deref()).await;
        Ok(DapEnsureResult {
            adapter_id: entry.id.to_string(),
            installed: true,
            available,
        })
    }
}
