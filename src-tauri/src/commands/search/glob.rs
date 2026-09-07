use super::{build_gitignore, matches_globs, validate_workspace_root};
use serde::Deserialize;
use std::path::{Path, PathBuf};

const MAX_RESULTS: usize = 500;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GlobWorkspaceRequest {
    pub workspace_root: String,
    pub pattern: String,
    #[serde(default)]
    pub path: Option<String>,
}

#[tauri::command]
pub fn glob_workspace(req: GlobWorkspaceRequest) -> Result<Vec<String>, String> {
    let workspace_root = validate_workspace_root(&req.workspace_root)?;
    let pattern = req.pattern.trim();
    if pattern.is_empty() {
        return Err("pattern is required".to_string());
    }
    let include = build_gitignore(&workspace_root, &[pattern.to_string()])?;
    let exclude = build_gitignore(&workspace_root, &[])?;

    let search_root = match req.path.as_deref() {
        Some(raw) if !raw.trim().is_empty() => resolve_glob_path(&workspace_root, raw)?,
        _ => workspace_root.clone(),
    };

    let mut results = Vec::new();

    let mut builder = ignore::WalkBuilder::new(&search_root);
    builder.git_ignore(true);
    builder.git_global(true);
    builder.git_exclude(true);
    builder.ignore(true);
    builder.hidden(false);

    for entry in builder.build() {
        if results.len() >= MAX_RESULTS {
            break;
        }
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        if !entry.file_type().is_some_and(|ft| ft.is_file()) {
            continue;
        }
        let path = entry.path();
        let rel_path = match path.strip_prefix(&workspace_root) {
            Ok(p) => p,
            Err(_) => continue,
        };
        if !matches_globs(rel_path, &include, &exclude) {
            continue;
        }
        results.push(path.to_string_lossy().to_string());
    }

    Ok(results)
}

fn resolve_glob_path(workspace_root: &Path, raw: &str) -> Result<PathBuf, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err("path is required".to_string());
    }
    let path = Path::new(trimmed);
    let candidate = if path.is_absolute() {
        path.to_path_buf()
    } else {
        workspace_root.join(path)
    };
    let canonical = candidate
        .canonicalize()
        .map_err(|e| format!("path does not exist: {trimmed}: {e}"))?;
    if !canonical.starts_with(workspace_root) {
        return Err(format!("path is outside the workspace: {trimmed}"));
    }
    if !canonical.is_dir() {
        return Err(format!("path is not a directory: {trimmed}"));
    }
    Ok(canonical)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    fn write_file(root: &Path, relative: &str, content: &str) {
        let path = root.join(relative);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        fs::write(path, content).unwrap();
    }

    fn sorted(result: Vec<String>) -> Vec<String> {
        let mut result = result;
        result.sort();
        result
    }

    fn request(root: &str, pattern: &str) -> GlobWorkspaceRequest {
        GlobWorkspaceRequest {
            workspace_root: root.to_string(),
            pattern: pattern.to_string(),
            path: None,
        }
    }

    #[test]
    fn finds_files_matching_a_glob_pattern() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        write_file(root, "a.txt", "");
        write_file(root, "b.rs", "");
        write_file(root, "sub/c.txt", "");
        write_file(root, "sub/d.rs", "");

        let result = glob_workspace(request(&root.to_string_lossy(), "**/*.rs")).unwrap();

        assert_eq!(result.len(), 2);
        assert!(result.iter().any(|p| p.ends_with("b.rs")));
        assert!(result.iter().any(|p| p.ends_with("d.rs")));
    }

    #[test]
    fn matches_basenames_at_any_depth() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        write_file(root, "a.txt", "");
        write_file(root, "b.rs", "");
        write_file(root, "sub/c.txt", "");

        let result = glob_workspace(request(&root.to_string_lossy(), "*.txt")).unwrap();

        assert_eq!(sorted(result).len(), 2);
    }

    #[test]
    fn scopes_search_to_a_subdirectory() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        write_file(root, "b.rs", "");
        write_file(root, "sub/d.rs", "");

        let mut req = request(&root.to_string_lossy(), "**/*.rs");
        req.path = Some(root.join("sub").to_string_lossy().to_string());

        let result = glob_workspace(req).unwrap();

        assert_eq!(result.len(), 1);
        assert!(result[0].ends_with("d.rs"));
    }

    #[test]
    fn scopes_search_to_a_relative_subdirectory() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        write_file(root, "b.rs", "");
        write_file(root, "sub/d.rs", "");

        let mut req = request(&root.to_string_lossy(), "**/*.rs");
        req.path = Some("sub".to_string());

        let result = glob_workspace(req).unwrap();

        assert_eq!(result.len(), 1);
        assert!(result[0].ends_with("d.rs"));
    }

    #[test]
    fn rejects_an_empty_pattern() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        write_file(root, "a.txt", "");

        assert!(glob_workspace(request(&root.to_string_lossy(), "")).is_err());
    }

    #[test]
    fn rejects_a_path_outside_the_workspace() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        write_file(root, "a.txt", "");
        let outside = root.parent().unwrap().to_path_buf();

        let mut req = request(&root.to_string_lossy(), "**/*.txt");
        req.path = Some(outside.to_string_lossy().to_string());

        assert!(glob_workspace(req).is_err());
    }
}
