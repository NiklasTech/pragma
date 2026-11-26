//! Go to keeps the folder's files here and ranks them per keystroke, so typing never blocks the window.

use super::files::{collect_files, MAX_FILES};
use super::validate_workspace_root;
use std::cmp::Ordering;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Instant;

/// Listings kept at once; a large repository takes a few megabytes.
const MAX_INDEXES: usize = 4;
const MAX_RESULTS: usize = 200;

struct Entry {
    relative: String,
    /// Lowercase file name and relative path, computed once per listing.
    name_key: String,
    path_key: String,
}

type Index = Arc<Vec<Entry>>;

struct Stored {
    index: Index,
    used: Instant,
}

fn indexes() -> &'static Mutex<HashMap<PathBuf, Stored>> {
    static INDEXES: OnceLock<Mutex<HashMap<PathBuf, Stored>>> = OnceLock::new();
    INDEXES.get_or_init(Default::default)
}

fn build_index(root: &Path) -> Index {
    let mut entries: Vec<Entry> = collect_files(root, MAX_FILES)
        .files
        .into_iter()
        .map(|relative| {
            let name = relative.rsplit('/').next().unwrap_or(&relative);
            Entry {
                name_key: name.to_lowercase(),
                path_key: relative.to_lowercase(),
                relative,
            }
        })
        .collect();
    entries.sort_by(|a, b| a.path_key.cmp(&b.path_key));
    Arc::new(entries)
}

fn store(root: PathBuf, index: Index) {
    let Ok(mut stored) = indexes().lock() else {
        return;
    };
    stored.insert(
        root,
        Stored {
            index,
            used: Instant::now(),
        },
    );
    while stored.len() > MAX_INDEXES {
        let Some(oldest) = stored
            .iter()
            .min_by_key(|(_, entry)| entry.used)
            .map(|(root, _)| root.clone())
        else {
            break;
        };
        stored.remove(&oldest);
    }
}

fn stored_index(root: &Path) -> Option<Index> {
    let mut stored = indexes().lock().ok()?;
    let entry = stored.get_mut(root)?;
    entry.used = Instant::now();
    Some(entry.index.clone())
}

/// Lists the folder again; Go to calls it when it opens and keeps showing the last listing meanwhile.
#[tauri::command(async)]
pub fn quick_open_refresh(workspace_root: String) -> Result<usize, String> {
    let root = validate_workspace_root(&workspace_root)?;
    let index = build_index(&root);
    let count = index.len();
    store(root, index);
    Ok(count)
}

/// The best `limit` files for the query, relative to the folder, best first.
#[tauri::command(async)]
pub fn quick_open_search(
    workspace_root: String,
    query: String,
    limit: usize,
) -> Result<Vec<String>, String> {
    let root = validate_workspace_root(&workspace_root)?;
    let index = match stored_index(&root) {
        Some(index) => index,
        None => {
            let index = build_index(&root);
            store(root, index.clone());
            index
        }
    };
    Ok(rank(&index, &query, limit.min(MAX_RESULTS)))
}

/// Where the first subsequence match of `query` in `text` starts and ends, in bytes.
fn subsequence_span(text: &str, query: &str) -> Option<(usize, usize)> {
    let mut wanted = query.chars();
    let mut next = wanted.next()?;
    let mut start = None;
    for (offset, ch) in text.char_indices() {
        if ch != next {
            continue;
        }
        let start = *start.get_or_insert(offset);
        match wanted.next() {
            Some(following) => next = following,
            None => return Some((start, offset)),
        }
    }
    None
}

/// Higher is better; None when the file does not match. Name matches beat path matches.
fn score(entry: &Entry, query: &str) -> Option<f64> {
    let name = &entry.name_key;
    let path = &entry.path_key;
    let name_len = name.len() as f64;
    let path_len = path.len() as f64;
    if name == query {
        return Some(10_000.0);
    }
    if name.starts_with(query) {
        return Some(8_000.0 - name_len);
    }
    if let Some(at) = name.find(query) {
        return Some(6_000.0 - at as f64 - name_len);
    }
    if let Some(at) = path.find(query) {
        return Some(4_000.0 - at as f64 - path_len);
    }
    if let Some((start, end)) = subsequence_span(name, query) {
        // An abbreviation like "fe" for FileEditor starts at the first letter of the name.
        let start_bonus = if start == 0 { 500.0 } else { 0.0 };
        return Some(2_000.0 + start_bonus - (end - start) as f64 - name_len);
    }
    let (start, end) = subsequence_span(path, query)?;
    Some(1_000.0 - (end - start) as f64 - path_len / 10.0)
}

