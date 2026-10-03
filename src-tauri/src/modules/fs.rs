use serde::Serialize;
use sha2::{Digest, Sha256};
use std::fs;
use std::io::{self, Write};
use std::path::{Component, Path};
use std::sync::atomic::{AtomicU64, Ordering};

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

#[tauri::command(async)]
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

/// Returned when `expected_hash` no longer matches the file on disk; the frontend matches on it.
pub const CHANGED_ON_DISK_ERROR: &str = "File changed on disk since it was loaded";

static TEMP_FILE_COUNTER: AtomicU64 = AtomicU64::new(0);

#[tauri::command(async)]
pub fn write_text_file(
    app: tauri::AppHandle,
    path: String,
    content: String,
    expected_hash: Option<String>,
) -> Result<(), String> {
    let path_ref = validate_path(&path)?;

    if path_ref.exists() && !path_ref.is_file() {
        return Err(format!("Not a file: {}", path));
    }

    if let Some(expected) = expected_hash.as_deref() {
        ensure_unchanged_on_disk(path_ref, expected)?;
    }

    write_atomic(path_ref, content.as_bytes())?;

    let repo_path = path_ref
        .parent()
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_default();
    local_history::queue::queue_snapshot(app, repo_path, path, content);

    Ok(())
}

fn content_hash(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    format!("{:x}", hasher.finalize())
}

fn ensure_unchanged_on_disk(path: &Path, expected_hash: &str) -> Result<(), String> {
    let bytes = match fs::read(path) {
        Ok(bytes) => bytes,
        Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(()),
        Err(e) => return Err(format!("Failed to read file: {}", e)),
    };

    if content_hash(&bytes) == expected_hash {
        Ok(())
    } else {
        Err(CHANGED_ON_DISK_ERROR.to_string())
    }
}

/// Writes to a temp file next to the target and renames it over the target,
/// so a crash or full disk never leaves a truncated file behind.
fn write_atomic(path: &Path, content: &[u8]) -> Result<(), String> {
    // Resolve symlinks so the rename replaces the link target, not the link.
    let target = fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
    let file_name = target
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| format!("Invalid file path: {}", target.display()))?;
    let nonce = TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed);
    let temp_path =
        target.with_file_name(format!(".{file_name}.{}.{nonce}.tmp", std::process::id()));
    let permissions = fs::metadata(&target).ok().map(|m| m.permissions());

    if let Err(e) = write_temp_file(&temp_path, content, permissions) {
        let _ = fs::remove_file(&temp_path);
        return Err(format!("Failed to write file: {}", e));
    }

    if let Err(e) = fs::rename(&temp_path, &target) {
        let _ = fs::remove_file(&temp_path);
        // Windows refuses to replace a file that another process holds open.
        if cfg!(windows) && target.is_file() {
            log::warn!(
                "atomic replace of {} failed ({e}), writing in place",
                target.display()
            );
            return fs::write(&target, content).map_err(|e| format!("Failed to write file: {}", e));
        }
        return Err(format!("Failed to write file: {}", e));
    }

    Ok(())
}

fn write_temp_file(
    path: &Path,
    content: &[u8],
    permissions: Option<fs::Permissions>,
) -> io::Result<()> {
    let mut file = fs::File::create(path)?;
    file.write_all(content)?;
    file.sync_all()?;
    if let Some(permissions) = permissions {
        fs::set_permissions(path, permissions)?;
    }
    Ok(())
}

#[tauri::command(async)]
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

#[tauri::command(async)]
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

#[tauri::command(async)]
pub fn create_file(path: String) -> Result<(), String> {
    let path_ref = validate_path(&path)?;

    if path_ref.exists() {
        return Err(format!("Already exists: {}", path));
    }

    fs::write(path_ref, "").map_err(|e| format!("Failed to create file: {}", e))
}

#[tauri::command(async)]
pub fn create_directory(path: String) -> Result<(), String> {
    let path_ref = validate_path(&path)?;

    if path_ref.exists() {
        return Err(format!("Already exists: {}", path));
    }

    fs::create_dir_all(path_ref).map_err(|e| format!("Failed to create directory: {}", e))
}

#[tauri::command(async)]
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

#[tauri::command(async)]
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn write_atomic_replaces_content_and_leaves_no_temp_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("file.txt");
        fs::write(&path, "old content").unwrap();

        write_atomic(&path, b"new").unwrap();

        assert_eq!(fs::read_to_string(&path).unwrap(), "new");
        assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 1);
    }

    #[test]
    fn write_atomic_creates_missing_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("new.txt");

        write_atomic(&path, b"hello").unwrap();

        assert_eq!(fs::read_to_string(&path).unwrap(), "hello");
    }

    #[cfg(unix)]
    #[test]
    fn write_atomic_keeps_permissions() {
        use std::os::unix::fs::PermissionsExt;

        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("script.sh");
        fs::write(&path, "echo old").unwrap();
        fs::set_permissions(&path, fs::Permissions::from_mode(0o755)).unwrap();

        write_atomic(&path, b"echo new").unwrap();

        let mode = fs::metadata(&path).unwrap().permissions().mode() & 0o777;
        assert_eq!(mode, 0o755);
    }

    #[cfg(unix)]
    #[test]
    fn write_atomic_writes_through_symlinks() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("target.txt");
        let link = dir.path().join("link.txt");
        fs::write(&target, "old").unwrap();
        std::os::unix::fs::symlink(&target, &link).unwrap();

        write_atomic(&link, b"new").unwrap();

        assert!(fs::symlink_metadata(&link)
            .unwrap()
            .file_type()
            .is_symlink());
        assert_eq!(fs::read_to_string(&target).unwrap(), "new");
    }

    #[test]
    fn unchanged_check_accepts_matching_hash() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("file.txt");
        fs::write(&path, "content").unwrap();

        assert!(ensure_unchanged_on_disk(&path, &content_hash(b"content")).is_ok());
    }

    #[test]
    fn unchanged_check_rejects_external_change() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("file.txt");
        fs::write(&path, "changed by an agent").unwrap();

        assert_eq!(
            ensure_unchanged_on_disk(&path, &content_hash(b"content")),
            Err(CHANGED_ON_DISK_ERROR.to_string())
        );
    }

    #[test]
    fn unchanged_check_allows_missing_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("deleted.txt");

        assert!(ensure_unchanged_on_disk(&path, &content_hash(b"content")).is_ok());
    }
}
