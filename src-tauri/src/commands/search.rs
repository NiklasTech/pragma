use regex::{Regex, RegexBuilder};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::{Path, PathBuf};

const MAX_FILE_SIZE_BYTES: u64 = 1024 * 1024;
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

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplaceWorkspaceRequest {
    pub workspace_root: String,
    pub query: String,
    pub replacement: String,
    pub case_sensitive: bool,
    pub whole_word: bool,
    pub use_regex: bool,
    pub include_globs: Vec<String>,
    pub exclude_globs: Vec<String>,
    #[serde(default)]
    pub skip_paths: Vec<String>,
    #[serde(default)]
    pub single_path: Option<String>,
    #[serde(default)]
    pub one_match: Option<ReplaceMatchLocation>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplaceMatchLocation {
    pub path: String,
    pub line: usize,
    pub column: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplaceResult {
    pub files_changed: usize,
    pub replacement_count: usize,
}

#[tauri::command]
pub fn replace_workspace(req: ReplaceWorkspaceRequest) -> Result<ReplaceResult, String> {
    let workspace_root = validate_workspace_root(&req.workspace_root)?;
    let query = validate_query(&req.query)?;
    let matcher = build_matcher(&query, req.case_sensitive, req.whole_word, req.use_regex)?;
    let include_globs = build_gitignore(&workspace_root, &req.include_globs)?;
    let exclude_globs = build_gitignore(&workspace_root, &req.exclude_globs)?;

    let single_path = match &req.single_path {
        Some(path) => Some(validate_workspace_path(
            &workspace_root,
            path,
            "single_path",
        )?),
        None => None,
    };
    let one_match = match &req.one_match {
        Some(location) => {
            let path = validate_workspace_path(&workspace_root, &location.path, "one_match.path")?;
            if let Some(single) = &single_path {
                if single != &path {
                    return Err("one_match.path does not match single_path".to_string());
                }
            }
            Some((path, location.line, location.column))
        }
        None => None,
    };
    let skip_paths = build_skip_paths(&workspace_root, &req.skip_paths);

    if let Some(target) = single_path
        .as_ref()
        .or_else(|| one_match.as_ref().map(|(p, ..)| p))
    {
        if !target.is_file() || skip_paths.contains(target) {
            return Ok(ReplaceResult {
                files_changed: 0,
                replacement_count: 0,
            });
        }
        let location = one_match.as_ref().map(|(_, line, column)| (*line, *column));
        let count = replace_file(target, &matcher, &req.replacement, location)?;
        return Ok(ReplaceResult {
            files_changed: usize::from(count.is_some()),
            replacement_count: count.unwrap_or(0),
        });
    }

    let mut files_changed = 0usize;
    let mut replacement_count = 0usize;

    let mut builder = ignore::WalkBuilder::new(&workspace_root);
    builder.git_ignore(true);
    builder.git_global(true);
    builder.git_exclude(true);
    builder.ignore(true);
    builder.hidden(false);

    for entry in builder.build() {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        if !entry.file_type().is_some_and(|ft| ft.is_file()) {
            continue;
        }
        let path = entry.path();
        let Some(canonical) = canonical_workspace_path(&workspace_root, path) else {
            continue;
        };
        if skip_paths.contains(&canonical) {
            continue;
        }
        let rel_path = match path.strip_prefix(&workspace_root) {
            Ok(p) => p,
            Err(_) => continue,
        };
        if !matches_globs(rel_path, &include_globs, &exclude_globs) {
            continue;
        }
        let count = match replace_file(path, &matcher, &req.replacement, None) {
            Ok(Some(count)) => count,
            Ok(None) => continue,
            Err(_) => continue,
        };
        files_changed += 1;
        replacement_count += count;
    }

    Ok(ReplaceResult {
        files_changed,
        replacement_count,
    })
}

fn validate_workspace_path(
    workspace_root: &Path,
    raw: &str,
    field: &str,
) -> Result<PathBuf, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err(format!("{field} is required"));
    }
    let path = Path::new(trimmed);
    let canonical = path
        .canonicalize()
        .map_err(|e| format!("{field} does not exist: {trimmed}: {e}"))?;
    if !canonical.starts_with(workspace_root) {
        return Err(format!("{field} is outside the workspace: {trimmed}"));
    }
    Ok(canonical)
}

fn canonical_workspace_path(workspace_root: &Path, path: &Path) -> Option<PathBuf> {
    let canonical = path.canonicalize().ok()?;
    canonical.starts_with(workspace_root).then_some(canonical)
}

fn build_skip_paths(workspace_root: &Path, skip_paths: &[String]) -> HashSet<PathBuf> {
    let mut set = HashSet::new();
    for raw in skip_paths {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            continue;
        }
        if let Some(canonical) = canonical_workspace_path(workspace_root, Path::new(trimmed)) {
            set.insert(canonical);
        }
    }
    set
}

