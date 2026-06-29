use serde::Serialize;
use std::fs;
use std::path::{Component, Path};

use super::local_history;

fn validate_path(path: &str) -> Result<&Path, String> {
    let parsed = Path::new(path);

    if !parsed.is_absolute() {
        return Err("Path must be absolute".to_string());
    }

    for component in parsed.components() {
        if matches!(component, Component::ParentDir) {
            return Err("Path traversal is not allowed".to_string());
        }
    }

    Ok(parsed)
}

#[derive(Serialize)]
pub struct FileReadResult {
    pub path: String,
    pub name: String,
    pub content: String,
}

#[derive(Serialize)]
pub struct DirEntry {
    pub path: String,
    pub name: String,
    pub is_directory: bool,
    pub is_file: bool,
}

const MAX_FILE_SIZE_BYTES: u64 = 10 * 1024 * 1024;
const LARGE_FILE_THRESHOLD_BYTES: u64 = 1024 * 1024;

#[tauri::command]
pub fn read_text_file(path: String) -> Result<FileReadResult, String> {
    let path_ref = validate_path(&path)?;

    if !path_ref.exists() {
        return Err(format!("File not found: {}", path));
    }

    if !path_ref.is_file() {
        return Err(format!("Not a file: {}", path));
    }

    let metadata = fs::metadata(path_ref).map_err(|e| format!("Failed to read metadata: {}", e))?;
    let file_size = metadata.len();

    if file_size > MAX_FILE_SIZE_BYTES {
        return Err(format!(
            "File is too large ({} MB). Maximum supported size is {} MB.",
            file_size / (1024 * 1024),
            MAX_FILE_SIZE_BYTES / (1024 * 1024)
        ));
    }

    if file_size > LARGE_FILE_THRESHOLD_BYTES {
        log::warn!("Opening large file: {} ({} bytes)", path, file_size);
    }

    let bytes = fs::read(path_ref).map_err(|e| format!("Failed to read file: {}", e))?;

    if bytes.contains(&0) {
        return Err("Binary files are not supported".to_string());
    }

    let content =
        String::from_utf8(bytes).map_err(|e| format!("File is not valid UTF-8: {}", e))?;

    let name = path_ref
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    Ok(FileReadResult {
        path,
        name,
        content,
    })
}

#[tauri::command]
pub fn write_text_file(app: tauri::AppHandle, path: String, content: String) -> Result<(), String> {
    let path_ref = validate_path(&path)?;

    if path_ref.exists() && !path_ref.is_file() {
        return Err(format!("Not a file: {}", path));
    }

    fs::write(path_ref, &content).map_err(|e| format!("Failed to write file: {}", e))?;

    let repo_path = path_ref
        .parent()
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_default();
    let _ = local_history::on_file_saved(&app, &repo_path, &path, &content);

    Ok(())
}

#[tauri::command]
pub fn list_directory(path: String) -> Result<Vec<DirEntry>, String> {
    let path_ref = validate_path(&path)?;

    if !path_ref.exists() {
        return Err(format!("Path not found: {}", path));
    }

    if !path_ref.is_dir() {
        return Err(format!("Not a directory: {}", path));
    }

    let dir = fs::read_dir(path_ref).map_err(|e| format!("Failed to read directory: {}", e))?;

    let mut entries: Vec<DirEntry> = Vec::new();

    for entry in dir {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let metadata = entry
            .metadata()
            .map_err(|e| format!("Failed to read metadata: {}", e))?;
        let name = entry.file_name().to_string_lossy().to_string();
        let path = entry.path().to_string_lossy().to_string();

        entries.push(DirEntry {
            path,
            name,
            is_directory: metadata.is_dir(),
            is_file: metadata.is_file(),
        });
    }

    entries.sort_by(|a, b| match (a.is_directory, b.is_directory) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    Ok(entries)
}

#[tauri::command]
pub fn list_directory_recursive(path: String) -> Result<Vec<DirEntry>, String> {
    let path_ref = validate_path(&path)?;

    if !path_ref.exists() {
        return Err(format!("Path not found: {}", path));
    }

    if !path_ref.is_dir() {
        return Err(format!("Not a directory: {}", path));
    }

    let mut entries: Vec<DirEntry> = Vec::new();
    collect_entries_recursive(path_ref, &mut entries, 0)?;

    entries.sort_by(|a, b| match (a.is_directory, b.is_directory) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    Ok(entries)
}

fn collect_entries_recursive(
    dir: &Path,
    out: &mut Vec<DirEntry>,
    depth: usize,
) -> Result<(), String> {
    if depth > 8 {
        return Ok(());
    }

    let dir_entries = fs::read_dir(dir).map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in dir_entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let metadata = entry
            .metadata()
            .map_err(|e| format!("Failed to read metadata: {}", e))?;
        let name = entry.file_name().to_string_lossy().to_string();
        let path = entry.path().to_string_lossy().to_string();

        if name.starts_with('.') || name == "node_modules" || name == "target" {
            continue;
        }

        let is_directory = metadata.is_dir();
        let is_file = metadata.is_file();

        out.push(DirEntry {
            path,
            name,
            is_directory,
            is_file,
        });

        if is_directory {
            collect_entries_recursive(&entry.path(), out, depth + 1)?;
        }
    }

    Ok(())
}

#[tauri::command]
pub fn create_file(path: String) -> Result<(), String> {
    let path_ref = validate_path(&path)?;

    if path_ref.exists() {
        return Err(format!("Already exists: {}", path));
    }

    fs::write(path_ref, "").map_err(|e| format!("Failed to create file: {}", e))
}

#[tauri::command]
pub fn create_directory(path: String) -> Result<(), String> {
    let path_ref = validate_path(&path)?;

    if path_ref.exists() {
        return Err(format!("Already exists: {}", path));
    }

    fs::create_dir_all(path_ref).map_err(|e| format!("Failed to create directory: {}", e))
}

#[tauri::command]
pub fn rename_file(old_path: String, new_path: String) -> Result<(), String> {
    let old_ref = validate_path(&old_path)?;
    let new_ref = validate_path(&new_path)?;

    if !old_ref.exists() {
        return Err(format!("Source not found: {}", old_path));
    }

    if new_ref.exists() {
        return Err(format!("Destination already exists: {}", new_path));
    }

    fs::rename(old_ref, new_ref).map_err(|e| format!("Failed to rename: {}", e))
}

#[tauri::command]
pub fn delete_file(path: String) -> Result<(), String> {
    let path_ref = validate_path(&path)?;

    if !path_ref.exists() {
        return Err(format!("Not found: {}", path));
    }

    if path_ref.is_file() {
        fs::remove_file(path_ref).map_err(|e| format!("Failed to delete file: {}", e))
    } else if path_ref.is_dir() {
        fs::remove_dir_all(path_ref).map_err(|e| format!("Failed to delete directory: {}", e))
    } else {
        Err(format!("Not a file or directory: {}", path))
    }
}
