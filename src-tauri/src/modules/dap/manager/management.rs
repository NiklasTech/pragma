use crate::modules::dap::install::{self, InstallSpec, InstallStage};
use crate::modules::dap::types::{DapAdapterInfo, DapEnsureResult, DapInstallResult};
use crate::platform::resolve_program;
use std::time::Duration;
use tauri::AppHandle;

use super::adapters::{
    adapter_for_language, adapters_dir, check_adapter_available, stderr_tail, ADAPTERS,
};
use super::python::python_with_module;
use super::DapManager;

const INSTALL_TIMEOUT: Duration = Duration::from_secs(180);

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
