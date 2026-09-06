use super::{
    build_gitignore, build_matcher, is_within_workspace, matches_globs, validate_query,
    validate_workspace_root, MAX_FILE_SIZE_BYTES,
};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::path::Path;

const MAX_MATCHES_PER_FILE: usize = 100;
const MAX_TOTAL_MATCHES: usize = 1000;
const PREVIEW_RADIUS: usize = 80;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchWorkspaceRequest {
    pub workspace_root: String,
    pub query: String,
    pub case_sensitive: bool,
    pub whole_word: bool,
    pub use_regex: bool,
    pub include_globs: Vec<String>,
    pub exclude_globs: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchMatch {
    pub path: String,
    pub line: usize,
    pub column: usize,
    pub preview: String,
    pub match_text: String,
}

#[tauri::command]
pub fn search_workspace(req: SearchWorkspaceRequest) -> Result<Vec<SearchMatch>, String> {
    let workspace_root = validate_workspace_root(&req.workspace_root)?;
    let query = validate_query(&req.query)?;
    let matcher = build_matcher(&query, req.case_sensitive, req.whole_word, req.use_regex)?;
    let include_globs = build_gitignore(&workspace_root, &req.include_globs)?;
    let exclude_globs = build_gitignore(&workspace_root, &req.exclude_globs)?;

    let mut matches = Vec::new();

    let mut builder = ignore::WalkBuilder::new(&workspace_root);
    builder.git_ignore(true);
    builder.git_global(true);
    builder.git_exclude(true);
    builder.ignore(true);
    builder.hidden(false);

    for entry in builder.build() {
        if matches.len() >= MAX_TOTAL_MATCHES {
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
        if !is_within_workspace(&workspace_root, path) {
            continue;
        }

        let rel_path = match path.strip_prefix(&workspace_root) {
            Ok(p) => p,
            Err(_) => continue,
        };

        if !matches_globs(rel_path, &include_globs, &exclude_globs) {
            continue;
        }

        let file_matches = match search_file(path, &matcher) {
            Ok(m) => m,
            Err(_) => continue,
        };

        for mut m in file_matches {
            if matches.len() >= MAX_TOTAL_MATCHES {
                break;
            }
            m.path = path.to_string_lossy().to_string();
            matches.push(m);
        }
    }

    Ok(matches)
}

fn search_file(path: &Path, matcher: &Regex) -> Result<Vec<SearchMatch>, String> {
    let metadata = std::fs::metadata(path).map_err(|e| format!("Failed to read metadata: {e}"))?;
    if metadata.len() > MAX_FILE_SIZE_BYTES {
        return Ok(Vec::new());
    }

    let bytes = std::fs::read(path).map_err(|e| format!("Failed to read file: {e}"))?;
    if bytes.contains(&0) {
        return Ok(Vec::new());
    }

    let text = String::from_utf8(bytes).map_err(|e| format!("File is not valid UTF-8: {e}"))?;

    let mut matches = Vec::new();
    for (line_index, line) in text.lines().enumerate() {
        for m in matcher.find_iter(line) {
            if matches.len() >= MAX_MATCHES_PER_FILE {
                return Ok(matches);
            }
            let start = m.start();
            let end = m.end();
            let match_text = m.as_str().to_string();
            let preview = build_preview(line, start, end);
            matches.push(SearchMatch {
                path: String::new(),
                line: line_index + 1,
                column: start + 1,
                preview,
                match_text,
            });
        }
    }

    Ok(matches)
}

fn build_preview(line: &str, start: usize, end: usize) -> String {
    let prefix_start = start.saturating_sub(PREVIEW_RADIUS);
    let suffix_end = (end + PREVIEW_RADIUS).min(line.len());
    let mut preview = String::new();
    if prefix_start > 0 {
        preview.push('…');
    }
    preview.push_str(&line[prefix_start..suffix_end]);
    if suffix_end < line.len() {
        preview.push('…');
    }
    preview
}
