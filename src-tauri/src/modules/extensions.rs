use serde::Serialize;
use std::fs;
use std::path::{Component, Path, PathBuf};

pub const EXTENSION_FORMAT: &str = "pragma-extension-v1";

const MAX_MAIN_SIZE_BYTES: u64 = 1024 * 1024;
const MAX_ASSET_SIZE_BYTES: u64 = 5 * 1024 * 1024;

#[derive(Debug, Clone, Serialize)]
pub struct ExtensionSummary {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: Option<String>,
    pub path: String,
    pub manifest: Option<serde_json::Value>,
    pub error: Option<String>,
}

#[derive(Debug, Clone)]
struct ManifestInfo {
    id: String,
    name: String,
    version: String,
    description: Option<String>,
}

fn extensions_dir(workspace_root: &str) -> PathBuf {
    Path::new(workspace_root).join(".pragma").join("extensions")
}

fn validate_extension_id(id: &str) -> Result<(), String> {
    if id.is_empty() || id.len() > 64 {
        return Err("Extension id must be 1-64 characters".to_string());
    }
    if !id
        .chars()
        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
    {
        return Err(
            "Extension id may only contain lowercase letters, numbers and hyphens".to_string(),
        );
    }
    Ok(())
}

fn confined_join(base: &Path, relative: &str) -> Result<PathBuf, String> {
    let rel = Path::new(relative);
    let mut out = base.to_path_buf();
    for component in rel.components() {
        match component {
            Component::Normal(part) => out.push(part),
            Component::CurDir => {}
            _ => return Err(format!("Path escapes the extension directory: {relative}")),
        }
    }
    Ok(out)
}

fn extension_dir(workspace_root: &str, extension_id: &str) -> Result<PathBuf, String> {
    validate_extension_id(extension_id)?;
    Ok(extensions_dir(workspace_root).join(extension_id))
}

fn validate_contributes(contributes: &serde_json::Value) -> Result<(), String> {
    let obj = contributes
        .as_object()
        .ok_or_else(|| "contributes must be an object".to_string())?;

    if let Some(commands) = obj.get("commands") {
        let commands = commands
            .as_array()
            .ok_or_else(|| "contributes.commands must be an array".to_string())?;
        for command in commands {
            let command = command
                .as_object()
                .ok_or_else(|| "contributes.commands entries must be objects".to_string())?;
            for key in ["id", "title"] {
                if command.get(key).and_then(|v| v.as_str()).is_none() {
                    return Err(format!(
                        "contributes.commands entries require a string \"{key}\""
                    ));
                }
            }
        }
    }

    if let Some(panels) = obj.get("panels") {
        let panels = panels
            .as_array()
            .ok_or_else(|| "contributes.panels must be an array".to_string())?;
        for panel in panels {
            let panel = panel
                .as_object()
                .ok_or_else(|| "contributes.panels entries must be objects".to_string())?;
            for key in ["id", "title"] {
                if panel.get(key).and_then(|v| v.as_str()).is_none() {
                    return Err(format!(
                        "contributes.panels entries require a string \"{key}\""
                    ));
                }
            }
        }
    }

    if let Some(themes) = obj.get("themes") {
        let themes = themes
            .as_array()
            .ok_or_else(|| "contributes.themes must be an array".to_string())?;
        for theme in themes {
            let theme = theme
                .as_object()
                .ok_or_else(|| "contributes.themes entries must be objects".to_string())?;
            if let Some(path) = theme.get("path") {
                if path.as_str().is_none() {
                    return Err("contributes.themes \"path\" must be a string".to_string());
                }
            }
        }
    }

    Ok(())
}

fn validate_manifest(value: &serde_json::Value) -> Result<ManifestInfo, String> {
    let obj = value
        .as_object()
        .ok_or_else(|| "manifest must be a JSON object".to_string())?;

    let format = obj
        .get("format")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "manifest.format must be a string".to_string())?;
    if format != EXTENSION_FORMAT {
        return Err(format!("manifest.format must be \"{EXTENSION_FORMAT}\""));
    }

    let id = obj
        .get("id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "manifest.id must be a string".to_string())?;
    validate_extension_id(id)?;

    let name = obj
        .get("name")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "manifest.name must be a string".to_string())?;
    if name.is_empty() {
        return Err("manifest.name must not be empty".to_string());
    }

    let version = obj
        .get("version")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "manifest.version must be a string".to_string())?;
    if version.is_empty() {
        return Err("manifest.version must not be empty".to_string());
    }

    let description = obj
        .get("description")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let main = obj
        .get("main")
        .and_then(|v| v.as_str())
        .unwrap_or("main.js");
    if main.is_empty() || main.starts_with('/') || main.starts_with('\\') {
        return Err("manifest.main must be a relative path".to_string());
    }
    confined_join(Path::new(""), main)
        .map_err(|_| "manifest.main must not contain \"..\"".to_string())?;

    if let Some(contributes) = obj.get("contributes") {
        validate_contributes(contributes)?;
    }

    Ok(ManifestInfo {
        id: id.to_string(),
        name: name.to_string(),
        version: version.to_string(),
        description,
    })
}

