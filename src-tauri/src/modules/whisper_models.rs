//! Pinned whisper.cpp ggml models for local dictation, downloaded with progress
//! and verified by SHA-256 before they are moved into `<app_data>/stt/models`.

use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tokio_util::sync::CancellationToken;

use crate::modules::parakeet::download_verified;

const MODEL_BASE_URL: &str =
    "https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1";
/// Model of the single-model setup before the catalog, removed after a new install.
const LEGACY_MODEL_FILE: &str = "ggml-tiny.bin";

pub struct WhisperModelSpec {
    pub id: &'static str,
    pub file_name: &'static str,
    pub size: u64,
    pub sha256: &'static str,
}

pub const MODELS: [WhisperModelSpec; 1] = [WhisperModelSpec {
    id: "large-v3-turbo-q5_0",
    file_name: "ggml-large-v3-turbo-q5_0.bin",
    size: 574_041_195,
    sha256: "394221709cd5ad1f40c46e6031ca61bce88931e6e088c188294c6d5a55ffa7e2",
}];

/// Looks up a catalog model; ids come from the frontend, so unknown ones are rejected.
pub fn model(id: &str) -> Result<&'static WhisperModelSpec, String> {
    MODELS
        .iter()
        .find(|spec| spec.id == id)
        .ok_or_else(|| format!("Unknown Whisper model: {id}"))
}

pub fn models_dir(root: &Path) -> PathBuf {
    root.join("models")
}

pub fn model_path(root: &Path, spec: &WhisperModelSpec) -> PathBuf {
    models_dir(root).join(spec.file_name)
}

/// Checks the pinned size too, so a truncated file counts as missing.
pub fn model_installed(root: &Path, spec: &WhisperModelSpec) -> bool {
    std::fs::metadata(model_path(root, spec))
        .is_ok_and(|meta| meta.is_file() && meta.len() == spec.size)
}

pub struct ActiveDownload {
    pub model: &'static str,
    pub cancel: CancellationToken,
}

#[derive(Default)]
pub struct WhisperState {
    pub download: Mutex<Option<ActiveDownload>>,
}

impl WhisperState {
    pub fn downloading_model(&self) -> Option<&'static str> {
        self.download
            .lock()
            .ok()
            .and_then(|download| download.as_ref().map(|active| active.model))
    }
}

/// Downloads the model next to its final path and only renames it once the checksum matches.
pub async fn download_model(
    root: &Path,
    spec: &WhisperModelSpec,
    cancel: &CancellationToken,
    on_progress: &mut impl FnMut(u64),
) -> Result<(), String> {
    let dir = models_dir(root);
    tokio::fs::create_dir_all(&dir)
        .await
        .map_err(|e| format!("Cannot create {}: {e}", dir.display()))?;
    let dest = model_path(root, spec);
    let part = dest.with_extension("part");
    let url = format!("{MODEL_BASE_URL}/{}", spec.file_name);
    let downloaded = download_verified(
        &reqwest::Client::new(),
        &url,
        &part,
        spec.size,
        spec.sha256,
        cancel,
        on_progress,
    )
    .await;
    if let Err(error) = downloaded {
        let _ = tokio::fs::remove_file(&part).await;
        return Err(error);
    }
    tokio::fs::rename(&part, &dest)
        .await
        .map_err(|e| format!("Cannot finalize download: {e}"))?;
    let _ = tokio::fs::remove_file(dir.join(LEGACY_MODEL_FILE)).await;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn catalog_is_pinned_and_unique() {
        assert!(MODEL_BASE_URL.contains("/resolve/5359861c739e955e79d9a303bcbc70fb988958b1"));
        for (index, spec) in MODELS.iter().enumerate() {
            assert_eq!(spec.sha256.len(), 64);
            assert!(spec.file_name.starts_with("ggml-") && spec.file_name.ends_with(".bin"));
            assert!(MODELS[..index].iter().all(|other| other.id != spec.id));
        }
        assert!(model("large-v3-turbo-q5_0").is_ok());
        assert!(model("../tiny").is_err());
    }

    #[test]
    fn installed_needs_the_pinned_size() {
        let root = tempfile::tempdir().unwrap();
        let spec = &MODELS[0];
        assert!(!model_installed(root.path(), spec));
        std::fs::create_dir_all(models_dir(root.path())).unwrap();
        let file = std::fs::File::create(model_path(root.path(), spec)).unwrap();
        file.set_len(spec.size - 1).unwrap();
        assert!(!model_installed(root.path(), spec));
        file.set_len(spec.size).unwrap();
        assert!(model_installed(root.path(), spec));
    }
}
