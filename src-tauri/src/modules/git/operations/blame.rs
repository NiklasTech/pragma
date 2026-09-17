use std::collections::HashMap;

use crate::modules::git::errors::{GitError, Result};
use crate::modules::git::process::{ensure_git_available, ensure_success, run_git};
use crate::modules::git::types::{GitBlameLine, DEFAULT_TIMEOUT_SECS};
use crate::modules::git::utils::{authorized_repo_root, is_safe_pathspec};

use super::pathspec_from_input;

pub fn blame(repo_root: &str, path: &str) -> Result<Vec<GitBlameLine>> {
    let repo_root = authorized_repo_root(repo_root)?;
    ensure_git_available()?;
    if path.is_empty() {
        return Err(GitError::command("git blame", "empty path"));
    }
    let spec = pathspec_from_input(&repo_root, path)?;
    if !is_safe_pathspec(&spec) {
        return Err(GitError::command("git blame", "invalid path"));
    }

    let output = run_git(
        Some(&repo_root.to_string_lossy()),
        ["blame", "--line-porcelain", "--", &spec],
        DEFAULT_TIMEOUT_SECS,
    )?;
    ensure_success(&output, "git blame failed")?;

    let text = String::from_utf8_lossy(&output.stdout).into_owned();
    Ok(parse_blame_porcelain(&text))
}

fn parse_blame_porcelain(input: &str) -> Vec<GitBlameLine> {
    let mut lines = Vec::new();
    let mut cache: HashMap<String, (String, String, i64)> = HashMap::new();
    let mut current: Option<(String, u32, (String, String, i64))> = None;

    for raw in input.lines() {
        if let Some(content) = raw.strip_prefix('\t') {
            if let Some((sha, line, meta)) = current.take() {
                lines.push(GitBlameLine {
                    line,
                    short_sha: sha.chars().take(7).collect(),
                    sha,
                    author: meta.0,
                    author_email: meta.1,
                    timestamp_secs: meta.2,
                    content: content.to_string(),
                });
            }
            continue;
        }

        if is_sha_header(raw) {
            let mut parts = raw.split(' ');
            let sha = parts.next().unwrap_or("").to_string();
            let line = parts
                .nth(1)
                .and_then(|value| value.parse().ok())
                .unwrap_or(0);
            let meta = cache.get(&sha).cloned().unwrap_or_default();
            current = Some((sha, line, meta));
            continue;
        }

        if let Some((sha, _, meta)) = current.as_mut() {
            if let Some(value) = raw.strip_prefix("author-mail ") {
                meta.1 = value
                    .trim()
                    .trim_start_matches('<')
                    .trim_end_matches('>')
                    .to_string();
            } else if let Some(value) = raw.strip_prefix("author-time ") {
                meta.2 = value.trim().parse().unwrap_or(0);
            } else if let Some(value) = raw.strip_prefix("author ") {
                meta.0 = value.to_string();
            } else {
                continue;
            }
            cache.insert(sha.clone(), meta.clone());
        }
    }

    lines
}

fn is_sha_header(line: &str) -> bool {
    let bytes = line.as_bytes();
    bytes.len() > 40 && bytes[40] == b' ' && bytes[..40].iter().all(|b| b.is_ascii_hexdigit())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_line_porcelain() {
        let input = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 1 1 1\nauthor Ada\nauthor-mail <ada@example.com>\nauthor-time 1700000000\nauthor-tz +0000\nsummary init\nfilename file.txt\n\tfirst\naaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 2 2 1\n\tsecond\n";
        let parsed = parse_blame_porcelain(input);
        assert_eq!(parsed.len(), 2);
        assert_eq!(parsed[0].line, 1);
        assert_eq!(parsed[0].author, "Ada");
        assert_eq!(parsed[0].author_email, "ada@example.com");
        assert_eq!(parsed[0].timestamp_secs, 1700000000);
        assert_eq!(parsed[0].content, "first");
        assert_eq!(parsed[0].short_sha, "aaaaaaa");
        assert_eq!(parsed[1].content, "second");
    }

    #[test]
    fn is_sha_header_rejects_metadata() {
        assert!(is_sha_header(
            "0123456789abcdef0123456789abcdef01234567 1 1 1"
        ));
        assert!(!is_sha_header("author Ada"));
        assert!(!is_sha_header(
            "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz 1 1"
        ));
    }
}
