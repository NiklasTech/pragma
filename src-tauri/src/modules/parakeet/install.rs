//! Pinned Parakeet model files and ONNX Runtime library, downloaded into a
//! staging directory, verified by SHA-256 and only then moved into place.

use sha2::{Digest, Sha256};
use std::path::Path;
use std::time::{Duration, Instant};
use tokio_util::sync::CancellationToken;

const MODEL_BASE_URL: &str =
    "https://huggingface.co/Olicorne/parakeet-tdt-0.6b-v3-smoothquant-onnx/resolve/c6c57a8654c6f10d2f48f26adb05228984a7013b";
const PROGRESS_INTERVAL: Duration = Duration::from_millis(150);

pub const CANCELLED: &str = "Download cancelled";

pub struct PinnedFile {
    pub name: &'static str,
    /// Path of the file inside the model repository.
    pub remote: &'static str,
    pub size: u64,
    pub sha256: &'static str,
}

pub const MODEL_FILES: [PinnedFile; 4] = [
    PinnedFile {
        name: "nemo128.onnx",
        remote: "nemo128.onnx",
        size: 139_764,
        sha256: "a9fde1486ebfcc08f328d75ad4610c67835fea58c73ba57e3209a6f6cf019e9f",
    },
    PinnedFile {
        name: "vocab.txt",
        remote: "vocab.txt",
        size: 93_939,
        sha256: "d58544679ea4bc6ac563d1f545eb7d474bd6cfa467f0a6e2c1dc1c7d37e3c35d",
    },
    PinnedFile {
        name: "decoder_joint-model.int8.onnx",
        remote: "int8/decoder_joint-model.int8.onnx",
        size: 18_203_490,
        sha256: "63a6cd892244e5dbdd8b41541514f2643c7d3c7c454f9adcdf99ca31acb802d0",
    },
    PinnedFile {
        name: "encoder-model.int8.onnx",
        remote: "int8/encoder-model.int8.onnx",
        size: 649_524_002,
        sha256: "019f798a42be5eee029d8591116308df8e8adf1f55a6292c15f1bd5583f04af4",
    },
];

pub struct Runtime {
    pub url: &'static str,
    pub size: u64,
    pub sha256: &'static str,
    /// Path of the shared library inside the archive.
    pub member: &'static str,
    /// Name the library is stored under in the install directory.
    pub file_name: &'static str,
}

pub fn runtime() -> Option<Runtime> {
    if cfg!(all(target_os = "macos", target_arch = "aarch64")) {
        Some(Runtime {
            url: "https://github.com/microsoft/onnxruntime/releases/download/v1.28.2/onnxruntime-osx-arm64-1.28.2.tgz",
            size: 32_093_967,
            sha256: "c4fceacfc53765d0869dc9180c31ec91054d149017a99d1e80ffe28dc79596de",
            member: "onnxruntime-osx-arm64-1.28.2/lib/libonnxruntime.1.28.2.dylib",
            file_name: "libonnxruntime.dylib",
        })
    } else if cfg!(all(target_os = "windows", target_arch = "x86_64")) {
        Some(Runtime {
            url: "https://github.com/microsoft/onnxruntime/releases/download/v1.28.2/onnxruntime-win-x64-1.28.2.zip",
            size: 78_620_837,
            sha256: "c4eedd29489d5feca21866d054638416f3655bf6b18851b3b6b85c8313e95c35",
            member: "onnxruntime-win-x64-1.28.2/lib/onnxruntime.dll",
            file_name: "onnxruntime.dll",
        })
    } else if cfg!(all(target_os = "linux", target_arch = "x86_64")) {
        Some(Runtime {
            url: "https://github.com/microsoft/onnxruntime/releases/download/v1.28.2/onnxruntime-linux-x64-1.28.2.tgz",
            size: 9_128_991,
            sha256: "d7209b8751b27b862b0c76332c2e20e203396edb5dab700ecf4bb485cf147415",
            member: "onnxruntime-linux-x64-1.28.2/lib/libonnxruntime.so.1.28.2",
            file_name: "libonnxruntime.so",
        })
    } else {
        None
    }
}

pub fn total_download_bytes(runtime: &Runtime) -> u64 {
    runtime.size + MODEL_FILES.iter().map(|file| file.size).sum::<u64>()
}

/// Downloads every pinned file into `staging`. The caller removes `staging` on error.
pub async fn download_all(
    runtime: &Runtime,
    staging: &Path,
    cancel: &CancellationToken,
    on_progress: &mut impl FnMut(u64),
) -> Result<(), String> {
    tokio::fs::create_dir_all(staging)
        .await
        .map_err(|e| format!("Cannot create {}: {e}", staging.display()))?;
    let client = reqwest::Client::new();
    let mut done: u64 = 0;

    let archive = staging.join("runtime-download.bin");
    download_verified(
        &client,
        runtime.url,
        &archive,
        runtime.size,
        runtime.sha256,
        cancel,
        &mut |received| on_progress(done + received),
    )
    .await?;
    done += runtime.size;

    let library = staging.join(runtime.file_name);
    let member = runtime.member;
    tokio::task::spawn_blocking({
        let archive = archive.clone();
        move || extract_member(&archive, member, &library)
    })
    .await
    .map_err(|e| format!("Extraction failed: {e}"))??;
    let _ = tokio::fs::remove_file(&archive).await;

    for file in &MODEL_FILES {
        let url = format!("{MODEL_BASE_URL}/{}", file.remote);
        download_verified(
            &client,
            &url,
            &staging.join(file.name),
            file.size,
            file.sha256,
            cancel,
            &mut |received| on_progress(done + received),
        )
        .await?;
        done += file.size;
    }
    Ok(())
}

