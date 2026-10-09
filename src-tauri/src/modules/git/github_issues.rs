use serde::{Deserialize, Serialize};

use crate::modules::git::errors::Result;
use crate::modules::git::types::NETWORK_TIMEOUT_SECS;
use crate::modules::git::utils::authorized_repo_root;

use super::github::{blocking, gh_stdout, parse_json, require_gh, require_repo_path, run_gh};

const MAX_ISSUES: u32 = 200;
const DEFAULT_ISSUES: u32 = 50;

#[derive(Debug, Serialize, PartialEq)]
pub struct GhIssue {
    pub number: u64,
    pub title: String,
    pub body: String,
    pub url: String,
    pub labels: Vec<String>,
}

#[derive(Deserialize)]
struct RawLabel {
    name: String,
}

#[derive(Deserialize)]
struct RawIssue {
    number: u64,
    title: String,
    #[serde(default)]
    body: String,
    url: String,
    #[serde(default)]
    labels: Vec<RawLabel>,
}

fn parse_issues(text: &str) -> Result<Vec<GhIssue>> {
    let raw: Vec<RawIssue> = parse_json(text, "could not read gh issue list output")?;
    Ok(raw
        .into_iter()
        .filter(|issue| issue.url.starts_with("https://"))
        .map(|issue| GhIssue {
            number: issue.number,
            title: issue.title,
            body: issue.body,
            url: issue.url,
            labels: issue.labels.into_iter().map(|label| label.name).collect(),
        })
        .collect())
}

/// Open issues of the repository's GitHub remote, newest first.
pub fn open_issues(repo_root: &str, limit: u32) -> Result<Vec<GhIssue>> {
    let repo_root = authorized_repo_root(repo_root)?;
    let program = require_gh()?;
    let limit = limit.clamp(1, MAX_ISSUES).to_string();
    let output = run_gh(
        &program,
        &repo_root,
        [
            "issue",
            "list",
            "--state",
            "open",
            "--limit",
            limit.as_str(),
            "--json",
            "number,title,body,url,labels",
        ],
        NETWORK_TIMEOUT_SECS,
    )?;
    let text = gh_stdout(output, "gh issue list failed")?;
    parse_issues(&text)
}

#[tauri::command]
pub async fn gh_issue_list(
    repo_path: String,
    limit: Option<u32>,
) -> std::result::Result<Vec<GhIssue>, String> {
    require_repo_path(&repo_path)?;
    blocking(move || open_issues(&repo_path, limit.unwrap_or(DEFAULT_ISSUES))).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_issue_list_output() {
        let text = r#"[
            {"number": 12, "title": "Crash on save", "body": "Steps", "url": "https://github.com/o/r/issues/12",
             "labels": [{"name": "bug", "color": "f00"}, {"name": "ui"}]},
            {"number": 13, "title": "No body", "url": "https://github.com/o/r/issues/13"}
        ]"#;
        let issues = parse_issues(text).unwrap();
        assert_eq!(
            issues[0],
            GhIssue {
                number: 12,
                title: "Crash on save".to_string(),
                body: "Steps".to_string(),
                url: "https://github.com/o/r/issues/12".to_string(),
                labels: vec!["bug".to_string(), "ui".to_string()],
            }
        );
        assert!(issues[1].body.is_empty() && issues[1].labels.is_empty());
    }

    #[test]
    fn drops_issues_without_an_https_url_and_rejects_bad_json() {
        let text = r#"[{"number": 1, "title": "x", "url": "javascript:alert(1)"}]"#;
        assert!(parse_issues(text).unwrap().is_empty());
        assert!(parse_issues("not json").is_err());
    }
}
