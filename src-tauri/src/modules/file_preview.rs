use std::fs;
use std::path::Path;

use base64::Engine;
use serde::Serialize;

use super::fs::validate_path;

const MAX_PREVIEW_BYTES: u64 = 10 * 1024 * 1024;

/// Extensions that run code when the system opens them; those stay closed.
const EXECUTABLE_EXTENSIONS: &[&str] = &[
    "app", "bat", "cmd", "com", "command", "cpl", "exe", "jar", "js", "jse", "lnk", "msi", "pif",
    "ps1", "reg", "scr", "sh", "vb", "vbe", "vbs", "ws", "wsf",
];

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FilePreview {
    /// `image` for formats the webview can show, otherwise `binary`.
    pub kind: &'static str,
    pub size: u64,
    pub mime: Option<&'static str>,
    pub data_url: Option<String>,
}

fn extension(path: &Path) -> String {
    path.extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase()
}

fn image_mime(path: &Path) -> Option<&'static str> {
    match extension(path).as_str() {
        "png" => Some("image/png"),
        "jpg" | "jpeg" => Some("image/jpeg"),
        "gif" => Some("image/gif"),
        "webp" => Some("image/webp"),
        "svg" => Some("image/svg+xml"),
        "bmp" => Some("image/bmp"),
        "ico" => Some("image/x-icon"),
        "avif" => Some("image/avif"),
        _ => None,
    }
}

fn existing_file(path: &str) -> Result<&Path, String> {
    let path_ref = validate_path(path)?;
    if !path_ref.exists() {
        return Err(format!("File not found: {}", path));
    }
    if !path_ref.is_file() {
        return Err(format!("Not a file: {}", path));
    }
    Ok(path_ref)
}

/// Size of any file, plus the image itself as a data URL for image formats.
#[tauri::command(async)]
pub fn read_file_preview(path: String) -> Result<FilePreview, String> {
    let path_ref = existing_file(&path)?;
    let size = fs::metadata(path_ref)
        .map_err(|e| format!("Failed to read metadata: {}", e))?
        .len();

    let Some(mime) = image_mime(path_ref) else {
        return Ok(FilePreview {
            kind: "binary",
            size,
            mime: None,
            data_url: None,
        });
    };
    if size > MAX_PREVIEW_BYTES {
        return Err(format!(
            "Image is too large to preview ({} MB). Maximum supported size is {} MB.",
            size / (1024 * 1024),
            MAX_PREVIEW_BYTES / (1024 * 1024)
        ));
    }

    let bytes = fs::read(path_ref).map_err(|e| format!("Failed to read file: {}", e))?;
    let encoded = base64::engine::general_purpose::STANDARD.encode(bytes);
    Ok(FilePreview {
        kind: "image",
        size,
        mime: Some(mime),
        data_url: Some(format!("data:{mime};base64,{encoded}")),
    })
}

fn ensure_not_executable(path: &Path) -> Result<(), String> {
    if EXECUTABLE_EXTENSIONS.contains(&extension(path).as_str()) {
        return Err("Executable files are not opened from Pragma".to_string());
    }
    Ok(())
}

#[tauri::command(async)]
pub fn open_with_default_app(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let path_ref = existing_file(&path)?;
    ensure_not_executable(path_ref)?;

    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_path(path_ref.to_string_lossy().as_ref(), None::<&str>)
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn path_string(path: &Path) -> String {
        path.to_string_lossy().into_owned()
    }

    #[test]
    fn images_come_back_as_data_urls() {
        let dir = tempfile::tempdir().unwrap();
        let png = dir.path().join("logo.PNG");
        fs::write(&png, [0x89, b'P', b'N', b'G']).unwrap();

        let preview = read_file_preview(path_string(&png)).unwrap();
        assert_eq!(preview.kind, "image");
        assert_eq!(preview.size, 4);
        assert_eq!(preview.mime, Some("image/png"));
        assert_eq!(
            preview.data_url.as_deref(),
            Some("data:image/png;base64,iVBORw==")
        );
    }

    #[test]
    fn other_files_report_only_their_size() {
        let dir = tempfile::tempdir().unwrap();
        let archive = dir.path().join("bundle.zip");
        fs::write(&archive, [0u8; 10]).unwrap();

        assert_eq!(
            read_file_preview(path_string(&archive)).unwrap(),
            FilePreview {
                kind: "binary",
                size: 10,
                mime: None,
                data_url: None
            }
        );
    }

    #[test]
    fn large_images_and_missing_files_are_refused() {
        let dir = tempfile::tempdir().unwrap();
        let big = dir.path().join("huge.jpg");
        fs::File::create(&big)
            .unwrap()
            .set_len(MAX_PREVIEW_BYTES + 1)
            .unwrap();

        assert!(read_file_preview(path_string(&big))
            .unwrap_err()
            .starts_with("Image is too large"));
        assert!(read_file_preview(path_string(&dir.path().join("gone.png")))
            .unwrap_err()
            .starts_with("File not found"));
        assert!(read_file_preview("relative.png".to_string()).is_err());
    }

    #[test]
    fn executables_are_not_opened() {
        assert!(ensure_not_executable(Path::new("/tmp/setup.EXE")).is_err());
        assert!(ensure_not_executable(Path::new("/tmp/run.sh")).is_err());
        assert!(ensure_not_executable(Path::new("/tmp/report.pdf")).is_ok());
    }
}
