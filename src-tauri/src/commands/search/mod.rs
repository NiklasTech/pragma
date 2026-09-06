mod find;
mod replace;

pub use find::*;
pub use replace::*;

use regex::{Regex, RegexBuilder};
use std::path::{Path, PathBuf};

const MAX_FILE_SIZE_BYTES: u64 = 1024 * 1024;

fn validate_workspace_root(workspace_root: &str) -> Result<PathBuf, String> {
    if workspace_root.is_empty() {
        return Err("workspace_root is required".to_string());
    }
    let path = Path::new(workspace_root);
    if !path.is_dir() {
        return Err(format!("Workspace root does not exist: {workspace_root}"));
    }
    path.canonicalize()
        .map_err(|e| format!("Failed to resolve workspace root: {e}"))
}

fn validate_query(query: &str) -> Result<String, String> {
    let trimmed = query.trim();
    if trimmed.is_empty() {
        return Err("query is required".to_string());
    }
    Ok(trimmed.to_string())
}

fn build_matcher(
    query: &str,
    case_sensitive: bool,
    whole_word: bool,
    use_regex: bool,
) -> Result<Regex, String> {
    let mut pattern = if use_regex {
        query.to_string()
    } else {
        regex::escape(query)
    };
    if whole_word {
        pattern = format!(r"\b(?:{})\b", pattern);
    }
    RegexBuilder::new(&pattern)
        .case_insensitive(!case_sensitive)
        .build()
        .map_err(|e| format!("Invalid search pattern: {e}"))
}

fn build_gitignore(root: &Path, globs: &[String]) -> Result<ignore::gitignore::Gitignore, String> {
    let mut builder = ignore::gitignore::GitignoreBuilder::new(root);
    for glob in globs {
        let trimmed = glob.trim();
        if trimmed.is_empty() {
            continue;
        }
        builder
            .add_line(None, trimmed)
            .map_err(|e| format!("Invalid glob '{trimmed}': {e}"))?;
    }
    Ok(builder
        .build()
        .unwrap_or_else(|_| ignore::gitignore::Gitignore::empty()))
}

fn matches_globs(
    rel_path: &Path,
    include_globs: &ignore::gitignore::Gitignore,
    exclude_globs: &ignore::gitignore::Gitignore,
) -> bool {
    if exclude_globs.matched(rel_path, false).is_ignore() {
        return false;
    }
    if include_globs.is_empty() {
        return true;
    }
    include_globs.matched(rel_path, false).is_ignore()
}

fn is_within_workspace(workspace_root: &Path, file: &Path) -> bool {
    let Ok(file) = file.canonicalize() else {
        return false;
    };
    file.starts_with(workspace_root)
}