fn read_manifest(dir: &Path) -> Result<(ManifestInfo, serde_json::Value), String> {
    let manifest_path = dir.join("manifest.json");
    let content = fs::read_to_string(&manifest_path)
        .map_err(|e| format!("Failed to read manifest.json: {e}"))?;
    let value: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse manifest.json: {e}"))?;
    let info = validate_manifest(&value)?;
    Ok((info, value))
}

fn summarize_dir(dir: &Path) -> Option<ExtensionSummary> {
    let dir_name = dir.file_name()?.to_str()?.to_string();
    let path = dir.to_string_lossy().into_owned();

    match read_manifest(dir) {
        Ok((info, manifest)) => Some(ExtensionSummary {
            id: info.id,
            name: info.name,
            version: info.version,
            description: info.description,
            path,
            manifest: Some(manifest),
            error: None,
        }),
        Err(error) => Some(ExtensionSummary {
            id: dir_name.clone(),
            name: dir_name,
            version: String::new(),
            description: None,
            path,
            manifest: None,
            error: Some(error),
        }),
    }
}

fn read_limited_text_file(path: &Path, max_size: u64) -> Result<String, String> {
    let metadata = fs::metadata(path).map_err(|e| format!("Failed to read metadata: {e}"))?;
    if metadata.len() > max_size {
        return Err(format!(
            "File is too large ({} KB). Maximum supported size is {} KB.",
            metadata.len() / 1024,
            max_size / 1024
        ));
    }
    let bytes = fs::read(path).map_err(|e| format!("Failed to read file: {e}"))?;
    if bytes.contains(&0) {
        return Err("Binary files are not supported".to_string());
    }
    String::from_utf8(bytes).map_err(|e| format!("File is not valid UTF-8: {e}"))
}

fn copy_dir_recursive(source: &Path, target: &Path) -> Result<(), String> {
    fs::create_dir_all(target)
        .map_err(|e| format!("Failed to create {}: {e}", target.display()))?;
    let entries =
        fs::read_dir(source).map_err(|e| format!("Failed to read {}: {e}", source.display()))?;
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {e}"))?;
        let file_type = entry
            .file_type()
            .map_err(|e| format!("Failed to read file type: {e}"))?;
        let target_path = target.join(entry.file_name());
        if file_type.is_dir() {
            copy_dir_recursive(&entry.path(), &target_path)?;
        } else if file_type.is_file() {
            fs::copy(entry.path(), &target_path)
                .map_err(|e| format!("Failed to copy {}: {e}", entry.path().display()))?;
        }
    }
    Ok(())
}

// -- Commands ------------------------------------------------------------------

#[tauri::command]
pub fn extension_list(workspace_root: String) -> Result<Vec<ExtensionSummary>, String> {
    let dir = extensions_dir(&workspace_root);
    if !dir.exists() {
        return Ok(Vec::new());
    }
    if !dir.is_dir() {
        return Err(".pragma/extensions is not a directory".to_string());
    }

    let entries =
        fs::read_dir(&dir).map_err(|e| format!("Failed to read extensions directory: {e}"))?;

    let mut summaries = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {e}"))?;
        let is_dir = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);
        if !is_dir {
            continue;
        }
        if let Some(summary) = summarize_dir(&entry.path()) {
            summaries.push(summary);
        }
    }

    summaries.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(summaries)
}

#[tauri::command]
pub fn extension_read_main(workspace_root: String, extension_id: String) -> Result<String, String> {
    let dir = extension_dir(&workspace_root, &extension_id)?;
    let (_, manifest) = read_manifest(&dir)?;
    let main = manifest
        .get("main")
        .and_then(|v| v.as_str())
        .unwrap_or("main.js");
    let main_path = confined_join(&dir, main)?;
    if !main_path.is_file() {
        return Err(format!("Extension entry point not found: {main}"));
    }
    read_limited_text_file(&main_path, MAX_MAIN_SIZE_BYTES)
}

#[tauri::command]
pub fn extension_read_asset(
    workspace_root: String,
    extension_id: String,
    asset_path: String,
) -> Result<String, String> {
    let dir = extension_dir(&workspace_root, &extension_id)?;
    let path = confined_join(&dir, &asset_path)?;
    if !path.is_file() {
        return Err(format!("Asset not found: {asset_path}"));
    }
    read_limited_text_file(&path, MAX_ASSET_SIZE_BYTES)
}

