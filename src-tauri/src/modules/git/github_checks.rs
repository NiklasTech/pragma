use serde::{Deserialize, Serialize};

use crate::modules::git::errors::{GitError, Result};
use crate::modules::git::types::NETWORK_TIMEOUT_SECS;
use crate::modules::git::utils::authorized_repo_root;

use super::github::{blocking, gh_stdout, parse_json, require_gh, require_repo_path, run_gh};

const MAX_EXCERPT_LINES: usize = 60;
const MAX_EXCERPT_CHARS: usize = 6_000;
const MAX_ID_DIGITS: usize = 20;
const ERROR_MARKER: &str = "##[error]";

#[derive(Debug, Serialize, PartialEq)]
pub struct GhCheck {
    pub name: String,
    pub workflow: String,
    /// `gh`'s grouping of the state: pass, fail, pending, skipping or cancel.
    pub bucket: String,
    pub link: String,
}

#[derive(Deserialize)]
struct RawCheck {
    name: String,
    #[serde(default)]
    workflow: String,
    bucket: String,
    #[serde(default)]
    link: String,
}

fn parse_checks(text: &str) -> Result<Vec<GhCheck>> {
    let raw: Vec<RawCheck> = parse_json(text, "invalid check data")?;
    Ok(raw
        .into_iter()
        .map(|check| GhCheck {
            name: check.name,
            workflow: check.workflow,
            bucket: check.bucket,
            link: if check.link.starts_with("https://") {
                check.link
            } else {
                String::new()
            },
        })
        .collect())
}

/// The checks of a pull request's latest commit.
pub fn pull_request_checks(repo_root: &str, number: u64) -> Result<Vec<GhCheck>> {
    if number == 0 {
        return Err(GitError::command(
            "invalid pull request",
            "number must be positive",
        ));
    }
    let repo_root = authorized_repo_root(repo_root)?;
    let program = require_gh()?;
    let number_arg = number.to_string();
    let output = run_gh(
        &program,
        &repo_root,
        [
            "pr",
            "checks",
            number_arg.as_str(),
            "--json",
            "name,workflow,bucket,link",
        ],
        NETWORK_TIMEOUT_SECS,
    )?;
    // `gh pr checks` exits non-zero while checks fail or run, yet still prints them.
    let stdout = String::from_utf8_lossy(&output.stdout);
    if !output.timed_out && stdout.trim_start().starts_with('[') {
        return parse_checks(&stdout);
    }
    if !output.timed_out
        && String::from_utf8_lossy(&output.stderr)
            .to_ascii_lowercase()
            .contains("no checks reported")
    {
        return Ok(Vec::new());
    }
    let text = gh_stdout(output, "gh pr checks failed")?;
    parse_checks(&text)
}

fn digits_after<'a>(text: &'a str, marker: &str) -> Option<&'a str> {
    let rest = &text[text.find(marker)? + marker.len()..];
    let end = rest
        .find(|c: char| !c.is_ascii_digit())
        .unwrap_or(rest.len());
    let digits = &rest[..end];
    (!digits.is_empty() && digits.len() <= MAX_ID_DIGITS).then_some(digits)
}

/// The run and job ids of a GitHub Actions job link, or `None` for any other check.
fn actions_job(link: &str) -> Option<(&str, &str)> {
    if !link.starts_with("https://") {
        return None;
    }
    Some((
        digits_after(link, "/actions/runs/")?,
        digits_after(link, "/job/")?,
    ))
}

/// Length of a color code at the start of `text`, sent as ESC or, by `gh`, spelled out as `^[`.
fn color_code_len(text: &str) -> Option<usize> {
    let prefix = if text.starts_with("\u{1b}[") {
        2
    } else if text.starts_with("^[[") {
        3
    } else {
        return None;
    };
    let rest = &text[prefix..];
    let params = rest
        .find(|c: char| !c.is_ascii_digit() && c != ';')
        .unwrap_or(rest.len());
    rest[params..]
        .chars()
        .next()
        .filter(char::is_ascii_alphabetic)
        .map(|_| prefix + params + 1)
}

