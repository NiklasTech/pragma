//! Local dictation with NVIDIA Parakeet TDT 0.6B v3 through a dynamically
//! loaded ONNX Runtime, managed under `<app_data>/stt/parakeet`.

mod install;
mod model;

pub(crate) use install::download_verified;

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
/// Files of the single-model layout used before models got their own folders.
const LEGACY_FILES: [&str; 4] = [
    "nemo128.onnx",
    "vocab.txt",
    "encoder-model.int8.onnx",
    "decoder_joint-model.int8.onnx",
];

struct ActiveDownload {
    model: &'static str,
    cancel: CancellationToken,
}

struct LoadedModel {
    id: &'static str,
    model: ParakeetModel,
}

#[derive(Default)]
pub struct ParakeetState {
    download: Mutex<Option<ActiveDownload>>,
    model: Arc<Mutex<Option<LoadedModel>>>,
    uses: Arc<AtomicU64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParakeetStatus {
    pub supported: bool,
    pub installed: bool,
    pub downloading: bool,
    /// Bytes still to download for this model, including the runtime when it is missing.
    pub download_bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DownloadProgress {
    received: u64,
    total: u64,
}

fn parakeet_dir(root: &Path) -> PathBuf {
    root.join("parakeet")
}

fn runtime_dir(root: &Path) -> PathBuf {
    parakeet_dir(root).join("runtime")
}

fn model_dir(root: &Path, spec: &install::ModelSpec) -> PathBuf {
    parakeet_dir(root).join("models").join(spec.id)
}

fn partial(dir: &Path) -> PathBuf {
    dir.with_extension("partial")
}

fn runtime_installed(root: &Path, runtime: &install::Runtime) -> bool {
    runtime_dir(root).join(runtime.file_name).is_file()
}

/// Checks pinned sizes too, so files of a previously pinned build count as missing.
fn model_installed(dir: &Path, spec: &install::ModelSpec) -> bool {
    spec.files.iter().all(|file| {
        std::fs::metadata(dir.join(file.name))
            .is_ok_and(|meta| meta.is_file() && meta.len() == file.size)
    })
}

fn downloading_model(state: &ParakeetState) -> Option<&'static str> {
    state
        .download
        .lock()
        .ok()
        .and_then(|download| download.as_ref().map(|active| active.model))
}

fn current_status(
    app: &tauri::AppHandle,
    state: &ParakeetState,
    spec: &install::ModelSpec,
) -> ParakeetStatus {
    let downloading = downloading_model(state) == Some(spec.id);
    let (Some(runtime), Ok(root)) = (install::runtime(), stt_root(app)) else {
        return ParakeetStatus {
            supported: install::runtime().is_some(),
            installed: false,
            downloading,
            download_bytes: 0,
        };
    };
    let has_runtime = runtime_installed(&root, &runtime);
    let has_model = model_installed(&model_dir(&root, spec), spec);
    let mut download_bytes = 0;
    if !has_runtime {
        download_bytes += runtime.size;
    }
    if !has_model {
        download_bytes += install::model_bytes(spec);
    }
    ParakeetStatus {
        supported: true,
        installed: has_runtime && has_model,
        downloading,
        download_bytes,
    }
}

#[tauri::command]
pub async fn parakeet_status(
    app: tauri::AppHandle,
    state: tauri::State<'_, ParakeetState>,
    model: String,
) -> Result<ParakeetStatus, String> {
    let spec = install::model(&model)?;
    Ok(current_status(&app, &state, spec))
}

#[tauri::command]
pub async fn parakeet_download(
    app: tauri::AppHandle,
    state: tauri::State<'_, ParakeetState>,
    model: String,
) -> Result<ParakeetStatus, String> {
    let spec = install::model(&model)?;
    let runtime = install::runtime()
        .ok_or_else(|| "Parakeet is not available on this platform".to_string())?;
    let cancel = {
        let mut download = state
            .download
            .lock()
            .map_err(|_| "Parakeet download state is unavailable".to_string())?;
        if download.is_some() {
            return Err("Another Parakeet download is running".to_string());
        }
        let token = CancellationToken::new();
        *download = Some(ActiveDownload {
            model: spec.id,
            cancel: token.clone(),
        });
        token
    };

    let result = install_into_place(&app, &runtime, spec, &cancel).await;
    if let Ok(mut download) = state.download.lock() {
        *download = None;
    }
    result?;
    Ok(current_status(&app, &state, spec))
}

async fn install_into_place(
    app: &tauri::AppHandle,
    runtime: &install::Runtime,
    spec: &install::ModelSpec,
    cancel: &CancellationToken,
) -> Result<(), String> {
    let root = stt_root(app)?;
    let need_runtime = !runtime_installed(&root, runtime);
    let model_target = model_dir(&root, spec);
    let need_model = !model_installed(&model_target, spec);
    let runtime_bytes = if need_runtime { runtime.size } else { 0 };
    let total = runtime_bytes
        + if need_model {
            install::model_bytes(spec)
        } else {
            0
        };
    let emit = |received: u64| {
        let _ = app.emit(PROGRESS_EVENT, DownloadProgress { received, total });
    };

    if need_runtime {
        let target = runtime_dir(&root);
        let staging = partial(&target);
        remove_dir_if_exists(&staging).await?;
        let downloaded =
            install::download_runtime(runtime, &staging, cancel, &mut |received| emit(received))
                .await;
        move_into_place(downloaded, &staging, &target).await?;
    }
    if need_model {
        let staging = partial(&model_target);
        remove_dir_if_exists(&staging).await?;
        let downloaded = install::download_model(spec, &staging, cancel, &mut |received| {
            emit(runtime_bytes + received)
        })
        .await;
        move_into_place(downloaded, &staging, &model_target).await?;
    }
    remove_legacy_files(&root, runtime).await;
    Ok(())
}

async fn remove_dir_if_exists(dir: &Path) -> Result<(), String> {
    if dir.exists() {
        tokio::fs::remove_dir_all(dir)
            .await
            .map_err(|e| format!("Cannot clean {}: {e}", dir.display()))?;
    }
    Ok(())
}

async fn move_into_place(
    downloaded: Result<(), String>,
    staging: &Path,
    target: &Path,
) -> Result<(), String> {
    if let Err(error) = downloaded {
        let _ = tokio::fs::remove_dir_all(staging).await;
        return Err(error);
    }
    remove_dir_if_exists(target).await?;
    if let Err(error) = tokio::fs::rename(staging, target).await {
        let _ = tokio::fs::remove_dir_all(staging).await;
        return Err(format!("Cannot finalize download: {error}"));
    }
    Ok(())
}

async fn remove_legacy_files(root: &Path, runtime: &install::Runtime) {
    let dir = parakeet_dir(root);
    for name in LEGACY_FILES.iter().chain([&runtime.file_name]) {
        let _ = tokio::fs::remove_file(dir.join(name)).await;
    }
}

#[tauri::command]
pub async fn parakeet_cancel_download(
    state: tauri::State<'_, ParakeetState>,
) -> Result<(), String> {
    if let Ok(download) = state.download.lock() {
        if let Some(active) = download.as_ref() {
            active.cancel.cancel();
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn parakeet_remove(
    app: tauri::AppHandle,
    state: tauri::State<'_, ParakeetState>,
    model: String,
) -> Result<ParakeetStatus, String> {
    let spec = install::model(&model)?;
    if downloading_model(&state) == Some(spec.id) {
        return Err("Cancel the download before removing the model".to_string());
    }
    let loaded = state.model.clone();
    tokio::task::spawn_blocking(move || {
        if let Ok(mut slot) = loaded.lock() {
            if slot.as_ref().is_some_and(|current| current.id == spec.id) {
                *slot = None;
            }
        }
    })
    .await
    .map_err(|e| format!("Cannot unload the model: {e}"))?;
    remove_dir_if_exists(&model_dir(&stt_root(&app)?, spec)).await?;
    Ok(current_status(&app, &state, spec))
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
    model: String,
) -> Result<String, String> {
    let spec = install::model(&model)?;
    let Some(runtime) = install::runtime() else {
        return Err("Parakeet is not available on this platform".to_string());
    };
    let root = stt_root(&app)?;
    let dir = model_dir(&root, spec);
    if !runtime_installed(&root, &runtime) || !model_installed(&dir, spec) {
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
    let loaded = state.model.clone();
    let library = runtime_dir(&root).join(runtime.file_name);
    let result = tokio::task::spawn_blocking(move || {
        let mut slot = loaded
            .lock()
            .map_err(|_| "Parakeet model state is unavailable".to_string())?;
        if !matches!(slot.as_ref(), Some(current) if current.id == spec.id) {
            *slot = None;
            ort::init_from(&library)
                .map_err(|e| format!("Cannot load ONNX Runtime: {e}"))?
                .with_name("pragma-parakeet")
                .commit();
            *slot = Some(LoadedModel {
                id: spec.id,
                model: ParakeetModel::load(&dir)?,
            });
        }
        match slot.as_mut() {
            Some(current) => current.model.transcribe(samples),
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

    fn write_sized(path: &Path, size: u64) {
        std::fs::File::create(path).unwrap().set_len(size).unwrap();
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
    fn model_needs_every_file_at_its_pinned_size() {
        let spec = &install::MODELS[0];
        let dir = tempfile::tempdir().unwrap();
        assert!(!model_installed(dir.path(), spec));
        for file in &spec.files {
            write_sized(&dir.path().join(file.name), file.size + 1);
        }
        assert!(!model_installed(dir.path(), spec));
        for file in &spec.files {
            write_sized(&dir.path().join(file.name), file.size);
        }
        assert!(model_installed(dir.path(), spec));
    }

    #[test]
    fn models_live_in_separate_folders_beside_the_runtime() {
        let root = Path::new("/stt");
        let [first, second] = &install::MODELS;
        assert_ne!(model_dir(root, first), model_dir(root, second));
        assert!(model_dir(root, first).starts_with(parakeet_dir(root)));
        assert!(!model_dir(root, first).starts_with(runtime_dir(root)));
        assert_eq!(
            partial(&model_dir(root, first)),
            parakeet_dir(root)
                .join("models")
                .join("parakeet-v3.partial")
        );
    }
}