#[tauri::command]
pub fn extension_install_from_path(
    workspace_root: String,
    source_path: String,
) -> Result<ExtensionSummary, String> {
    let source = Path::new(&source_path);
    if !source.is_absolute() {
        return Err("Source path must be absolute".to_string());
    }
    if !source.is_dir() {
        return Err(format!("Not a directory: {source_path}"));
    }

    let (info, _) = read_manifest(source)?;
    let target = extension_dir(&workspace_root, &info.id)?;

    let canonical_source = source
        .canonicalize()
        .map_err(|e| format!("Failed to resolve source path: {e}"))?;
    let canonical_target_parent = extensions_dir(&workspace_root)
        .canonicalize()
        .unwrap_or_else(|_| extensions_dir(&workspace_root));
    if canonical_source.starts_with(&canonical_target_parent) {
        return Err("Source is already inside the extensions directory".to_string());
    }

    if target.exists() {
        fs::remove_dir_all(&target)
            .map_err(|e| format!("Failed to replace existing extension: {e}"))?;
    }
    copy_dir_recursive(&canonical_source, &target)?;

    summarize_dir(&target).ok_or_else(|| "Failed to read installed extension".to_string())
}

#[tauri::command]
pub fn extension_remove(workspace_root: String, extension_id: String) -> Result<(), String> {
    let dir = extension_dir(&workspace_root, &extension_id)?;
    if !dir.exists() {
        return Err(format!("Extension not found: {extension_id}"));
    }
    fs::remove_dir_all(&dir).map_err(|e| format!("Failed to remove extension: {e}"))
}

#[tauri::command]
pub fn extension_open_folder(
    workspace_root: String,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let dir = extensions_dir(&workspace_root);
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| format!("Failed to create extensions folder: {e}"))?;
    }

    use tauri_plugin_opener::OpenerExt;
    app_handle
        .opener()
        .open_path(dir.to_string_lossy().as_ref(), None::<&str>)
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extension_id_accepts_simple_ids() {
        assert!(validate_extension_id("hello-world").is_ok());
        assert!(validate_extension_id("ext2").is_ok());
    }

    #[test]
    fn extension_id_rejects_traversal_and_separators() {
        assert!(validate_extension_id("..").is_err());
        assert!(validate_extension_id("a/b").is_err());
        assert!(validate_extension_id("a\\b").is_err());
        assert!(validate_extension_id("").is_err());
        assert!(validate_extension_id("Upper").is_err());
    }

    #[test]
    fn confined_join_allows_nested_relative_paths() {
        let base = Path::new("/ext");
        let joined = confined_join(base, "assets/panel.html").unwrap();
        assert_eq!(joined, base.join("assets").join("panel.html"));
    }

    #[test]
    fn confined_join_rejects_escapes() {
        let base = Path::new("/ext");
        assert!(confined_join(base, "../secret").is_err());
        assert!(confined_join(base, "a/../../secret").is_err());
        assert!(confined_join(base, "/absolute").is_err());
    }

    #[test]
    fn manifest_valid_minimal() {
        let value = serde_json::json!({
            "format": "pragma-extension-v1",
            "id": "hello-world",
            "name": "Hello World",
            "version": "0.1.0"
        });
        let info = validate_manifest(&value).unwrap();
        assert_eq!(info.id, "hello-world");
        assert_eq!(info.name, "Hello World");
    }

    #[test]
    fn manifest_rejects_wrong_format() {
        let value = serde_json::json!({
            "format": "something-else",
            "id": "hello-world",
            "name": "Hello World",
            "version": "0.1.0"
        });
        assert!(validate_manifest(&value).is_err());
    }

    #[test]
    fn manifest_rejects_traversing_main() {
        let value = serde_json::json!({
            "format": "pragma-extension-v1",
            "id": "hello-world",
            "name": "Hello World",
            "version": "0.1.0",
            "main": "../escape.js"
        });
        assert!(validate_manifest(&value).is_err());
    }

    #[test]
    fn manifest_rejects_invalid_contributes() {
        let value = serde_json::json!({
            "format": "pragma-extension-v1",
            "id": "hello-world",
            "name": "Hello World",
            "version": "0.1.0",
            "contributes": { "commands": [{ "id": "no-title" }] }
        });
        assert!(validate_manifest(&value).is_err());
    }

    #[test]
    fn manifest_accepts_full_contributes() {
        let value = serde_json::json!({
            "format": "pragma-extension-v1",
            "id": "hello-world",
            "name": "Hello World",
            "version": "0.1.0",
            "contributes": {
                "commands": [{ "id": "hello", "title": "Say Hello", "category": "Greetings" }],
                "panels": [{ "id": "panel", "title": "My Panel", "html": "<p>hi</p>" }],
                "themes": [{ "path": "theme.json" }]
            }
        });
        assert!(validate_manifest(&value).is_ok());
    }
}