fn strip_ansi(line: &str) -> String {
    let mut out = String::with_capacity(line.len());
    let mut rest = line;
    while let Some(c) = rest.chars().next() {
        match color_code_len(rest) {
            Some(len) => rest = &rest[len..],
            None => {
                out.push(c);
                rest = &rest[c.len_utf8()..];
            }
        }
    }
    out
}

fn is_timestamp(word: &str) -> bool {
    let bytes = word.as_bytes();
    word.len() >= 20
        && word.ends_with('Z')
        && bytes[..4].iter().all(u8::is_ascii_digit)
        && bytes[4] == b'-'
        && word.contains('T')
}

/// One line of `gh run view --log-failed`: job, step and timestamp go, color codes too.
fn clean_line(line: &str) -> String {
    let text = line.splitn(3, '\t').nth(2).unwrap_or(line);
    let text = match text.split_once(' ') {
        Some((first, rest)) if is_timestamp(first) => rest,
        _ if is_timestamp(text) => "",
        _ => text,
    };
    strip_ansi(text).trim_end().to_string()
}

/// The lines leading up to the job's last error, which is where the failure shows.
pub(crate) fn failure_excerpt(log: &str) -> String {
    let lines: Vec<String> = log
        .lines()
        .map(clean_line)
        .filter(|line| !line.starts_with("##[group]") && !line.starts_with("##[endgroup]"))
        .collect();
    let end = lines
        .iter()
        .rposition(|line| line.contains(ERROR_MARKER))
        .map_or(lines.len(), |index| index + 1);
    let start = end.saturating_sub(MAX_EXCERPT_LINES);

    let mut kept: Vec<&str> = Vec::new();
    for line in &lines[start..end] {
        if line.is_empty() && kept.last().map_or(true, |last| last.is_empty()) {
            continue;
        }
        kept.push(line);
    }
    let excerpt = kept.join("\n").replace(ERROR_MARKER, "error: ");
    let excerpt = excerpt.trim();
    let count = excerpt.chars().count();
    if count <= MAX_EXCERPT_CHARS {
        return excerpt.to_string();
    }
    // The end of the log names the failure, so a long excerpt keeps its tail.
    let tail: String = excerpt.chars().skip(count - MAX_EXCERPT_CHARS).collect();
    match tail.split_once('\n') {
        Some((_, rest)) => rest.to_string(),
        None => tail,
    }
}

/// The last lines of a failed GitHub Actions job; empty for checks that are not Actions jobs.
pub fn check_failure_log(repo_root: &str, link: &str) -> Result<String> {
    let Some((run_id, job_id)) = actions_job(link) else {
        return Ok(String::new());
    };
    let repo_root = authorized_repo_root(repo_root)?;
    let program = require_gh()?;
    let output = run_gh(
        &program,
        &repo_root,
        ["run", "view", run_id, "--job", job_id, "--log-failed"],
        NETWORK_TIMEOUT_SECS,
    )?;
    let text = gh_stdout(output, "gh run view failed")?;
    Ok(failure_excerpt(&text))
}

#[tauri::command]
pub async fn gh_pr_checks(
    repo_path: String,
    number: u64,
) -> std::result::Result<Vec<GhCheck>, String> {
    require_repo_path(&repo_path)?;
    blocking(move || pull_request_checks(&repo_path, number)).await
}

