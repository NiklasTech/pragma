use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};
use tauri::Manager;

const MAX_FONT_FILE_SIZE: usize = 20 * 1024 * 1024;
const MAX_ZIP_SIZE: usize = 50 * 1024 * 1024;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FontFileSpec {
    pub weight: u16,
    pub style: String,
    pub filename: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FontFileEntry {
    pub weight: u16,
    pub style: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FontConfig {
    pub id: String,
    pub name: String,
    pub source: String,
    pub category: String,
    pub files: Vec<FontFileEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadFontRequest {
    pub id: String,
    pub name: String,
    pub url: String,
    pub files: Vec<FontFileSpec>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportFontRequest {
    pub name: String,
    pub path: String,
}

fn fonts_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {e}"))?
        .join("fonts");
    Ok(dir)
}

fn sanitize_id(id: &str) -> Result<String, String> {
    let sanitized: String = id
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '-'
            }
        })
        .collect();
    if sanitized.is_empty() || sanitized.len() > 64 {
        return Err("Invalid font id".to_string());
    }
    Ok(sanitized)
}

fn is_safe_font_path(base: &Path, path: &Path) -> bool {
    let canonical_base = match base.canonicalize() {
        Ok(p) => p,
        Err(_) => return false,
    };
    let target = canonical_base.join(path);
    let canonical_target = match target.canonicalize() {
        Ok(p) => p,
        Err(_) => {
            // File does not exist yet; check the cleaned path string instead.
            let cleaned = target.components().collect::<PathBuf>();
            return cleaned.starts_with(&canonical_base);
        }
    };
    canonical_target.starts_with(&canonical_base)
}

fn font_dir_for_id(base: &Path, id: &str) -> Result<PathBuf, String> {
    let sanitized = sanitize_id(id)?;
    Ok(base.join(&sanitized))
}

#[tauri::command]
pub fn get_app_data_dir(app: tauri::AppHandle) -> Result<String, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {e}"))
        .map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn download_font(
    app: tauri::AppHandle,
    request: DownloadFontRequest,
) -> Result<FontConfig, String> {
    let base = fonts_dir(&app)?;
    let font_dir = font_dir_for_id(&base, &request.id)?;

    if font_dir.exists() {
        fs::remove_dir_all(&font_dir).map_err(|e| format!("Failed to clean font dir: {e}"))?;
    }
    fs::create_dir_all(&font_dir).map_err(|e| format!("Failed to create font dir: {e}"))?;

    let response = reqwest::get(&request.url)
        .await
        .map_err(|e| format!("Failed to download font archive: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("Download failed with status {}", response.status()));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read download bytes: {e}"))?;

    if bytes.len() > MAX_ZIP_SIZE {
        return Err("Font archive is too large".to_string());
    }

    let cursor = io::Cursor::new(bytes);
    let mut archive =
        zip::ZipArchive::new(cursor).map_err(|e| format!("Invalid zip archive: {e}"))?;

    let mut extracted: Vec<FontFileEntry> = Vec::new();

    for spec in &request.files {
        let mut found = false;
        for i in 0..archive.len() {
            let mut file = archive
                .by_index(i)
                .map_err(|e| format!("Failed to read zip entry: {e}"))?;
            let name = file.name().to_owned();
            if !name
                .to_lowercase()
                .ends_with(&format!("/{}", spec.filename.to_lowercase()))
                && name.to_lowercase() != spec.filename.to_lowercase()
            {
                continue;
            }
            if file.is_dir() {
                continue;
            }

            let size = file.size() as usize;
            if size > MAX_FONT_FILE_SIZE {
                return Err(format!("Font file {} is too large", spec.filename));
            }

            let mut buf = Vec::with_capacity(size);
            file.read_to_end(&mut buf)
                .map_err(|e| format!("Failed to read font file from archive: {e}"))?;

            let target_name = format!("{}-{}-{}.ttf", request.id, spec.weight, spec.style);
            let target_path = font_dir.join(&target_name);
            if !is_safe_font_path(&base, &Path::new(&request.id).join(&target_name)) {
                return Err("Unsafe font file path".to_string());
            }
            let mut out = fs::File::create(&target_path)
                .map_err(|e| format!("Failed to create font file: {e}"))?;
            out.write_all(&buf)
                .map_err(|e| format!("Failed to write font file: {e}"))?;

            extracted.push(FontFileEntry {
                weight: spec.weight,
                style: spec.style.clone(),
                path: target_path.to_string_lossy().to_string(),
            });
            found = true;
            break;
        }
        if !found {
            return Err(format!("Font file {} not found in archive", spec.filename));
        }
    }

    Ok(FontConfig {
        id: sanitize_id(&request.id)?,
        name: request.name,
        source: "download".to_string(),
        category: "monospace".to_string(),
        files: extracted,
    })
}