/// The best files for the query, ignoring case and spaces; an empty query keeps the listing order.
fn rank(index: &[Entry], raw_query: &str, limit: usize) -> Vec<String> {
    let query: String = raw_query
        .to_lowercase()
        .chars()
        .filter(|ch| !ch.is_whitespace())
        .collect();
    if query.is_empty() {
        return index
            .iter()
            .take(limit)
            .map(|entry| entry.relative.clone())
            .collect();
    }
    if limit == 0 {
        return Vec::new();
    }

    let mut matches: Vec<(f64, usize)> = index
        .iter()
        .enumerate()
        .filter_map(|(position, entry)| score(entry, &query).map(|score| (score, position)))
        .collect();
    // Equal scores keep the listing order.
    let order = |a: &(f64, usize), b: &(f64, usize)| {
        b.0.partial_cmp(&a.0)
            .unwrap_or(Ordering::Equal)
            .then(a.1.cmp(&b.1))
    };
    if matches.len() > limit {
        matches.select_nth_unstable_by(limit - 1, order);
        matches.truncate(limit);
    }
    matches.sort_by(order);
    matches
        .into_iter()
        .map(|(_, position)| index[position].relative.clone())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn index_of(paths: &[&str]) -> Vec<Entry> {
        let mut entries: Vec<Entry> = paths
            .iter()
            .map(|relative| {
                let name = relative.rsplit('/').next().unwrap_or(relative);
                Entry {
                    relative: relative.to_string(),
                    name_key: name.to_lowercase(),
                    path_key: relative.to_lowercase(),
                }
            })
            .collect();
        entries.sort_by(|a, b| a.path_key.cmp(&b.path_key));
        entries
    }

    const FILES: &[&str] = &[
        "README.md",
        "src/app/GoToFile.tsx",
        "src/app/goToFileSearch.ts",
        "src/features/editor/components/FileEditor.tsx",
        "src/shared/stores/goToFile.ts",
        "docs-site/getting-started.md",
    ];

    fn names(query: &str, limit: usize) -> Vec<String> {
        rank(&index_of(FILES), query, limit)
    }

    #[test]
    fn keeps_the_listing_order_for_an_empty_query_and_applies_the_limit() {
        assert_eq!(
            names("", 2),
            vec!["docs-site/getting-started.md", "README.md"]
        );
    }

    #[test]
    fn ranks_an_exact_name_before_a_name_prefix_and_an_abbreviation() {
        assert_eq!(
            names("gotofile.ts", 10),
            vec![
                "src/shared/stores/goToFile.ts",
                "src/app/GoToFile.tsx",
                "src/app/goToFileSearch.ts",
            ]
        );
    }

    #[test]
    fn matches_the_path_and_abbreviations_ignoring_case_and_spaces() {
        assert_eq!(
            names("features/editor", 10),
            vec!["src/features/editor/components/FileEditor.tsx"]
        );
        assert_eq!(
            names("FE tsx", 10)[0],
            "src/features/editor/components/FileEditor.tsx"
        );
        assert!(names("gs", 10).contains(&"docs-site/getting-started.md".to_string()));
    }

    #[test]
    fn returns_nothing_when_no_file_matches() {
        assert!(names("zzz", 10).is_empty());
    }

    #[test]
    fn prefers_name_matches_over_path_only_matches() {
        let entries = index_of(FILES);
        let readme = entries.iter().find(|e| e.relative == "README.md").unwrap();
        let editor = entries
            .iter()
            .find(|e| e.relative.ends_with("FileEditor.tsx"))
            .unwrap();
        assert!(score(readme, "readme").unwrap() > score(editor, "components").unwrap());
    }

    #[test]
    fn keeps_the_best_matches_when_more_match_than_the_limit() {
        let many: Vec<String> = (0..50).map(|i| format!("dir{i:02}/file.ts")).collect();
        let mut paths: Vec<&str> = many.iter().map(String::as_str).collect();
        paths.push("file.ts");
        let found = rank(&index_of(&paths), "file.ts", 3);
        assert_eq!(
            found,
            vec!["dir00/file.ts", "dir01/file.ts", "dir02/file.ts"]
        );
    }

    #[test]
    fn searches_a_folder_and_refreshes_it() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().to_string_lossy().to_string();
        fs::write(dir.path().join("alpha.rs"), "").unwrap();

        let found = quick_open_search(root.clone(), "alpha".into(), 10).unwrap();
        assert_eq!(found, vec!["alpha.rs"]);

        fs::write(dir.path().join("alphabet.rs"), "").unwrap();
        assert_eq!(
            quick_open_search(root.clone(), "alpha".into(), 10)
                .unwrap()
                .len(),
            1
        );
        assert_eq!(quick_open_refresh(root.clone()).unwrap(), 2);
        assert_eq!(
            quick_open_search(root, "alpha".into(), 10).unwrap(),
            vec!["alpha.rs", "alphabet.rs"]
        );
    }
}