#[tauri::command]
pub async fn gh_check_failure_log(
    repo_path: String,
    link: String,
) -> std::result::Result<String, String> {
    require_repo_path(&repo_path)?;
    blocking(move || check_failure_log(&repo_path, &link)).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_checks_and_drops_links_that_are_not_https() {
        let text = r#"[
            {"name": "test", "workflow": "CI", "bucket": "fail",
             "link": "https://github.com/o/r/actions/runs/1/job/2"},
            {"name": "status", "bucket": "pass", "link": "javascript:alert(1)"}
        ]"#;
        let checks = parse_checks(text).unwrap();
        assert_eq!(checks.len(), 2);
        assert_eq!(checks[0].bucket, "fail");
        assert_eq!(checks[0].workflow, "CI");
        assert_eq!(checks[1].workflow, "");
        assert_eq!(checks[1].link, "");
    }

    #[test]
    fn finds_run_and_job_ids_in_actions_links() {
        assert_eq!(
            actions_job("https://github.com/o/r/actions/runs/4507/job/1373"),
            Some(("4507", "1373"))
        );
        assert_eq!(
            actions_job("https://github.com/o/r/actions/runs/4507/job/1373?pr=9"),
            Some(("4507", "1373"))
        );
        assert_eq!(actions_job("https://ci.example.com/build/12"), None);
        assert_eq!(
            actions_job("http://github.com/o/r/actions/runs/1/job/2"),
            None
        );
        assert_eq!(
            actions_job("https://github.com/o/r/actions/runs//job/2"),
            None
        );
        let long = format!(
            "https://github.com/o/r/actions/runs/{}/job/2",
            "9".repeat(21)
        );
        assert_eq!(actions_job(&long), None);
    }

    #[test]
    fn cleans_job_step_timestamp_and_colors() {
        let line = "Rust Check\tUNKNOWN STEP\t2026-11-19T18:57:40.0802643Z \u{1b}[1m\u{1b}[91merror[E0277]\u{1b}[0m: bad";
        assert_eq!(clean_line(line), "error[E0277]: bad");
        assert_eq!(clean_line("Job\tStep\t2026-11-19T18:57:40.0802643Z"), "");
        assert_eq!(clean_line("plain text"), "plain text");
    }

    #[test]
    fn strips_color_codes_gh_spells_out() {
        assert_eq!(
            strip_ansi("^[[1m^[[91merror[E0277]^[[0m^[[1m: bad^[[0m"),
            "error[E0277]: bad"
        );
        assert_eq!(
            strip_ansi("matches [^[a-z]] and ^[x"),
            "matches [^[a-z]] and ^[x"
        );
        assert_eq!(strip_ansi("ok ✓ \u{1b}[32mdone\u{1b}[0m"), "ok ✓ done");
    }

    #[test]
    fn excerpt_ends_at_the_last_error_and_skips_cleanup() {
        let mut log = String::new();
        for i in 0..100 {
            log.push_str(&format!(
                "Job\tStep\t2026-11-19T18:57:40.0000000Z line {i}\n"
            ));
        }
        log.push_str("Job\tStep\t2026-11-19T18:57:41.0000000Z ##[error]Process completed with exit code 1.\n");
        log.push_str("Job\tStep\t2026-11-19T18:57:42.0000000Z Cleaning up orphan processes\n");
        let excerpt = failure_excerpt(&log);
        let lines: Vec<&str> = excerpt.lines().collect();
        assert_eq!(lines.len(), MAX_EXCERPT_LINES);
        assert_eq!(lines[0], "line 41");
        assert_eq!(
            lines.last(),
            Some(&"error: Process completed with exit code 1.")
        );
        assert!(!excerpt.contains("Cleaning up"));
    }

    #[test]
    fn excerpt_without_an_error_marker_keeps_the_tail() {
        let log = "a\n##[group]Run tests\nb\n\n\n##[endgroup]\nc\n";
        assert_eq!(failure_excerpt(log), "a\nb\n\nc");
    }

    #[test]
    fn long_excerpts_keep_their_end_from_a_line_start() {
        let line = "x".repeat(200);
        let log = format!("{}\n##[error]boom\n", vec![line; 50].join("\n"));
        let excerpt = failure_excerpt(&log);
        assert!(excerpt.chars().count() <= MAX_EXCERPT_CHARS);
        assert!(excerpt.ends_with("error: boom"));
        assert!(excerpt.starts_with('x'));
        assert!(excerpt
            .lines()
            .next()
            .is_some_and(|first| first.len() == 200));
    }
}
