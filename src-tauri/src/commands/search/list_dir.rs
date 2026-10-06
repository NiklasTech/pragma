use super::glob::resolve_glob_path;
use super::validate_workspace_root;
use serde::{Deserialize, Serialize};

const MAX_ENTRIES: usize = 1000;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListWorkspaceDirRequest {
    pub workspace_root: String,
    #[serde(default)]
    pub path: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceDirEntry {
    pub name: String,
    pub is_directory: bool,
    pub size: Option<u64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListWorkspaceDirResult {
    pub path: String,
    pub entries: Vec<WorkspaceDirEntry>,
    pub truncated: bool,
}

#[tauri::command(async)]
pub fn list_workspace_dir(req: ListWorkspaceDirRequest) -> Result<ListWorkspaceDirResult, String> {
    let workspace_root = validate_workspace_root(&req.workspace_root)?;
    let dir = match req.path.as_deref() {
        Some(raw) if !raw.trim().is_empty() => resolve_glob_path(&workspace_root, raw)?,
        _ => workspace_root,
    };

    let mut builder = ignore::WalkBuilder::new(&dir);
    builder
        .max_depth(Some(1))
        .hidden(false)
        .git_ignore(true)
        .git_global(true)
        .git_exclude(true)
        .ignore(true)
        .require_git(false)
        .filter_entry(|entry| entry.file_name() != ".git");

    let mut entries = Vec::new();
    let mut truncated = false;
    for entry in builder.build() {
        let Ok(entry) = entry else { continue };
        if entry.depth() == 0 {
            continue;
        }
        if entries.len() >= MAX_ENTRIES {
            truncated = true;
            break;
        }
        let path = entry.path();
        let is_directory = path.is_dir();
        let size = if is_directory {
            None
        } else {
            path.metadata().ok().map(|m| m.len())
        };
        entries.push(WorkspaceDirEntry {
            name: entry.file_name().to_string_lossy().to_string(),
            is_directory,
            size,
        });
    }

    entries.sort_by(|a, b| {
        b.is_directory
            .cmp(&a.is_directory)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(ListWorkspaceDirResult {
        path: dir.to_string_lossy().to_string(),
        entries,
        truncated,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::Path;
    use tempfile::tempdir;

    fn write_file(root: &Path, relative: &str, content: &str) {
        let path = root.join(relative);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        fs::write(path, content).unwrap();
    }

    fn request(root: &Path, path: Option<&str>) -> ListWorkspaceDirRequest {
        ListWorkspaceDirRequest {
            workspace_root: root.to_string_lossy().to_string(),
            path: path.map(str::to_string),
        }
    }

    #[test]
    fn lists_one_level_with_directories_first_and_file_sizes() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        write_file(root, "b.txt", "hello");
        write_file(root, "A.md", "");
        write_file(root, "src/main.rs", "fn main() {}");

        let result = list_workspace_dir(request(root, None)).unwrap();
        let names: Vec<&str> = result.entries.iter().map(|e| e.name.as_str()).collect();

        assert_eq!(names, vec!["src", "A.md", "b.txt"]);
        assert!(result.entries[0].is_directory);
        assert_eq!(result.entries[0].size, None);
        assert_eq!(result.entries[2].size, Some(5));
        assert!(!result.truncated);
    }

    #[test]
    fn skips_gitignored_entries_and_the_git_directory() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        write_file(root, ".gitignore", "target/\n*.log\n");
        write_file(root, ".git/HEAD", "ref: refs/heads/main");
        write_file(root, "target/out.bin", "");
        write_file(root, "debug.log", "");
        write_file(root, ".env.example", "");
        write_file(root, "Cargo.toml", "");

        let result = list_workspace_dir(request(root, None)).unwrap();
        let names: Vec<&str> = result.entries.iter().map(|e| e.name.as_str()).collect();

        assert_eq!(names, vec![".env.example", ".gitignore", "Cargo.toml"]);
    }

    #[test]
    fn lists_a_relative_subdirectory_with_root_ignore_rules() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        write_file(root, ".gitignore", "*.tmp\n");
        write_file(root, "src/lib.rs", "");
        write_file(root, "src/scratch.tmp", "");

        let result = list_workspace_dir(request(root, Some("src"))).unwrap();
        let names: Vec<&str> = result.entries.iter().map(|e| e.name.as_str()).collect();

        assert_eq!(names, vec!["lib.rs"]);
    }

    #[test]
    fn rejects_a_directory_outside_the_workspace() {
        let dir = tempdir().unwrap();
        let root = dir.path().join("workspace");
        fs::create_dir_all(&root).unwrap();
        let outside = dir.path().to_string_lossy().to_string();

        assert!(list_workspace_dir(request(&root, Some(&outside))).is_err());
    }

    #[test]
    fn rejects_a_file_path() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        write_file(root, "a.txt", "");

        assert!(list_workspace_dir(request(root, Some("a.txt"))).is_err());
    }
}
