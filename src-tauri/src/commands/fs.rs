use serde::Serialize;
use std::fs;
use std::path::Path;

#[derive(Serialize)]
pub struct FileReadResult {
    pub path: String,
    pub name: String,
    pub content: String,
}

#[tauri::command]
pub fn read_text_file(path: String) -> Result<FileReadResult, String> {
    let path_ref = Path::new(&path);

    if !path_ref.exists() {
        return Err(format!("File not found: {}", path));
    }

    if !path_ref.is_file() {
        return Err(format!("Not a file: {}", path));
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
pub fn write_text_file(path: String, content: String) -> Result<(), String> {
    let path_ref = Path::new(&path);

    if !path_ref.exists() {
        return Err(format!("File not found: {}", path));
    }

    if !path_ref.is_file() {
        return Err(format!("Not a file: {}", path));
    }

    fs::write(path_ref, content).map_err(|e| format!("Failed to write file: {}", e))
}
