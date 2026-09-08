//! Local speech-to-text for composer dictation: a pinned whisper.cpp sidecar
//! plus the ggml-tiny model, managed under `<app_data>/stt`.

use base64::Engine;
use serde::Serialize;
use std::io;
use std::path::{Path, PathBuf};
use tauri::Manager;

const MODEL_URL: &str = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin";
const MAX_ARCHIVE_BYTES: u64 = 60 * 1024 * 1024;
const MAX_MODEL_BYTES: u64 = 100 * 1024 * 1024;
const MAX_WAV_DATA_BYTES: u64 = 8 * 1024 * 1024;
const TRANSCRIBE_TIMEOUT_SECS: u64 = 300;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SttStatus {
    pub supported: bool,
    pub installed: bool,
}

fn binary_name() -> &'static str {
    if cfg!(target_os = "windows") {
        "whisper-cli.exe"
    } else {
        "whisper-cli"
    }
}

fn platform_supported() -> bool {
    cfg!(all(target_os = "windows", target_arch = "x86_64"))
        || cfg!(all(target_os = "linux", target_arch = "x86_64"))
}

fn whisper_archive_url() -> Option<&'static str> {
    if cfg!(all(target_os = "windows", target_arch = "x86_64")) {
        Some("https://github.com/ggml-org/whisper.cpp/releases/download/v1.8.7/whisper-bin-x64.zip")
    } else if cfg!(all(target_os = "linux", target_arch = "x86_64")) {
        Some(
            "https://github.com/ggml-org/whisper.cpp/releases/download/v1.8.7/whisper-bin-ubuntu-x64.tar.gz",
        )
    } else {
        None
    }
}

fn stt_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Cannot resolve app data dir: {e}"))?
        .join("stt"))
}

fn whisper_dir(root: &Path) -> PathBuf {
    root.join("whisper")
}

fn model_path(root: &Path) -> PathBuf {
    root.join("models").join("ggml-tiny.bin")
}

fn find_binary(dir: &Path) -> Option<PathBuf> {
    let mut found = None;
    let mut stack = vec![dir.to_path_buf()];
    while let Some(current) = stack.pop() {
        let Ok(entries) = std::fs::read_dir(&current) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                stack.push(path);
            } else if path.file_name().and_then(|n| n.to_str()) == Some(binary_name()) {
                found = Some(path);
            }
        }
    }
    found
}

fn current_status(app: &tauri::AppHandle) -> SttStatus {
    if !platform_supported() {
        return SttStatus {
            supported: false,
            installed: false,
        };
    }
    let installed = stt_root(app)
        .map(|root| find_binary(&whisper_dir(&root)).is_some() && model_path(&root).is_file())
        .unwrap_or(false);
    SttStatus {
        supported: true,
        installed,
    }
}

#[tauri::command]
pub async fn stt_status(app: tauri::AppHandle) -> Result<SttStatus, String> {
    Ok(current_status(&app))
}

async fn download_to_file(url: &str, dest: &Path, cap: u64) -> Result<(), String> {
    let response = reqwest::Client::new()
        .get(url)
        .header(reqwest::header::USER_AGENT, "pragma")
        .send()
        .await
        .map_err(|e| format!("Download failed: {e}"))?;
    if !response.status().is_success() {
        return Err(format!("Download failed: HTTP {}", response.status()));
    }
    if response.content_length().is_some_and(|total| total > cap) {
        return Err("Download is too large".to_string());
    }

    let tmp = dest.with_extension("part");
    if let Some(parent) = tmp.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Cannot create {}: {e}", parent.display()))?;
    }
    let mut file = tokio::fs::File::create(&tmp)
        .await
        .map_err(|e| format!("Cannot write {}: {e}", tmp.display()))?;

    use futures_util::StreamExt;
    use tokio::io::AsyncWriteExt;
    let mut stream = response.bytes_stream();
    let mut downloaded: u64 = 0;
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Download failed: {e}"))?;
        downloaded += chunk.len() as u64;
        if downloaded > cap {
            let _ = tokio::fs::remove_file(&tmp).await;
            return Err("Download is too large".to_string());
        }
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("Cannot write {}: {e}", tmp.display()))?;
    }
    file.flush()
        .await
        .map_err(|e| format!("Cannot write {}: {e}", tmp.display()))?;
    drop(file);
    tokio::fs::rename(&tmp, dest)
        .await
        .map_err(|e| format!("Cannot finalize download: {e}"))?;
    Ok(())
}

