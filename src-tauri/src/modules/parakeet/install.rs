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

pub const PREPROCESSOR_FILE: &str = "nemo128.onnx";
pub const VOCAB_FILE: &str = "vocab.txt";
pub const ENCODER_FILE: &str = "encoder.onnx";
pub const DECODER_FILE: &str = "decoder_joint.onnx";

const PREPROCESSOR: PinnedFile = PinnedFile {
    name: PREPROCESSOR_FILE,
    remote: "nemo128.onnx",
    size: 139_764,
    sha256: "a9fde1486ebfcc08f328d75ad4610c67835fea58c73ba57e3209a6f6cf019e9f",
};
const VOCAB: PinnedFile = PinnedFile {
    name: VOCAB_FILE,
    remote: "vocab.txt",
    size: 93_939,
    sha256: "d58544679ea4bc6ac563d1f545eb7d474bd6cfa467f0a6e2c1dc1c7d37e3c35d",
};
const DECODER_INT8: PinnedFile = PinnedFile {
    name: DECODER_FILE,
    remote: "int8/decoder_joint-model.int8.onnx",
    size: 18_203_490,
    sha256: "63a6cd892244e5dbdd8b41541514f2643c7d3c7c454f9adcdf99ca31acb802d0",
};

pub struct ModelSpec {
    pub id: &'static str,
    pub files: [PinnedFile; 4],
}

pub const MODELS: [ModelSpec; 2] = [
    ModelSpec {
        id: "parakeet-v3",
        files: [
            PREPROCESSOR,
            VOCAB,
            DECODER_INT8,
            PinnedFile {
                name: ENCODER_FILE,
                remote: "int8/encoder-model.int8.onnx",
                size: 649_524_002,
                sha256: "019f798a42be5eee029d8591116308df8e8adf1f55a6292c15f1bd5583f04af4",
            },
        ],
    },
    ModelSpec {
        id: "parakeet-v3-compact",
        files: [
            PREPROCESSOR,
            VOCAB,
            DECODER_INT8,
            PinnedFile {
                name: ENCODER_FILE,
                remote: "w4a8/encoder-model.w4a8.onnx",
                size: 383_447_892,
                sha256: "cd781436af52495000415e30b2cbbc0b7a089b6cdb451c20d3f941695751ce07",
            },
        ],
    },
];

/// Looks up a catalog model; ids come from the frontend, so unknown ones are rejected.
pub fn model(id: &str) -> Result<&'static ModelSpec, String> {
    MODELS
        .iter()
        .find(|spec| spec.id == id)
        .ok_or_else(|| format!("Unknown Parakeet model: {id}"))
}

pub struct Runtime {
    pub url: &'static str,
    pub size: u64,
    pub sha256: &'static str,
    /// Path of the shared library inside the archive.
    pub member: &'static str,
    /// Name the library is stored under in the install directory.
    pub file_name: &'static str,
}

// The official NuGet package holds every platform's library; GitHub no longer serves the releases.
const RUNTIME_URL: &str = "https://api.nuget.org/v3-flatcontainer/microsoft.ml.onnxruntime/1.28.0/microsoft.ml.onnxruntime.1.28.0.nupkg";
const RUNTIME_SIZE: u64 = 139_145_017;
const RUNTIME_SHA256: &str = "769d1d3ea8ab6cd69f737c9dd4d4462aa4ad0ccfa106eaf506efc40d7bead5db";

pub fn runtime() -> Option<Runtime> {
    let (member, file_name) = if cfg!(all(target_os = "macos", target_arch = "aarch64")) {
        (
            "runtimes/osx-arm64/native/libonnxruntime.dylib",
            "libonnxruntime.dylib",
        )
    } else if cfg!(all(target_os = "windows", target_arch = "x86_64")) {
        ("runtimes/win-x64/native/onnxruntime.dll", "onnxruntime.dll")
    } else if cfg!(all(target_os = "linux", target_arch = "x86_64")) {
        (
            "runtimes/linux-x64/native/libonnxruntime.so",
            "libonnxruntime.so",
        )
    } else {
        return None;
    };
    Some(Runtime {
        url: RUNTIME_URL,
        size: RUNTIME_SIZE,
        sha256: RUNTIME_SHA256,
        member,
        file_name,
    })
}