async fn download_verified(
    client: &reqwest::Client,
    url: &str,
    dest: &Path,
    size: u64,
    sha256: &str,
    cancel: &CancellationToken,
    on_progress: &mut impl FnMut(u64),
) -> Result<(), String> {
    use futures_util::StreamExt;
    use tokio::io::AsyncWriteExt;

    let response = tokio::select! {
        _ = cancel.cancelled() => return Err(CANCELLED.to_string()),
        response = client.get(url).header(reqwest::header::USER_AGENT, "pragma").send() => {
            response.map_err(|e| format!("Download failed: {e}"))?
        }
    };
    if !response.status().is_success() {
        return Err(format!("Download failed: HTTP {}", response.status()));
    }
    if response.content_length().is_some_and(|total| total != size) {
        return Err("Download has an unexpected size".to_string());
    }

    let mut file = tokio::fs::File::create(dest)
        .await
        .map_err(|e| format!("Cannot write {}: {e}", dest.display()))?;
    let mut hasher = Sha256::new();
    let mut stream = response.bytes_stream();
    let mut received: u64 = 0;
    let mut last_report = Instant::now();
    loop {
        let chunk = tokio::select! {
            _ = cancel.cancelled() => return Err(CANCELLED.to_string()),
            chunk = stream.next() => chunk,
        };
        let Some(chunk) = chunk else {
            break;
        };
        let chunk = chunk.map_err(|e| format!("Download failed: {e}"))?;
        received += chunk.len() as u64;
        if received > size {
            return Err("Download has an unexpected size".to_string());
        }
        hasher.update(&chunk);
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("Cannot write {}: {e}", dest.display()))?;
        if last_report.elapsed() >= PROGRESS_INTERVAL {
            last_report = Instant::now();
            on_progress(received);
        }
    }
    file.flush()
        .await
        .map_err(|e| format!("Cannot write {}: {e}", dest.display()))?;
    on_progress(received);

    if received != size {
        return Err("Download ended early".to_string());
    }
    let digest = format!("{:x}", hasher.finalize());
    if digest != sha256 {
        return Err("Downloaded file failed the checksum".to_string());
    }
    Ok(())
}

#[cfg(target_os = "windows")]
fn extract_member(archive: &Path, member: &str, dest: &Path) -> Result<(), String> {
    let file = std::fs::File::open(archive)
        .map_err(|e| format!("Cannot open {}: {e}", archive.display()))?;
    let mut zip = zip::ZipArchive::new(file)
        .map_err(|e| format!("Invalid archive {}: {e}", archive.display()))?;
    let mut entry = zip
        .by_name(member)
        .map_err(|_| format!("{member} not found in the ONNX Runtime archive"))?;
    let mut out =
        std::fs::File::create(dest).map_err(|e| format!("Cannot write {}: {e}", dest.display()))?;
    std::io::copy(&mut entry, &mut out)
        .map_err(|e| format!("Cannot write {}: {e}", dest.display()))?;
    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn extract_member(archive: &Path, member: &str, dest: &Path) -> Result<(), String> {
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
        let is_member = entry
            .path()
            .map(|path| path.as_ref() == Path::new(member))
            .unwrap_or(false);
        if !is_member || !entry.header().entry_type().is_file() {
            continue;
        }
        let mut out = std::fs::File::create(dest)
            .map_err(|e| format!("Cannot write {}: {e}", dest.display()))?;
        std::io::copy(&mut entry, &mut out)
            .map_err(|e| format!("Cannot write {}: {e}", dest.display()))?;
        return Ok(());
    }
    Err(format!("{member} not found in the ONNX Runtime archive"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn downloads_are_pinned() {
        assert!(MODEL_BASE_URL.contains("/resolve/c6c57a8654c6f10d2f48f26adb05228984a7013b"));
        for file in &MODEL_FILES {
            assert_eq!(file.sha256.len(), 64);
        }
        if let Some(runtime) = runtime() {
            assert!(runtime.url.starts_with(
                "https://github.com/microsoft/onnxruntime/releases/download/v1.28.2/"
            ));
            assert_eq!(runtime.sha256.len(), 64);
            assert!(total_download_bytes(&runtime) > 670_000_000);
        }
    }

    #[cfg(not(target_os = "windows"))]
    #[test]
    fn extracts_only_the_named_member() {
        let dir = tempfile::tempdir().unwrap();
        let archive = dir.path().join("runtime.tgz");
        {
            let file = std::fs::File::create(&archive).unwrap();
            let encoder = flate2::write::GzEncoder::new(file, flate2::Compression::fast());
            let mut builder = tar::Builder::new(encoder);
            for (name, body) in [
                ("pkg/README.md", "readme"),
                ("pkg/lib/libort.so", "library"),
            ] {
                let mut header = tar::Header::new_gnu();
                header.set_size(body.len() as u64);
                header.set_mode(0o644);
                header.set_cksum();
                builder
                    .append_data(&mut header, name, body.as_bytes())
                    .unwrap();
            }
            builder.into_inner().unwrap().finish().unwrap();
        }
        let dest = dir.path().join("libonnxruntime.so");
        extract_member(&archive, "pkg/lib/libort.so", &dest).unwrap();
        assert_eq!(std::fs::read_to_string(&dest).unwrap(), "library");
        assert!(extract_member(&archive, "pkg/lib/missing.so", &dest).is_err());
    }
}
