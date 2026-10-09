use std::path::Path;

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use super::chat_storage::sessions_dir;

const MAX_QUERY_CHARS: usize = 200;
const MAX_RESULTS: usize = 200;
const SNIPPET_BEFORE_CHARS: usize = 40;
const SNIPPET_AFTER_CHARS: usize = 100;

#[derive(Debug, Deserialize)]
pub struct SearchSessionsRequest {
    pub root_path: String,
    pub query: String,
    pub limit: Option<usize>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct SessionSearchHit {
    pub session_id: String,
    pub message_id: String,
    pub snippet: String,
}

/// Only the fields search needs; images and other fields are skipped while parsing.
#[derive(Deserialize)]
struct SearchableMessage {
    id: String,
    content: String,
}

/// Searches the stored messages of every session in the workspace, one hit per session.
#[tauri::command]
pub async fn ai_search_sessions(
    app: AppHandle,
    req: SearchSessionsRequest,
) -> Result<Vec<SessionSearchHit>, String> {
    let query = normalize_query(&req.query)?;
    let limit = req.limit.unwrap_or(MAX_RESULTS).clamp(1, MAX_RESULTS);
    let dir = sessions_dir(&app, &req.root_path)?;
    search_sessions(&dir, &query, limit).await
}

fn normalize_query(query: &str) -> Result<String, String> {
    let trimmed = query.trim();
    if trimmed.is_empty() {
        return Err("Search query is required".to_string());
    }
    if trimmed.chars().count() > MAX_QUERY_CHARS {
        return Err(format!(
            "Search query is longer than {MAX_QUERY_CHARS} characters"
        ));
    }
    Ok(trimmed.to_lowercase())
}

async fn search_sessions(
    dir: &Path,
    query: &str,
    limit: usize,
) -> Result<Vec<SessionSearchHit>, String> {
    if !dir.exists() {
        return Ok(Vec::new());
    }

    let mut hits = Vec::new();
    let mut entries = tokio::fs::read_dir(dir)
        .await
        .map_err(|e| format!("failed to read sessions dir: {e}"))?;

    while let Some(entry) = entries
        .next_entry()
        .await
        .map_err(|e| format!("failed to read dir entry: {e}"))?
    {
        if hits.len() >= limit {
            break;
        }
        let path = entry.path();
        let Some(session_id) = path.file_name().and_then(|name| name.to_str()) else {
            continue;
        };
        let Ok(content) = tokio::fs::read_to_string(path.join("context.jsonl")).await else {
            continue;
        };
        if let Some(hit) = first_match(session_id, &content, query) {
            hits.push(hit);
        }
    }

    Ok(hits)
}

fn first_match(session_id: &str, content: &str, query: &str) -> Option<SessionSearchHit> {
    content
        .lines()
        .filter(|line| !line.trim().is_empty())
        .filter_map(|line| serde_json::from_str::<SearchableMessage>(line).ok())
        .find_map(|message| {
            let (start, end) = find_ignore_case(&message.content, query)?;
            Some(SessionSearchHit {
                session_id: session_id.to_string(),
                message_id: message.id,
                snippet: snippet(&message.content, start, end),
            })
        })
}

/// Byte range of the first case-insensitive match of the lowercase `needle` in `text`.
fn find_ignore_case(text: &str, needle: &str) -> Option<(usize, usize)> {
    let mut lower = String::with_capacity(text.len());
    let mut origin = Vec::with_capacity(text.len());
    for (index, ch) in text.char_indices() {
        lower.extend(ch.to_lowercase());
        origin.resize(lower.len(), index);
    }
    let position = lower.find(needle)?;
    let start = origin[position];
    let end = origin
        .get(position + needle.len())
        .copied()
        .unwrap_or(text.len());
    Some((start, end.max(start)))
}

fn snippet(text: &str, start: usize, end: usize) -> String {
    let before: Vec<char> = text[..start].chars().collect();
    let skipped = before.len().saturating_sub(SNIPPET_BEFORE_CHARS);
    let lead: String = before[skipped..].iter().collect();
    let after_chars = text[end..].chars().count();
    let tail: String = text[end..].chars().take(SNIPPET_AFTER_CHARS).collect();

    let mut out = String::new();
    if skipped > 0 {
        out.push_str("...");
    }
    out.push_str(&lead);
    out.push_str(&text[start..end]);
    out.push_str(&tail);
    if after_chars > SNIPPET_AFTER_CHARS {
        out.push_str("...");
    }
    out.split_whitespace().collect::<Vec<_>>().join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn line(id: &str, content: &str) -> String {
        serde_json::json!({ "id": id, "role": "user", "content": content, "timestamp": 1 })
            .to_string()
    }

    #[test]
    fn query_is_trimmed_lowercased_and_bounded() {
        assert_eq!(normalize_query("  Login BUG ").unwrap(), "login bug");
        assert!(normalize_query("   ").is_err());
        assert!(normalize_query(&"a".repeat(MAX_QUERY_CHARS + 1)).is_err());
    }

    #[test]
    fn finds_matches_regardless_of_case_and_keeps_byte_offsets() {
        let text = "Öffne die Datei LOGIN.ts";
        let (start, end) = find_ignore_case(text, "login").unwrap();
        assert_eq!(&text[start..end], "LOGIN");
        assert_eq!(
            find_ignore_case("Straße", "straße"),
            Some((0, "Straße".len()))
        );
        assert_eq!(find_ignore_case("hello", "bye"), None);
    }

    #[test]
    fn snippet_trims_long_text_and_collapses_whitespace() {
        let text = format!("{}needle\n\nafter{}", "x".repeat(80), "y".repeat(200));
        let start = text.find("needle").unwrap();
        let shown = snippet(&text, start, start + "needle".len());
        assert!(shown.starts_with("..."));
        assert!(shown.ends_with("..."));
        assert!(shown.contains("needle after"));
        assert_eq!(snippet("short needle", 6, 12), "short needle");
    }

    #[test]
    fn first_match_returns_the_earliest_matching_message() {
        let content = [
            line("1", "nothing here"),
            line("2", "Fix the Parser"),
            line("3", "parser again"),
        ]
        .join("\n");
        let hit = first_match("s1", &content, "parser").unwrap();
        assert_eq!(hit.message_id, "2");
        assert_eq!(hit.snippet, "Fix the Parser");
        assert!(first_match("s1", "{broken\n", "parser").is_none());
    }

    #[tokio::test]
    async fn search_returns_one_hit_per_matching_session_up_to_the_limit() {
        let dir = tempfile::tempdir().unwrap();
        for (id, text) in [
            ("a", "deploy failed"),
            ("b", "Deploy again"),
            ("c", "unrelated"),
        ] {
            std::fs::create_dir(dir.path().join(id)).unwrap();
            std::fs::write(dir.path().join(id).join("context.jsonl"), line("m", text)).unwrap();
        }
        std::fs::create_dir(dir.path().join("empty")).unwrap();

        let mut ids: Vec<_> = search_sessions(dir.path(), "deploy", 10)
            .await
            .unwrap()
            .into_iter()
            .map(|hit| hit.session_id)
            .collect();
        ids.sort();
        assert_eq!(ids, vec!["a", "b"]);

        assert_eq!(
            search_sessions(dir.path(), "deploy", 1)
                .await
                .unwrap()
                .len(),
            1
        );
        assert!(search_sessions(&dir.path().join("missing"), "x", 10)
            .await
            .unwrap()
            .is_empty());
    }
}
