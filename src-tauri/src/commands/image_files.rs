use std::path::{Component, Path};

use base64::Engine;
use serde::{Deserialize, Serialize};

/// Matches the frontend limit for images before they are scaled down.
const MAX_IMAGE_FILE_BYTES: u64 = 20 * 1024 * 1024;

#[derive(Debug, Deserialize)]
pub struct ReadImageFileRequest {
    pub path: String,
}

#[derive(Debug, Serialize)]
pub struct ImageFile {
    pub name: String,
    pub media_type: String,
    pub data: String,
}

/// Detects PNG, JPEG, GIF and WebP from their signatures.
fn sniff_image_type(bytes: &[u8]) -> Option<&'static str> {
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        Some("image/png")
    } else if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        Some("image/jpeg")
    } else if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        Some("image/gif")
    } else if bytes.len() >= 12 && &bytes[..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        Some("image/webp")
    } else {
        None
    }
}

fn read_image(path: &Path) -> Result<ImageFile, String> {
    if !path.is_absolute() {
        return Err("Path must be absolute".to_string());
    }
    if path
        .components()
        .any(|component| matches!(component, Component::ParentDir))
    {
        return Err("Path traversal is not allowed".to_string());
    }

    let metadata = std::fs::metadata(path).map_err(|e| format!("Failed to read the image: {e}"))?;
    if !metadata.is_file() {
        return Err("Not a file".to_string());
    }
    if metadata.len() > MAX_IMAGE_FILE_BYTES {
        return Err("The image is larger than 20 MB.".to_string());
    }

    let bytes = std::fs::read(path).map_err(|e| format!("Failed to read the image: {e}"))?;
    let media_type = sniff_image_type(&bytes)
        .ok_or_else(|| "Not a PNG, JPEG, GIF or WebP image.".to_string())?;
    let name = path
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_default();

    Ok(ImageFile {
        name,
        media_type: media_type.to_string(),
        data: base64::engine::general_purpose::STANDARD.encode(bytes),
    })
}

/// Reads an image the user dropped onto the window from the file manager.
#[tauri::command(async)]
pub fn read_image_file(req: ReadImageFileRequest) -> Result<ImageFile, String> {
    read_image(Path::new(&req.path))
}

#[cfg(test)]
mod tests {
    use super::*;

    const PNG: &[u8] = b"\x89PNG\r\n\x1a\n\0\0\0\rIHDR";

    #[test]
    fn sniffs_supported_image_types() {
        assert_eq!(sniff_image_type(PNG), Some("image/png"));
        assert_eq!(
            sniff_image_type(&[0xFF, 0xD8, 0xFF, 0xE0]),
            Some("image/jpeg")
        );
        assert_eq!(sniff_image_type(b"GIF89a...."), Some("image/gif"));
        assert_eq!(
            sniff_image_type(b"RIFF\0\0\0\0WEBPVP8 "),
            Some("image/webp")
        );
        assert_eq!(sniff_image_type(b"<svg xmlns="), None);
        assert_eq!(sniff_image_type(b""), None);
    }

    #[test]
    fn reads_an_image_as_base64() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("shot.png");
        std::fs::write(&path, PNG).unwrap();

        let image = read_image(&path).unwrap();

        assert_eq!(image.name, "shot.png");
        assert_eq!(image.media_type, "image/png");
        assert_eq!(
            image.data,
            base64::engine::general_purpose::STANDARD.encode(PNG)
        );
    }

    #[test]
    fn rejects_non_images_directories_and_relative_paths() {
        let dir = tempfile::tempdir().unwrap();
        let text = dir.path().join("notes.png");
        std::fs::write(&text, "not an image").unwrap();

        assert!(read_image(&text).is_err());
        assert!(read_image(dir.path()).is_err());
        assert!(read_image(Path::new("relative/shot.png")).is_err());
        assert!(read_image(&dir.path().join("..").join("shot.png")).is_err());
    }
}
