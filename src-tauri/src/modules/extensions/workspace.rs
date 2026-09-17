use std::fs;
use std::path::{Component, Path, PathBuf};

use crate::modules::fs::{self as fs_commands, DirEntry, FileReadResult};

fn deepest_existing(path: &Path) -> Result<PathBuf, String> {
    let mut current = path.to_path_buf();
    loop {
        if fs::symlink_metadata(&current).is_ok() {
            return Ok(current);
        }
        match current.parent() {
            Some(parent) => current = parent.to_path_buf(),
            None => return Err("Path escapes the workspace root".to_string()),
        }
    }
}

pub(crate) fn resolve_workspace_path(
    workspace_root: &str,
    relative: &str,
) -> Result<PathBuf, String> {
    let root = Path::new(workspace_root);
    if !root.is_absolute() {
        return Err("Workspace root must be absolute".to_string());
    }
    let root_real =
        fs::canonicalize(root).map_err(|e| format!("Failed to resolve workspace root: {e}"))?;

    let rel = Path::new(relative);
    if rel.is_absolute() {
        return Err("Path must be relative to the workspace root".to_string());
    }

    let mut candidate = root_real.clone();
    for component in rel.components() {
        match component {
            Component::Normal(part) => candidate.push(part),
            Component::CurDir => {}
            _ => return Err("Path escapes the workspace root".to_string()),
        }
    }

    let existing = deepest_existing(&candidate)?;
    let existing_real =
        fs::canonicalize(&existing).map_err(|e| format!("Failed to resolve path: {e}"))?;
    if !existing_real.starts_with(&root_real) {
        return Err("Path escapes the workspace root".to_string());
    }

    Ok(candidate)
}

#[tauri::command]
pub fn extension_workspace_read_file(
    workspace_root: String,
    path: String,
) -> Result<FileReadResult, String> {
    let resolved = resolve_workspace_path(&workspace_root, &path)?;
    fs_commands::read_text_file(resolved.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn extension_workspace_write_file(
    app: tauri::AppHandle,
    workspace_root: String,
    path: String,
    content: String,
) -> Result<(), String> {
    let resolved = resolve_workspace_path(&workspace_root, &path)?;
    fs_commands::write_text_file(app, resolved.to_string_lossy().into_owned(), content)
}

#[tauri::command]
pub fn extension_workspace_list(
    workspace_root: String,
    path: String,
) -> Result<Vec<DirEntry>, String> {
    let resolved = resolve_workspace_path(&workspace_root, &path)?;
    fs_commands::list_directory(resolved.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn canonical_root(root: &Path) -> PathBuf {
        fs::canonicalize(root).unwrap()
    }

    #[test]
    fn accepts_paths_inside_the_workspace_root() {
        let temp = tempfile::tempdir().unwrap();
        fs::write(temp.path().join("notes.txt"), "hello").unwrap();
        fs::create_dir(temp.path().join("src")).unwrap();

        let root = temp.path().to_string_lossy().into_owned();
        let expected = canonical_root(temp.path()).join("notes.txt");
        assert_eq!(
            resolve_workspace_path(&root, "notes.txt").unwrap(),
            expected
        );
        assert_eq!(
            resolve_workspace_path(&root, "./notes.txt").unwrap(),
            expected
        );
        assert!(resolve_workspace_path(&root, "src").unwrap().is_dir());
        assert_eq!(
            resolve_workspace_path(&root, ".").unwrap(),
            canonical_root(temp.path())
        );
    }

    #[test]
    fn accepts_new_files_inside_the_workspace_root() {
        let temp = tempfile::tempdir().unwrap();
        fs::create_dir(temp.path().join("src")).unwrap();
        let root = temp.path().to_string_lossy().into_owned();

        let resolved = resolve_workspace_path(&root, "src/new.txt").unwrap();
        assert_eq!(
            resolved,
            canonical_root(temp.path()).join("src").join("new.txt")
        );
        assert!(!resolved.exists());
    }

    #[test]
    fn accepts_reads_through_the_fs_commands() {
        let temp = tempfile::tempdir().unwrap();
        fs::write(temp.path().join("read.txt"), "content").unwrap();
        let root = temp.path().to_string_lossy().into_owned();

        let resolved = resolve_workspace_path(&root, "read.txt").unwrap();
        let result = fs_commands::read_text_file(resolved.to_string_lossy().into_owned()).unwrap();
        assert_eq!(result.content, "content");
        assert_eq!(result.name, "read.txt");
    }

    #[test]
    fn rejects_parent_traversal() {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().to_string_lossy().into_owned();

        assert!(resolve_workspace_path(&root, "../secret.txt").is_err());
        assert!(resolve_workspace_path(&root, "src/../../secret.txt").is_err());
    }

    #[test]
    fn rejects_absolute_paths() {
        let temp = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        let root = temp.path().to_string_lossy().into_owned();
        let absolute = outside.path().join("secret.txt");

        assert!(resolve_workspace_path(&root, &absolute.to_string_lossy()).is_err());
    }

    #[test]
    fn rejects_relative_workspace_roots() {
        assert!(resolve_workspace_path("relative/root", "a.txt").is_err());
    }

    #[cfg(unix)]
    #[test]
    fn rejects_symlink_escapes() {
        let temp = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        fs::write(outside.path().join("secret.txt"), "secret").unwrap();
        std::os::unix::fs::symlink(outside.path(), temp.path().join("escape")).unwrap();
        std::os::unix::fs::symlink(
            outside.path().join("missing.txt"),
            temp.path().join("broken"),
        )
        .unwrap();

        let root = temp.path().to_string_lossy().into_owned();
        assert!(resolve_workspace_path(&root, "escape/secret.txt").is_err());
        assert!(resolve_workspace_path(&root, "escape").is_err());
        assert!(resolve_workspace_path(&root, "broken").is_err());
    }
}
