use std::fs;
use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager};

const MAX_IMAGE_SIZE: u64 = 25 * 1024 * 1024;
const EXTENSIONS: &[&str] = &["png", "jpg", "jpeg", "webp", "gif"];
const FILE_STEM: &str = "background";

fn background_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|dir| dir.join("background"))
        .map_err(|e| format!("Failed to resolve app data dir: {e}"))
}

fn image_extension(path: &Path) -> Result<String, String> {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(str::to_lowercase)
        .unwrap_or_default();
    if EXTENSIONS.contains(&ext.as_str()) {
        Ok(ext)
    } else {
        Err("Choose a PNG, JPEG, WebP or GIF image".to_string())
    }
}

/// Only files this module writes may be read back: `background-<digits>.<image extension>`.
fn validate_stored_name(name: &str) -> Result<(), String> {
    let invalid = || "Invalid background image name".to_string();
    let rest = name
        .strip_prefix(FILE_STEM)
        .and_then(|rest| rest.strip_prefix('-'))
        .ok_or_else(invalid)?;
    let (stamp, ext) = rest.split_once('.').ok_or_else(invalid)?;
    if stamp.is_empty() || !stamp.chars().all(|c| c.is_ascii_digit()) || !EXTENSIONS.contains(&ext)
    {
        return Err(invalid());
    }
    Ok(())
}

fn clear_in(dir: &Path) -> Result<(), String> {
    for entry in fs::read_dir(dir).map_err(|e| format!("Failed to read background folder: {e}"))? {
        let entry = entry.map_err(|e| format!("Failed to read background folder: {e}"))?;
        let name = entry.file_name();
        if name
            .to_str()
            .is_some_and(|n| validate_stored_name(n).is_ok())
        {
            fs::remove_file(entry.path())
                .map_err(|e| format!("Failed to remove background image: {e}"))?;
        }
    }
    Ok(())
}

fn copy_into(dir: &Path, source: &Path) -> Result<String, String> {
    if !source.is_absolute() {
        return Err("Image path must be absolute".to_string());
    }
    let ext = image_extension(source)?;
    let meta = fs::metadata(source).map_err(|e| format!("Cannot read the image: {e}"))?;
    if !meta.is_file() {
        return Err("The image is not a file".to_string());
    }
    if meta.len() > MAX_IMAGE_SIZE {
        return Err("The image is larger than 25 MB".to_string());
    }
    fs::create_dir_all(dir).map_err(|e| format!("Failed to create background folder: {e}"))?;
    clear_in(dir)?;
    // A new name per image lets the interface reload it even with the same extension.
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or_default();
    let name = format!("{FILE_STEM}-{stamp}.{ext}");
    fs::copy(source, dir.join(&name)).map_err(|e| format!("Failed to copy the image: {e}"))?;
    Ok(name)
}

fn read_from(dir: &Path, name: &str) -> Result<Vec<u8>, String> {
    validate_stored_name(name)?;
    let path = dir.join(name);
    let meta = fs::symlink_metadata(&path).map_err(|_| "Background image not found".to_string())?;
    if !meta.is_file() || meta.len() > MAX_IMAGE_SIZE {
        return Err("Background image not found".to_string());
    }
    fs::read(path).map_err(|e| format!("Failed to read background image: {e}"))
}

/// Copies an image into the app data directory and returns the stored file name.
#[tauri::command(async)]
pub fn background_image_set(app: AppHandle, source_path: String) -> Result<String, String> {
    copy_into(&background_dir(&app)?, Path::new(&source_path))
}

#[tauri::command(async)]
pub fn background_image_read(
    app: AppHandle,
    file_name: String,
) -> Result<tauri::ipc::Response, String> {
    read_from(&background_dir(&app)?, &file_name).map(tauri::ipc::Response::new)
}

#[tauri::command(async)]
pub fn background_image_clear(app: AppHandle) -> Result<(), String> {
    let dir = background_dir(&app)?;
    if !dir.exists() {
        return Ok(());
    }
    clear_in(&dir)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write(path: &Path, bytes: &[u8]) {
        fs::write(path, bytes).unwrap();
    }

    #[test]
    fn copies_reads_and_replaces_the_image() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path().join("background");
        let png = tmp.path().join("Photo.PNG");
        write(&png, b"png-bytes");

        let name = copy_into(&dir, &png).unwrap();
        assert!(name.starts_with("background-") && name.ends_with(".png"));
        assert_eq!(read_from(&dir, &name).unwrap(), b"png-bytes");

        let jpg = tmp.path().join("other.jpg");
        write(&jpg, b"jpg-bytes");
        let second = copy_into(&dir, &jpg).unwrap();
        assert!(second.ends_with(".jpg"));
        assert!(read_from(&dir, &name).is_err());
        assert_eq!(read_from(&dir, &second).unwrap(), b"jpg-bytes");

        fs::write(dir.join("keep.txt"), "other").unwrap();
        clear_in(&dir).unwrap();
        assert!(read_from(&dir, &second).is_err());
        assert!(dir.join("keep.txt").exists());
    }

    #[test]
    fn rejects_other_files_and_paths() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path().join("background");
        let txt = tmp.path().join("notes.txt");
        write(&txt, b"text");
        assert!(copy_into(&dir, &txt).is_err());
        assert!(copy_into(&dir, Path::new("relative.png")).is_err());
        assert!(copy_into(&dir, &tmp.path().join("missing.png")).is_err());

        for name in [
            "../secret.png",
            "background-1.txt",
            "other-1.png",
            "background-1.png/../../x",
            "background-.png",
            "background-12a.png",
            "background.png",
            "background",
        ] {
            assert!(read_from(&dir, name).is_err(), "{name} was readable");
        }
    }

    #[cfg(unix)]
    #[test]
    fn does_not_follow_a_symlinked_image() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path().join("background");
        fs::create_dir_all(&dir).unwrap();
        let secret = tmp.path().join("secret.png");
        write(&secret, b"secret");
        std::os::unix::fs::symlink(&secret, dir.join("background-1.png")).unwrap();
        assert!(read_from(&dir, "background-1.png").is_err());
    }
}