fn replace_file(
    path: &Path,
    matcher: &Regex,
    replacement: &str,
    one_match: Option<(usize, usize)>,
) -> Result<Option<usize>, String> {
    let metadata = std::fs::metadata(path).map_err(|e| format!("Failed to read {path:?}: {e}"))?;
    if metadata.len() > MAX_FILE_SIZE_BYTES {
        return Ok(None);
    }
    let bytes = std::fs::read(path).map_err(|e| format!("Failed to read {path:?}: {e}"))?;
    if bytes.contains(&0) {
        return Ok(None);
    }
    let text = String::from_utf8(bytes).map_err(|e| format!("File is not valid UTF-8: {e}"))?;

    let ranges = collect_match_ranges(&text, matcher, one_match);
    if ranges.is_empty() {
        return Ok(None);
    }

    let mut result = String::with_capacity(text.len());
    let mut cursor = 0usize;
    for (start, end) in &ranges {
        result.push_str(&text[cursor..*start]);
        result.push_str(replacement);
        cursor = *end;
    }
    result.push_str(&text[cursor..]);

    std::fs::write(path, result.as_bytes())
        .map_err(|e| format!("Failed to write {path:?}: {e}"))?;
    Ok(Some(ranges.len()))
}

fn collect_match_ranges(
    text: &str,
    matcher: &Regex,
    one_match: Option<(usize, usize)>,
) -> Vec<(usize, usize)> {
    let mut ranges = Vec::new();
    let mut line_start = 0usize;
    let mut rest = text;
    let mut line_number = 1usize;

    loop {
        let (line, consumed) = match rest.find('\n') {
            Some(idx) => {
                let raw = &rest[..idx];
                let line = raw.strip_suffix('\r').unwrap_or(raw);
                (line, idx + 1)
            }
            None => (rest, rest.len()),
        };

        if let Some((target_line, target_column)) = one_match {
            if line_number == target_line {
                for m in matcher.find_iter(line) {
                    if m.start() + 1 == target_column {
                        ranges.push((line_start + m.start(), line_start + m.end()));
                        break;
                    }
                }
                return ranges;
            }
        } else {
            for m in matcher.find_iter(line) {
                ranges.push((line_start + m.start(), line_start + m.end()));
            }
        }

        if consumed == rest.len() {
            break;
        }
        line_start += consumed;
        rest = &rest[consumed..];
        line_number += 1;
    }

    ranges
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    fn default_request(workspace_root: &str) -> ReplaceWorkspaceRequest {
        ReplaceWorkspaceRequest {
            workspace_root: workspace_root.to_string(),
            query: "foo".to_string(),
            replacement: "bar".to_string(),
            case_sensitive: false,
            whole_word: false,
            use_regex: false,
            include_globs: Vec::new(),
            exclude_globs: Vec::new(),
            skip_paths: Vec::new(),
            single_path: None,
            one_match: None,
        }
    }

    fn replace_text_file(path: &Path, content: &str) {
        fs::write(path, content).unwrap();
    }

    #[test]
    fn replaces_matches_across_a_temp_workspace() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        let first = root.join("a.txt");
        let nested = root.join("sub");
        fs::create_dir_all(&nested).unwrap();
        let second = nested.join("b.txt");
        replace_text_file(&first, "foo foo\nfoo");
        replace_text_file(&second, "no match here\nfoo");

        let result = replace_workspace(default_request(&root.to_string_lossy())).unwrap();

        assert_eq!(result.files_changed, 2);
        assert_eq!(result.replacement_count, 4);
        assert_eq!(fs::read_to_string(&first).unwrap(), "bar bar\nbar");
        assert_eq!(fs::read_to_string(&second).unwrap(), "no match here\nbar");
    }

    #[test]
    fn skips_open_tab_paths() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        let first = root.join("a.txt");
        let second = root.join("b.txt");
        replace_text_file(&first, "foo");
        replace_text_file(&second, "foo");

        let mut req = default_request(&root.to_string_lossy());
        req.skip_paths = vec![second.to_string_lossy().to_string()];

        let result = replace_workspace(req).unwrap();

        assert_eq!(result.files_changed, 1);
        assert_eq!(result.replacement_count, 1);
        assert_eq!(fs::read_to_string(&first).unwrap(), "bar");
        assert_eq!(fs::read_to_string(&second).unwrap(), "foo");
    }

    #[test]
    fn replaces_a_single_matching_location() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        let file = root.join("a.txt");
        replace_text_file(&file, "foo foo\nfoo");

        let mut req = default_request(&root.to_string_lossy());
        req.single_path = Some(file.to_string_lossy().to_string());
        req.one_match = Some(ReplaceMatchLocation {
            path: file.to_string_lossy().to_string(),
            line: 1,
            column: 5,
        });

        let result = replace_workspace(req).unwrap();

        assert_eq!(result.files_changed, 1);
        assert_eq!(result.replacement_count, 1);
        assert_eq!(fs::read_to_string(&file).unwrap(), "foo bar\nfoo");
    }

    #[test]
    fn rejects_paths_outside_the_workspace() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        let outside = root.parent().unwrap().join("outside.txt");
        replace_text_file(&outside, "foo");

        let mut req = default_request(&root.to_string_lossy());
        req.single_path = Some(outside.to_string_lossy().to_string());

        assert!(replace_workspace(req).is_err());
    }
}