pub fn model_bytes(spec: &ModelSpec) -> u64 {
    spec.files.iter().map(|file| file.size).sum()
}

/// Downloads the runtime library into `staging`. The caller removes `staging` on error.
pub async fn download_runtime(
    runtime: &Runtime,
    staging: &Path,
    cancel: &CancellationToken,
    on_progress: &mut impl FnMut(u64),
) -> Result<(), String> {
    tokio::fs::create_dir_all(staging)
        .await
        .map_err(|e| format!("Cannot create {}: {e}", staging.display()))?;
    let archive = staging.join("runtime-download.bin");
    download_verified(
        &reqwest::Client::new(),
        runtime.url,
        &archive,
        runtime.size,
        runtime.sha256,
        cancel,
        on_progress,
    )
    .await?;

    let library = staging.join(runtime.file_name);
    let member = runtime.member;
    tokio::task::spawn_blocking({
        let archive = archive.clone();
        move || extract_member(&archive, member, &library)
    })
    .await
    .map_err(|e| format!("Extraction failed: {e}"))??;
    let _ = tokio::fs::remove_file(&archive).await;
    Ok(())
}

/// Downloads every file of `spec` into `staging`. The caller removes `staging` on error.
pub async fn download_model(
    spec: &ModelSpec,
    staging: &Path,
    cancel: &CancellationToken,
    on_progress: &mut impl FnMut(u64),
) -> Result<(), String> {
    tokio::fs::create_dir_all(staging)
        .await
        .map_err(|e| format!("Cannot create {}: {e}", staging.display()))?;
    let client = reqwest::Client::new();
    let mut done: u64 = 0;
    for file in &spec.files {
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

pub(crate) async fn download_verified(
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
    let digest = hex::encode(hasher.finalize());
    if digest != sha256 {
        return Err("Downloaded file failed the checksum".to_string());
    }
    Ok(())
}

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn downloads_are_pinned() {
        assert!(MODEL_BASE_URL.contains("/resolve/c6c57a8654c6f10d2f48f26adb05228984a7013b"));
        for spec in &MODELS {
            for file in &spec.files {
                assert_eq!(file.sha256.len(), 64);
            }
        }
        if let Some(runtime) = runtime() {
            assert!(runtime
                .url
                .ends_with("/microsoft.ml.onnxruntime.1.28.0.nupkg"));
            assert_eq!(runtime.sha256.len(), 64);
        }
    }

    #[test]
    fn catalog_models_have_distinct_ids_and_every_local_file() {
        for (index, spec) in MODELS.iter().enumerate() {
            assert!(MODELS[..index].iter().all(|other| other.id != spec.id));
            for name in [PREPROCESSOR_FILE, VOCAB_FILE, ENCODER_FILE, DECODER_FILE] {
                assert!(spec.files.iter().any(|file| file.name == name));
            }
        }
        assert!(model("parakeet-v3").is_ok());
        assert!(model("../parakeet-v3").is_err());
    }

    #[test]
    fn extracts_only_the_named_member() {
        use std::io::Write;

        let dir = tempfile::tempdir().unwrap();
        let archive = dir.path().join("runtime.nupkg");
        {
            let file = std::fs::File::create(&archive).unwrap();
            let mut zip = zip::ZipWriter::new(file);
            for (name, body) in [
                ("README.md", "readme"),
                ("runtimes/linux-x64/native/libort.so", "library"),
            ] {
                zip.start_file(name, zip::write::SimpleFileOptions::default())
                    .unwrap();
                zip.write_all(body.as_bytes()).unwrap();
            }
            zip.finish().unwrap();
        }
        let dest = dir.path().join("libonnxruntime.so");
        extract_member(&archive, "runtimes/linux-x64/native/libort.so", &dest).unwrap();
        assert_eq!(std::fs::read_to_string(&dest).unwrap(), "library");
        assert!(extract_member(&archive, "runtimes/linux-x64/native/missing.so", &dest).is_err());
    }
}
