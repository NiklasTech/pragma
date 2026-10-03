use super::cancel::SearchToken;
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
    #[serde(default)]
    pub search_id: Option<String>,
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

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchWorkspaceResult {
    pub matches: Vec<SearchMatch>,
    pub truncated: bool,
}

#[tauri::command(async)]
pub fn search_workspace(req: SearchWorkspaceRequest) -> Result<SearchWorkspaceResult, String> {
    let token = SearchToken::register(req.search_id.as_deref())?;
    let workspace_root = validate_workspace_root(&req.workspace_root)?;
    let query = validate_query(&req.query)?;
    let matcher = build_matcher(&query, req.case_sensitive, req.whole_word, req.use_regex)?;
    let include_globs = build_gitignore(&workspace_root, &req.include_globs)?;
    let exclude_globs = build_gitignore(&workspace_root, &req.exclude_globs)?;

    let mut matches = Vec::new();
    let mut truncated = false;

    let mut builder = ignore::WalkBuilder::new(&workspace_root);
    builder.git_ignore(true);
    builder.git_global(true);
    builder.git_exclude(true);
    builder.ignore(true);
    builder.hidden(false);

    for entry in builder.build() {
        if token.is_cancelled() {
            return Err("Search was cancelled".to_string());
        }
        if truncated {
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

        let (file_matches, file_truncated) = match search_file(path, &matcher) {
            Ok(m) => m,
            Err(_) => continue,
        };
        truncated |= file_truncated;

        for mut m in file_matches {
            if matches.len() >= MAX_TOTAL_MATCHES {
                truncated = true;
                break;
            }
            m.path = path.to_string_lossy().to_string();
            matches.push(m);
        }
    }

    Ok(SearchWorkspaceResult { matches, truncated })
}

/// Returns the matches of one file and whether more matches were left out.
fn search_file(path: &Path, matcher: &Regex) -> Result<(Vec<SearchMatch>, bool), String> {
    let metadata = std::fs::metadata(path).map_err(|e| format!("Failed to read metadata: {e}"))?;
    if metadata.len() > MAX_FILE_SIZE_BYTES {
        return Ok((Vec::new(), false));
    }

    let bytes = std::fs::read(path).map_err(|e| format!("Failed to read file: {e}"))?;
    if bytes.contains(&0) {
        return Ok((Vec::new(), false));
    }

    let text = String::from_utf8(bytes).map_err(|e| format!("File is not valid UTF-8: {e}"))?;

    let mut matches = Vec::new();
    for (line_index, line) in text.lines().enumerate() {
        for m in matcher.find_iter(line) {
            if matches.len() >= MAX_MATCHES_PER_FILE {
                return Ok((matches, true));
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

    Ok((matches, false))
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    fn default_request(workspace_root: &str) -> SearchWorkspaceRequest {
        SearchWorkspaceRequest {
            workspace_root: workspace_root.to_string(),
            query: "foo".to_string(),
            case_sensitive: false,
            whole_word: false,
            use_regex: false,
            include_globs: Vec::new(),
            exclude_globs: Vec::new(),
            search_id: None,
        }
    }

    #[test]
    fn reports_complete_results_as_not_truncated() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("a.txt"), "foo\nbar\nfoo").unwrap();

        let result = search_workspace(default_request(&dir.path().to_string_lossy())).unwrap();

        assert_eq!(result.matches.len(), 2);
        assert!(!result.truncated);
    }

    #[test]
    fn reports_truncation_at_the_per_file_limit() {
        let dir = tempdir().unwrap();
        let content = "foo\n".repeat(MAX_MATCHES_PER_FILE + 1);
        fs::write(dir.path().join("a.txt"), content).unwrap();

        let result = search_workspace(default_request(&dir.path().to_string_lossy())).unwrap();

        assert_eq!(result.matches.len(), MAX_MATCHES_PER_FILE);
        assert!(result.truncated);
    }

    #[test]
    fn reports_truncation_at_the_total_limit() {
        let dir = tempdir().unwrap();
        let files = MAX_TOTAL_MATCHES / MAX_MATCHES_PER_FILE + 1;
        for index in 0..files {
            let content = "foo\n".repeat(MAX_MATCHES_PER_FILE);
            fs::write(dir.path().join(format!("{index}.txt")), content).unwrap();
        }

        let result = search_workspace(default_request(&dir.path().to_string_lossy())).unwrap();

        assert_eq!(result.matches.len(), MAX_TOTAL_MATCHES);
        assert!(result.truncated);
    }
}