#[tauri::command]
pub fn import_font_file(
    app: tauri::AppHandle,
    request: ImportFontRequest,
) -> Result<FontConfig, String> {
    let source = Path::new(&request.path);
    if !source.is_absolute() {
        return Err("Source path must be absolute".to_string());
    }
    if !source.exists() || !source.is_file() {
        return Err("Source font file does not exist".to_string());
    }

    let ext = source
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    if !matches!(ext.as_str(), "ttf" | "otf" | "woff" | "woff2") {
        return Err("Unsupported font file format".to_string());
    }

    let base = fonts_dir(&app)?;
    let id = sanitize_id(&request.name)?;
    let font_dir = font_dir_for_id(&base, &id)?;

    fs::create_dir_all(&font_dir).map_err(|e| format!("Failed to create font dir: {e}"))?;

    let target_name = format!("{}-400-normal.{}", id, ext);
    let target_path = font_dir.join(&target_name);
    if !is_safe_font_path(&base, &Path::new(&id).join(&target_name)) {
        return Err("Unsafe font file path".to_string());
    }

    fs::copy(source, &target_path).map_err(|e| format!("Failed to copy font file: {e}"))?;

    Ok(FontConfig {
        id,
        name: request.name,
        source: "local".to_string(),
        category: "monospace".to_string(),
        files: vec![FontFileEntry {
            weight: 400,
            style: "normal".to_string(),
            path: target_path.to_string_lossy().to_string(),
        }],
    })
}

#[tauri::command]
pub fn delete_font(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let base = fonts_dir(&app)?;
    let font_dir = font_dir_for_id(&base, &id)?;
    if !font_dir.exists() {
        return Ok(());
    }
    fs::remove_dir_all(&font_dir).map_err(|e| format!("Failed to delete font: {e}"))?;
    Ok(())
}

#[tauri::command]
pub fn list_fonts(app: tauri::AppHandle) -> Result<Vec<FontConfig>, String> {
    let base = fonts_dir(&app)?;
    if !base.exists() {
        return Ok(Vec::new());
    }

    let mut configs = Vec::new();
    for entry in fs::read_dir(&base).map_err(|e| format!("Failed to read fonts dir: {e}"))? {
        let entry = entry.map_err(|e| format!("Failed to read dir entry: {e}"))?;
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let id = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();
        let mut files = Vec::new();
        for file_entry in
            fs::read_dir(&path).map_err(|e| format!("Failed to read font dir: {e}"))?
        {
            let file_entry = file_entry.map_err(|e| format!("Failed to read file entry: {e}"))?;
            let file_path = file_entry.path();
            if !file_path.is_file() {
                continue;
            }
            let name = file_path
                .file_stem()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string();
            let parts: Vec<&str> = name.split('-').collect();
            let weight = parts
                .get(parts.len().saturating_sub(2))
                .and_then(|p| p.parse::<u16>().ok())
                .unwrap_or(400);
            let style = parts
                .last()
                .map(|s| s.to_string())
                .unwrap_or_else(|| "normal".to_string());
            files.push(FontFileEntry {
                weight,
                style,
                path: file_path.to_string_lossy().to_string(),
            });
        }

        if !files.is_empty() {
            configs.push(FontConfig {
                id: id.clone(),
                name: id.replace(['-', '_'], " "),
                source: "local".to_string(),
                category: "monospace".to_string(),
                files,
            });
        }
    }

    Ok(configs)
}