#[cfg(target_os = "windows")]
fn extract_archive(archive: &Path, dest_dir: &Path) -> Result<(), String> {
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
        let target = dest_dir.join(name);
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
        io::copy(&mut entry, &mut out)
            .map_err(|e| format!("Cannot write {}: {e}", target.display()))?;
    }
    Ok(())
}

#[cfg(target_os = "linux")]
fn safe_tar_path(path: &Path) -> Option<&Path> {
    use std::path::Component;

    if path.as_os_str().is_empty() {
        return None;
    }
    if path.components().any(|c| {
        matches!(
            c,
            Component::Prefix(_) | Component::RootDir | Component::ParentDir
        )
    }) {
        return None;
    }
    Some(path)
}

#[cfg(not(any(target_os = "windows", target_os = "linux")))]
fn extract_archive(_archive: &Path, _dest_dir: &Path) -> Result<(), String> {
    Err("Whisper is not available on this platform".to_string())
}

#[cfg(target_os = "linux")]
fn extract_archive(archive: &Path, dest_dir: &Path) -> Result<(), String> {
    use flate2::read::GzDecoder;
    use tar::Archive as TarArchive;

    let file = std::fs::File::open(archive)
        .map_err(|e| format!("Cannot open {}: {e}", archive.display()))?;
    let mut tar = TarArchive::new(GzDecoder::new(file));
    for entry in tar
        .entries()
        .map_err(|e| format!("Invalid archive {}: {e}", archive.display()))?
    {
        let mut entry = entry.map_err(|e| format!("Cannot read archive entry: {e}"))?;
        let raw = entry.path().map_err(|e| format!("Bad entry path: {e}"))?;
        let Some(name) = safe_tar_path(&raw) else {
            continue;
        };
        let target = dest_dir.join(name);
        if entry.header().entry_type().is_dir() {
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
        io::copy(&mut entry, &mut out)
            .map_err(|e| format!("Cannot write {}: {e}", target.display()))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn stt_download(app: tauri::AppHandle) -> Result<SttStatus, String> {
    let Some(archive_url) = whisper_archive_url() else {
        return Err("Whisper is not available on this platform".to_string());
    };
    let root = stt_root(&app)?;
    tokio::fs::create_dir_all(&root)
        .await
        .map_err(|e| format!("Cannot create {}: {e}", root.display()))?;

    let archive = root.join("whisper-download.bin");
    download_to_file(archive_url, &archive, MAX_ARCHIVE_BYTES).await?;

    let dir = whisper_dir(&root);
    if dir.exists() {
        tokio::fs::remove_dir_all(&dir)
            .await
            .map_err(|e| format!("Cannot clean {}: {e}", dir.display()))?;
    }
    tokio::fs::create_dir_all(&dir)
        .await
        .map_err(|e| format!("Cannot create {}: {e}", dir.display()))?;

    let extract = tokio::task::spawn_blocking({
        let archive = archive.clone();
        let dir = dir.clone();
        move || extract_archive(&archive, &dir)
    })
    .await
    .map_err(|e| format!("Extraction failed: {e}"))?;
    extract?;
    let _ = tokio::fs::remove_file(&archive).await;

    let Some(binary) = find_binary(&dir) else {
        return Err(format!(
            "{} not found in the downloaded archive",
            binary_name()
        ));
    };

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut permissions = std::fs::metadata(&binary)
            .map_err(|e| format!("Cannot stat {}: {e}", binary.display()))?
            .permissions();
        permissions.set_mode(0o755);
        std::fs::set_permissions(&binary, permissions)
            .map_err(|e| format!("Cannot chmod {}: {e}", binary.display()))?;
    }
    let _ = binary;

    let dest = model_path(&root);
    if dest.exists() {
        tokio::fs::remove_file(&dest)
            .await
            .map_err(|e| format!("Cannot clean model file: {e}"))?;
    }
    download_to_file(MODEL_URL, &dest, MAX_MODEL_BYTES).await?;

    Ok(current_status(&app))
}

#[derive(Debug, PartialEq)]
struct WavInfo {
    sample_rate: u32,
    channels: u16,
    bits_per_sample: u16,
    data_len: u64,
}

fn parse_wav(data: &[u8]) -> Result<WavInfo, String> {
    if data.len() < 12 || &data[0..4] != b"RIFF" || &data[8..12] != b"WAVE" {
        return Err("Invalid WAV payload: missing RIFF/WAVE header".to_string());
    }

    let mut offset = 12usize;
    let mut fmt: Option<(u16, u16, u32, u16)> = None;
    let mut data_len: Option<u64> = None;

    while offset + 8 <= data.len() {
        let chunk_id = &data[offset..offset + 4];
        let size_bytes: [u8; 4] = data[offset + 4..offset + 8]
            .try_into()
            .map_err(|_| "Invalid WAV payload: bad chunk header".to_string())?;
        let chunk_size = u32::from_le_bytes(size_bytes) as usize;
        let body_start = offset + 8;
        let padded = chunk_size + (chunk_size % 2);
        if body_start + chunk_size > data.len() {
            return Err("Invalid WAV payload: truncated chunk".to_string());
        }
        if chunk_id == b"fmt " {
            if chunk_size < 16 {
                return Err("Invalid WAV payload: short fmt chunk".to_string());
            }
            let body = &data[body_start..body_start + chunk_size];
            let format_bytes: [u8; 2] = body[0..2]
                .try_into()
                .map_err(|_| "Invalid WAV payload: bad fmt chunk".to_string())?;
            let channel_bytes: [u8; 2] = body[2..4]
                .try_into()
                .map_err(|_| "Invalid WAV payload: bad fmt chunk".to_string())?;
            let rate_bytes: [u8; 4] = body[4..8]
                .try_into()
                .map_err(|_| "Invalid WAV payload: bad fmt chunk".to_string())?;
            let bits_bytes: [u8; 2] = body[14..16]
                .try_into()
                .map_err(|_| "Invalid WAV payload: bad fmt chunk".to_string())?;
            fmt = Some((
                u16::from_le_bytes(format_bytes),
                u16::from_le_bytes(channel_bytes),
                u32::from_le_bytes(rate_bytes),
                u16::from_le_bytes(bits_bytes),
            ));
        } else if chunk_id == b"data" {
            data_len = Some(chunk_size as u64);
        }
        offset = body_start + padded;
    }

    let (audio_format, channels, sample_rate, bits_per_sample) =
        fmt.ok_or_else(|| "Invalid WAV payload: missing fmt chunk".to_string())?;
    let data_len = data_len.ok_or_else(|| "Invalid WAV payload: missing data chunk".to_string())?;

    if audio_format != 1 {
        return Err("Invalid WAV payload: expected PCM audio".to_string());
    }
    if channels != 1 {
        return Err("Invalid WAV payload: expected mono audio".to_string());
    }
    if bits_per_sample != 16 {
        return Err("Invalid WAV payload: expected 16-bit samples".to_string());
    }
    if !(8000..=192_000).contains(&sample_rate) {
        return Err("Invalid WAV payload: unsupported sample rate".to_string());
    }
    if data_len > MAX_WAV_DATA_BYTES {
        return Err(format!(
            "Recording is too long (max {} seconds)",
            MAX_WAV_DATA_BYTES / (16000 * 2)
        ));
    }

    Ok(WavInfo {
        sample_rate,
        channels,
        bits_per_sample,
        data_len,
    })
}

#[tauri::command]
pub async fn stt_transcribe(app: tauri::AppHandle, wav_base64: String) -> Result<String, String> {
    let status = current_status(&app);
    if !status.supported {
        return Err("Whisper is not available on this platform".to_string());
    }
    if !status.installed {
        return Err("Download Whisper in Settings".to_string());
    }

    let wav = base64::engine::general_purpose::STANDARD
        .decode(wav_base64.as_bytes())
        .map_err(|e| format!("Invalid audio payload: {e}"))?;
    parse_wav(&wav)?;

    let root = stt_root(&app)?;
    let input_dir = root.join("tmp");
    tokio::fs::create_dir_all(&input_dir)
        .await
        .map_err(|e| format!("Cannot create {}: {e}", input_dir.display()))?;
    let input_path = input_dir.join(format!("input-{}.wav", uuid::Uuid::new_v4()));
    tokio::fs::write(&input_path, &wav)
        .await
        .map_err(|e| format!("Cannot write {}: {e}", input_path.display()))?;

    let binary =
        find_binary(&whisper_dir(&root)).ok_or_else(|| "Whisper binary is missing".to_string())?;
    let args: Vec<String> = vec![
        "-m".into(),
        model_path(&root).to_string_lossy().into_owned(),
        "-f".into(),
        input_path.to_string_lossy().into_owned(),
        "-nt".into(),
        "-np".into(),
        "-l".into(),
        "auto".into(),
    ];

    let mut command = crate::platform::new_tokio_command(&binary);
    if let Some(dir) = binary.parent() {
        command.current_dir(dir);
    }
    let result = tokio::time::timeout(
        std::time::Duration::from_secs(TRANSCRIBE_TIMEOUT_SECS),
        command.args(&args).output(),
    )
    .await;

    let _ = tokio::fs::remove_file(&input_path).await;

    let output = result
        .map_err(|_| format!("Transcription timed out after {TRANSCRIBE_TIMEOUT_SECS}s"))?
        .map_err(|e| format!("Failed to run whisper-cli: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let tail: Vec<&str> = stderr
            .lines()
            .filter(|line| !line.trim().is_empty())
            .rev()
            .take(3)
            .collect();
        let message = tail.into_iter().rev().collect::<Vec<_>>().join("\n");
        return Err(if message.is_empty() {
            format!("whisper-cli exited with {}", output.status)
        } else {
            message
        });
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn build_wav(sample_rate: u32, data_len: u32) -> Vec<u8> {
        let mut wav = Vec::with_capacity(44 + data_len as usize);
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
        wav.resize(44 + data_len as usize, 0);
        wav
    }

    #[test]
    fn valid_mono_pcm_wav_parses() {
        let info = parse_wav(&build_wav(16000, 32000)).unwrap();
        assert_eq!(
            info,
            WavInfo {
                sample_rate: 16000,
                channels: 1,
                bits_per_sample: 16,
                data_len: 32000,
            }
        );
    }

    #[test]
    fn rejects_non_riff_or_truncated_payloads() {
        assert!(parse_wav(b"not a wav file at all").is_err());
        let mut wav = build_wav(16000, 32);
        wav.truncate(20);
        assert!(parse_wav(&wav).is_err());
    }

    #[test]
    fn rejects_oversized_recordings() {
        assert!(parse_wav(&build_wav(16000, (MAX_WAV_DATA_BYTES + 1) as u32)).is_err());
    }

    #[test]
    fn archive_url_is_pinned_and_platform_scoped() {
        if let Some(url) = whisper_archive_url() {
            assert!(url
                .starts_with("https://github.com/ggml-org/whisper.cpp/releases/download/v1.8.7/"));
            let name = url.rsplit('/').next().unwrap();
            assert!(name.starts_with("whisper-bin-"));
        }
    }
}
