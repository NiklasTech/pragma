use super::validate_workspace_root;
use serde::Serialize;
use std::path::Path;

const MAX_FILES: usize = 100_000;
const SKIPPED_DIRS: &[&str] = &["node_modules", "target"];

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceFiles {
    /// Paths relative to the workspace root, with `/` as separator.
    pub files: Vec<String>,
    pub truncated: bool,
}

/// Lists the files of a workspace for quick open, honoring `.gitignore` and skipping hidden entries.
#[tauri::command(async)]
pub fn list_workspace_files(workspace_root: String) -> Result<WorkspaceFiles, String> {
    let root = validate_workspace_root(&workspace_root)?;
    Ok(collect_files(&root, MAX_FILES))
}

fn collect_files(root: &Path, limit: usize) -> WorkspaceFiles {
    let mut builder = ignore::WalkBuilder::new(root);
    builder
        .hidden(true)
        .git_ignore(true)
        .git_global(true)
        .git_exclude(true)
        .ignore(true)
        .require_git(false)
        .filter_entry(|entry| {
            let is_dir = entry.file_type().is_some_and(|ft| ft.is_dir());
            !(is_dir && SKIPPED_DIRS.iter().any(|name| entry.file_name() == *name))
        });

    let mut files = Vec::new();
    let mut truncated = false;
    // Unreadable entries are skipped so one folder without permission does not hide the rest.
    for entry in builder.build().flatten() {
        if !entry.file_type().is_some_and(|ft| ft.is_file()) {
            continue;
        }
        let Ok(relative) = entry.path().strip_prefix(root) else {
            continue;
        };
        if files.len() >= limit {
            truncated = true;
            break;
        }
        files.push(relative.to_string_lossy().replace('\\', "/"));
    }
    WorkspaceFiles { files, truncated }
}

#[cfg(test)]
mod tests {
    use super::collect_files;
    use std::fs;

    #[test]
    fn lists_files_relative_to_the_root_and_honors_gitignore() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        fs::create_dir_all(root.join("src/nested")).unwrap();
        fs::write(root.join("src/nested/lib.rs"), "").unwrap();
        fs::write(root.join("README.md"), "").unwrap();
        fs::write(root.join(".gitignore"), "dist/\n*.log\n").unwrap();
        fs::create_dir(root.join("dist")).unwrap();
        fs::write(root.join("dist/bundle.js"), "").unwrap();
        fs::write(root.join("debug.log"), "").unwrap();
        for skipped in ["node_modules", "target", ".git"] {
            fs::create_dir(root.join(skipped)).unwrap();
            fs::write(root.join(skipped).join("file"), "").unwrap();
        }

        let mut result = collect_files(root, 100);
        result.files.sort();

        assert_eq!(result.files, vec!["README.md", "src/nested/lib.rs"]);
        assert!(!result.truncated);
    }

    #[test]
    fn stops_at_the_limit() {
        let dir = tempfile::tempdir().unwrap();
        for index in 0..5 {
            fs::write(dir.path().join(format!("{index}.txt")), "").unwrap();
        }

        let result = collect_files(dir.path(), 3);

        assert_eq!(result.files.len(), 3);
        assert!(result.truncated);
    }
}
