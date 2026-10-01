//! Local dictation with NVIDIA Parakeet TDT 0.6B v3 through a dynamically
//! loaded ONNX Runtime, managed under `<app_data>/stt/parakeet`.

mod install;
mod model;

use base64::Engine;
use model::ParakeetModel;
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::Emitter;
use tokio_util::sync::CancellationToken;

use crate::modules::stt::{parse_wav, stt_root};

const IDLE_UNLOAD: Duration = Duration::from_secs(5 * 60);
const SAMPLE_RATE: u32 = 16_000;
const MIN_SAMPLES: usize = (SAMPLE_RATE / 10) as usize;
const PROGRESS_EVENT: &str = "parakeet-download-progress";

#[derive(Default)]
pub struct ParakeetState {
    download: Mutex<Option<CancellationToken>>,
    model: Arc<Mutex<Option<ParakeetModel>>>,
    uses: Arc<AtomicU64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParakeetStatus {
    pub supported: bool,
    pub installed: bool,
    pub downloading: bool,
    pub download_bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DownloadProgress {
    received: u64,
    total: u64,
}

fn install_dir(root: &Path) -> PathBuf {
    root.join("parakeet")
}

fn staging_dir(root: &Path) -> PathBuf {
    root.join("parakeet.partial")
}

/// Checks pinned sizes too, so an install of a previously pinned model counts as missing.
fn is_installed(dir: &Path, runtime: &install::Runtime) -> bool {
    dir.join(runtime.file_name).is_file()
        && install::MODEL_FILES.iter().all(|file| {
            std::fs::metadata(dir.join(file.name))
                .is_ok_and(|meta| meta.is_file() && meta.len() == file.size)
        })
}

fn current_status(app: &tauri::AppHandle, state: &ParakeetState) -> ParakeetStatus {
    let downloading = state
        .download
        .lock()
        .map(|download| download.is_some())
        .unwrap_or(false);
    let Some(runtime) = install::runtime() else {
        return ParakeetStatus {
            supported: false,
            installed: false,
            downloading,
            download_bytes: 0,
        };
    };
    let installed = stt_root(app)
        .map(|root| is_installed(&install_dir(&root), &runtime))
        .unwrap_or(false);
    ParakeetStatus {
        supported: true,
        installed,
        downloading,
        download_bytes: install::total_download_bytes(&runtime),
    }
}

#[tauri::command]
pub async fn parakeet_status(
    app: tauri::AppHandle,
    state: tauri::State<'_, ParakeetState>,
) -> Result<ParakeetStatus, String> {
    Ok(current_status(&app, &state))
}

#[tauri::command]
pub async fn parakeet_download(
    app: tauri::AppHandle,
    state: tauri::State<'_, ParakeetState>,
) -> Result<ParakeetStatus, String> {
    let runtime = install::runtime()
        .ok_or_else(|| "Parakeet is not available on this platform".to_string())?;
    let cancel = {
        let mut download = state
            .download
            .lock()
            .map_err(|_| "Parakeet download state is unavailable".to_string())?;
        if download.is_some() {
            return Err("Parakeet is already downloading".to_string());
        }
        let token = CancellationToken::new();
        *download = Some(token.clone());
        token
    };

    let result = install_into_place(&app, &runtime, &cancel).await;
    if let Ok(mut download) = state.download.lock() {
        *download = None;
    }
    result?;
    Ok(current_status(&app, &state))
}

async fn install_into_place(
    app: &tauri::AppHandle,
    runtime: &install::Runtime,
    cancel: &CancellationToken,
) -> Result<(), String> {
    let root = stt_root(app)?;
    let staging = staging_dir(&root);
    if staging.exists() {
        tokio::fs::remove_dir_all(&staging)
            .await
            .map_err(|e| format!("Cannot clean {}: {e}", staging.display()))?;
    }

    let total = install::total_download_bytes(runtime);
    let mut on_progress = |received: u64| {
        let _ = app.emit(PROGRESS_EVENT, DownloadProgress { received, total });
    };
    let downloaded = install::download_all(runtime, &staging, cancel, &mut on_progress).await;
    if let Err(error) = downloaded {
        let _ = tokio::fs::remove_dir_all(&staging).await;
        return Err(error);
    }

    let dir = install_dir(&root);
    if dir.exists() {
        tokio::fs::remove_dir_all(&dir)
            .await
            .map_err(|e| format!("Cannot clean {}: {e}", dir.display()))?;
    }
    if let Err(error) = tokio::fs::rename(&staging, &dir).await {
        let _ = tokio::fs::remove_dir_all(&staging).await;
        return Err(format!("Cannot finalize download: {error}"));
    }
    Ok(())
}

#[tauri::command]
pub async fn parakeet_cancel_download(
    state: tauri::State<'_, ParakeetState>,
) -> Result<(), String> {
    if let Ok(download) = state.download.lock() {
        if let Some(token) = download.as_ref() {
            token.cancel();
        }
    }
    Ok(())
}

fn wav_samples(wav: &[u8]) -> Result<Vec<f32>, String> {
    let info = parse_wav(wav)?;
    if info.sample_rate != SAMPLE_RATE {
        return Err("Parakeet expects 16 kHz audio".to_string());
    }
    let end = info.data_offset + info.data_len as usize;
    let data = wav
        .get(info.data_offset..end)
        .ok_or_else(|| "Invalid WAV payload: truncated data".to_string())?;
    Ok(data
        .chunks_exact(2)
        .map(|pair| f32::from(i16::from_le_bytes([pair[0], pair[1]])) / 32768.0)
        .collect())
}

#[tauri::command]
pub async fn parakeet_transcribe(
    app: tauri::AppHandle,
    state: tauri::State<'_, ParakeetState>,
    wav_base64: String,
) -> Result<String, String> {
    let Some(runtime) = install::runtime() else {
        return Err("Parakeet is not available on this platform".to_string());
    };
    let dir = install_dir(&stt_root(&app)?);
    if !is_installed(&dir, &runtime) {
        return Err("Download Parakeet in Settings".to_string());
    }

    let wav = base64::engine::general_purpose::STANDARD
        .decode(wav_base64.as_bytes())
        .map_err(|e| format!("Invalid audio payload: {e}"))?;
    let samples = wav_samples(&wav)?;
    if samples.len() < MIN_SAMPLES {
        return Ok(String::new());
    }

    let generation = state.uses.fetch_add(1, Ordering::SeqCst) + 1;
    let model = state.model.clone();
    let library = dir.join(runtime.file_name);
    let result = tokio::task::spawn_blocking(move || {
        let mut slot = model
            .lock()
            .map_err(|_| "Parakeet model state is unavailable".to_string())?;
        if slot.is_none() {
            ort::init_from(&library)
                .map_err(|e| format!("Cannot load ONNX Runtime: {e}"))?
                .with_name("pragma-parakeet")
                .commit();
            *slot = Some(ParakeetModel::load(&dir)?);
        }
        match slot.as_mut() {
            Some(loaded) => loaded.transcribe(samples),
            None => Err("Parakeet model is not loaded".to_string()),
        }
    })
    .await
    .map_err(|e| format!("Transcription failed: {e}"))?;

    schedule_unload(&state, generation);
    result
}

fn schedule_unload(state: &ParakeetState, generation: u64) {
    let model = state.model.clone();
    let uses = state.uses.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(IDLE_UNLOAD).await;
        if uses.load(Ordering::SeqCst) != generation {
            return;
        }
        if let Ok(mut slot) = model.lock() {
            *slot = None;
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    fn wav(sample_rate: u32, samples: &[i16]) -> Vec<u8> {
        let data_len = (samples.len() * 2) as u32;
        let mut wav = Vec::new();
        wav.extend_from_slice(b"RIFF");
        wav.extend_from_slice(&(36 + data_len).to_le_bytes());
        wav.extend_from_slice(b"WAVE");
        wav.extend_from_slice(b"fmt ");
        wav.extend_from_slice(&16u32.to_le_bytes());
        wav.extend_from_slice(&1u16.to_le_bytes());
        wav.extend_from_slice(&1u16.to_le_bytes());
        wav.extend_from_slice(&sample_rate.to_le_bytes());
        wav.extend_from_slice(&(sample_rate * 2).to_le_bytes());
        wav.extend_from_slice(&2u16.to_le_bytes());
        wav.extend_from_slice(&16u16.to_le_bytes());
        wav.extend_from_slice(b"data");
        wav.extend_from_slice(&data_len.to_le_bytes());
        for sample in samples {
            wav.extend_from_slice(&sample.to_le_bytes());
        }
        wav
    }

    #[test]
    fn converts_pcm16_to_normalized_samples() {
        let samples = wav_samples(&wav(16_000, &[0, 16384, -32768])).unwrap();
        assert_eq!(samples, vec![0.0, 0.5, -1.0]);
    }

    #[test]
    fn rejects_other_sample_rates() {
        assert!(wav_samples(&wav(44_100, &[0, 1, 2])).is_err());
    }

    #[test]
    fn installed_needs_runtime_and_every_model_file() {
        let Some(runtime) = install::runtime() else {
            return;
        };
        let dir = tempfile::tempdir().unwrap();
        assert!(!is_installed(dir.path(), &runtime));
        for file in &install::MODEL_FILES {
            std::fs::File::create(dir.path().join(file.name))
                .unwrap()
                .set_len(file.size)
                .unwrap();
        }
        assert!(!is_installed(dir.path(), &runtime));
        std::fs::write(dir.path().join(runtime.file_name), b"x").unwrap();
        assert!(is_installed(dir.path(), &runtime));
    }

    #[test]
    fn outdated_model_files_are_not_installed() {
        let Some(runtime) = install::runtime() else {
            return;
        };
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join(runtime.file_name), b"x").unwrap();
        for file in &install::MODEL_FILES {
            std::fs::File::create(dir.path().join(file.name))
                .unwrap()
                .set_len(file.size + 1)
                .unwrap();
        }
        assert!(!is_installed(dir.path(), &runtime));
    }
}
