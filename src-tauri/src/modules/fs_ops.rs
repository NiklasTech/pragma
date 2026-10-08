use std::fs;
use std::path::{Path, PathBuf};

use super::fs::validate_path;

const MAX_COPY_SUFFIX: u32 = 1000;

/// `name copy.ext`, then `name copy 2.ext` and so on, next to the source.
fn duplicate_target(source: &Path) -> Result<PathBuf, String> {
    let parent = source
        .parent()
        .ok_or_else(|| "Cannot duplicate a root path".to_string())?;
    let name = source
        .file_name()
        .map(|s| s.to_string_lossy().into_owned())
        .ok_or_else(|| "Path has no name".to_string())?;
    let extension = if source.is_dir() {
        None
    } else {
        source.extension().map(|e| e.to_string_lossy().into_owned())
    };
    let stem = match &extension {
        Some(ext) => name[..name.len() - ext.len() - 1].to_string(),
        None => name,
    };

    for index in 1..=MAX_COPY_SUFFIX {
        let suffix = if index == 1 {
            " copy".to_string()
        } else {
            format!(" copy {}", index)
        };
        let name = match &extension {
            Some(ext) => format!("{}{}.{}", stem, suffix, ext),
            None => format!("{}{}", stem, suffix),
        };
        let candidate = parent.join(name);
        if !candidate.exists() {
            return Ok(candidate);
        }
    }
    Err("No free name for the copy".to_string())
}

/// Symlinked directories are skipped so a link cycle cannot recurse forever.
fn copy_recursive(source: &Path, target: &Path) -> Result<(), String> {
    fs::create_dir(target).map_err(|e| format!("Failed to create directory: {}", e))?;
    let entries = fs::read_dir(source).map_err(|e| format!("Failed to read directory: {}", e))?;
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let file_type = entry
            .file_type()
            .map_err(|e| format!("Failed to read entry type: {}", e))?;
        let from = entry.path();
        let to = target.join(entry.file_name());
        if file_type.is_dir() {
            copy_recursive(&from, &to)?;
        } else if from.is_file() {
            fs::copy(&from, &to).map_err(|e| format!("Failed to copy file: {}", e))?;
        }
    }
    Ok(())
}

#[tauri::command(async)]
pub fn duplicate_path(path: String) -> Result<String, String> {
    let source = validate_path(&path)?;
    if !source.exists() {
        return Err(format!("Not found: {}", path));
    }

    let target = duplicate_target(source)?;
    if source.is_dir() {
        copy_recursive(source, &target)?;
    } else {
        fs::copy(source, &target).map_err(|e| format!("Failed to copy file: {}", e))?;
    }
    Ok(target.to_string_lossy().into_owned())
}

#[tauri::command(async)]
pub fn reveal_in_file_manager(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let target = validate_path(&path)?;
    if !target.exists() {
        return Err(format!("Not found: {}", path));
    }

    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .reveal_item_in_dir(target)
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn path_string(path: &Path) -> String {
        path.to_string_lossy().into_owned()
    }

    #[test]
    fn duplicate_path_copies_files_with_a_free_name() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("main.rs");
        fs::write(&file, "fn main() {}").unwrap();

        let first = duplicate_path(path_string(&file)).unwrap();
        let second = duplicate_path(path_string(&file)).unwrap();

        assert_eq!(first, path_string(&dir.path().join("main copy.rs")));
        assert_eq!(second, path_string(&dir.path().join("main copy 2.rs")));
        assert_eq!(fs::read_to_string(&first).unwrap(), "fn main() {}");
    }

    #[test]
    fn duplicate_path_keeps_dotfile_and_directory_names_whole() {
        let dir = tempfile::tempdir().unwrap();
        let dotfile = dir.path().join(".env");
        let folder = dir.path().join("pkg.v1");
        fs::write(&dotfile, "A=1").unwrap();
        fs::create_dir_all(folder.join("nested")).unwrap();
        fs::write(folder.join("nested/inner.txt"), "inner").unwrap();

        let dotfile_copy = duplicate_path(path_string(&dotfile)).unwrap();
        let folder_copy = duplicate_path(path_string(&folder)).unwrap();

        assert_eq!(dotfile_copy, path_string(&dir.path().join(".env copy")));
        assert_eq!(folder_copy, path_string(&dir.path().join("pkg.v1 copy")));
        assert_eq!(
            fs::read_to_string(dir.path().join("pkg.v1 copy/nested/inner.txt")).unwrap(),
            "inner"
        );
    }

    #[test]
    fn duplicate_path_rejects_missing_and_relative_paths() {
        let dir = tempfile::tempdir().unwrap();
        assert!(duplicate_path(path_string(&dir.path().join("missing")))
            .err()
            .unwrap()
            .starts_with("Not found"));
        assert!(duplicate_path("relative.txt".to_string()).is_err());
    }
}
