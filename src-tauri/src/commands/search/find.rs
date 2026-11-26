use super::cancel::SearchToken;
use super::{
    build_gitignore, build_matcher, is_within_workspace, matches_globs, validate_query,
    validate_workspace_root, MAX_FILE_SIZE_BYTES,
};
use ignore::WalkState;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

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

    let mut builder = ignore::WalkBuilder::new(&workspace_root);
    builder.git_ignore(true);
    builder.git_global(true);
    builder.git_exclude(true);
    builder.ignore(true);
    builder.hidden(false);
    // Hidden files are searched, but git's own folder (hook samples, refs, packs) never.
    builder.filter_entry(|entry| entry.file_name() != ".git");

    let found = Mutex::new((Vec::new(), false));
    let cancelled = AtomicBool::new(false);
    // Several threads read and search files at once, as ripgrep does.
    builder.build_parallel().run(|| {
        Box::new(|entry| {
            if token.is_cancelled() {
                cancelled.store(true, Ordering::Relaxed);
                return WalkState::Quit;
            }
            let Ok(entry) = entry else {
                return WalkState::Continue;
            };
            if !entry.file_type().is_some_and(|ft| ft.is_file()) {
                return WalkState::Continue;
            }
            let path = entry.path();
            if !is_within_workspace(&workspace_root, path) {
                return WalkState::Continue;
            }
            let Ok(rel_path) = path.strip_prefix(&workspace_root) else {
                return WalkState::Continue;
            };
            if !matches_globs(rel_path, &include_globs, &exclude_globs) {
                return WalkState::Continue;
            }
            let Ok((file_matches, file_truncated)) = search_file(path, &matcher) else {
                return WalkState::Continue;
            };
            if file_matches.is_empty() && !file_truncated {
                return WalkState::Continue;
            }

            let Ok(mut found) = found.lock() else {
                return WalkState::Quit;
            };
            let (matches, truncated) = &mut *found;
            *truncated |= file_truncated;
            let path = path.to_string_lossy().to_string();
            for mut m in file_matches {
                if matches.len() >= MAX_TOTAL_MATCHES {
                    *truncated = true;
                    return WalkState::Quit;
                }
                m.path = path.clone();
                matches.push(m);
            }
            WalkState::Continue
        })
    });

    if cancelled.load(Ordering::Relaxed) {
        return Err("Search was cancelled".to_string());
    }
    let (mut matches, truncated) = found
        .into_inner()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    // The threads finish in any order, so results are sorted for a stable list.
    matches.sort_by(|a: &SearchMatch, b: &SearchMatch| {
        (&a.path, a.line, a.column).cmp(&(&b.path, b.line, b.column))
    });
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
    fn sorts_matches_by_path_and_line_across_files() {
        let dir = tempdir().unwrap();
        for name in ["c.txt", "a.txt", "b.txt"] {
            fs::write(dir.path().join(name), "x\nfoo\nfoo foo").unwrap();
        }

        let result = search_workspace(default_request(&dir.path().to_string_lossy())).unwrap();

        let order: Vec<(String, usize, usize)> = result
            .matches
            .iter()
            .map(|m| {
                let name = Path::new(&m.path).file_name().unwrap();
                (name.to_string_lossy().to_string(), m.line, m.column)
            })
            .collect();
        let mut sorted = order.clone();
        sorted.sort();
        assert_eq!(order.len(), 9);
        assert_eq!(order, sorted);
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

    fn search(dir: &Path, configure: impl FnOnce(&mut SearchWorkspaceRequest)) -> Vec<SearchMatch> {
        let mut req = default_request(&dir.to_string_lossy());
        configure(&mut req);
        search_workspace(req).unwrap().matches
    }

    fn file_names(matches: &[SearchMatch]) -> Vec<String> {
        let mut names: Vec<_> = matches
            .iter()
            .map(|m| {
                Path::new(&m.path)
                    .file_name()
                    .unwrap()
                    .to_string_lossy()
                    .into_owned()
            })
            .collect();
        names.sort();
        names.dedup();
        names
    }

    #[test]
    fn reports_line_column_and_absolute_path() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("a.txt"), "one\n  call foo()\n").unwrap();

        let matches = search(dir.path(), |_| {});

        assert_eq!(matches.len(), 1);
        assert_eq!(matches[0].line, 2);
        assert_eq!(matches[0].column, 8);
        assert_eq!(matches[0].match_text, "foo");
        assert_eq!(matches[0].preview, "  call foo()");
        assert!(Path::new(&matches[0].path).is_absolute());
    }

    #[test]
    fn respects_case_sensitivity() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("a.txt"), "Foo foo FOO").unwrap();

        assert_eq!(search(dir.path(), |_| {}).len(), 3);
        assert_eq!(search(dir.path(), |r| r.case_sensitive = true).len(), 1);
    }

    #[test]
    fn whole_word_skips_partial_matches() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("a.txt"), "foo food foobar foo").unwrap();

        assert_eq!(search(dir.path(), |r| r.whole_word = true).len(), 2);
    }

    #[test]
    fn plain_queries_escape_regex_syntax() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("a.txt"), "a.b axb").unwrap();

        let plain = search(dir.path(), |r| r.query = "a.b".into());
        let regex = search(dir.path(), |r| {
            r.query = "a.b".into();
            r.use_regex = true;
        });

        assert_eq!(plain.len(), 1);
        assert_eq!(regex.len(), 2);
    }

    #[test]
    fn rejects_invalid_input() {
        let dir = tempdir().unwrap();
        let root = dir.path().to_string_lossy().into_owned();
        let with = |configure: fn(&mut SearchWorkspaceRequest)| {
            let mut req = default_request(&root);
            configure(&mut req);
            search_workspace(req).unwrap_err()
        };

        assert_eq!(with(|r| r.query = "   ".into()), "query is required");
        assert_eq!(
            with(|r| r.workspace_root.clear()),
            "workspace_root is required"
        );
        assert!(with(|r| r.workspace_root.push_str("/missing"))
            .starts_with("Workspace root does not exist"));
        assert!(with(|r| {
            r.query = "(".into();
            r.use_regex = true;
        })
        .starts_with("Invalid search pattern"));
    }

    #[test]
    fn applies_include_and_exclude_globs() {
        let dir = tempdir().unwrap();
        fs::create_dir(dir.path().join("src")).unwrap();
        fs::write(dir.path().join("src/a.rs"), "foo").unwrap();
        fs::write(dir.path().join("src/b.ts"), "foo").unwrap();
        fs::write(dir.path().join("c.rs"), "foo").unwrap();

        let included = search(dir.path(), |r| r.include_globs = vec!["*.rs".into()]);
        let excluded = search(dir.path(), |r| r.exclude_globs = vec!["src/**".into()]);

        assert_eq!(file_names(&included), vec!["a.rs", "c.rs"]);
        assert_eq!(file_names(&excluded), vec!["c.rs"]);
    }

    #[test]
    fn skips_ignored_binary_and_oversized_files() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join(".ignore"), "ignored.txt\n").unwrap();
        fs::write(dir.path().join("ignored.txt"), "foo").unwrap();
        fs::write(dir.path().join("binary.bin"), b"foo\0").unwrap();
        fs::write(
            dir.path().join("large.txt"),
            "foo".repeat(MAX_FILE_SIZE_BYTES as usize),
        )
        .unwrap();
        fs::write(dir.path().join("kept.txt"), "foo").unwrap();

        let matches = search(dir.path(), |_| {});

        assert_eq!(file_names(&matches), vec!["kept.txt"]);
    }

    #[test]
    fn skips_the_git_folder_but_not_other_hidden_files() {
        let dir = tempdir().unwrap();
        fs::create_dir_all(dir.path().join(".git/hooks")).unwrap();
        fs::write(dir.path().join(".git/hooks/pre-commit.sample"), "foo").unwrap();
        fs::write(dir.path().join(".env.example"), "foo").unwrap();

        let matches = search(dir.path(), |_| {});

        assert_eq!(file_names(&matches), vec![".env.example"]);
    }

    #[test]
    fn previews_long_lines_around_the_match() {
        let line = format!("{}foo{}", "a".repeat(200), "b".repeat(200));

        let preview = build_preview(&line, 200, 203);

        assert!(preview.starts_with('…'));
        assert!(preview.ends_with('…'));
        assert!(preview.contains("foo"));
        assert_eq!(preview.chars().count(), 2 + 80 + 3 + 80);
    }

    #[cfg(unix)]
    #[test]
    fn does_not_follow_symlinks_out_of_the_workspace() {
        let outside = tempdir().unwrap();
        fs::write(outside.path().join("secret.txt"), "foo").unwrap();
        let dir = tempdir().unwrap();
        std::os::unix::fs::symlink(
            outside.path().join("secret.txt"),
            dir.path().join("link.txt"),
        )
        .unwrap();
        std::os::unix::fs::symlink(outside.path(), dir.path().join("linked-dir")).unwrap();

        assert!(search(dir.path(), |_| {}).is_empty());
    }
}
