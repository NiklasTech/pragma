use std::ffi::OsString;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::modules::git::errors::{GitError, Result};
use crate::modules::git::process::{git_stdout_line_opt, read_text_file, run_program};
use crate::modules::git::types::{
    GitOutput, TextSource, DEFAULT_TIMEOUT_SECS, NETWORK_TIMEOUT_SECS,
};
use crate::modules::git::utils::authorized_repo_root;
use crate::platform::resolve_program;

const GH_ENV: [(&str, &str); 3] = [
    ("GH_PROMPT_DISABLED", "1"),
    ("GH_NO_UPDATE_NOTIFIER", "1"),
    ("NO_COLOR", "1"),
];
const PR_TEMPLATE_PATHS: [&str; 2] = [
    ".github/pull_request_template.md",
    ".github/PULL_REQUEST_TEMPLATE.md",
];
const MAX_TITLE_CHARS: usize = 256;
const MAX_BODY_CHARS: usize = 65_536;
const MAX_LABELS: usize = 20;
const MAX_LABEL_CHARS: usize = 100;
const MAX_REF_CHARS: usize = 255;

#[derive(Serialize)]
pub struct GhCliStatus {
    pub installed: bool,
    pub authenticated: bool,
}

#[derive(Serialize)]
pub struct GhPrCreateOptions {
    pub template: Option<String>,
    pub labels: Vec<String>,
    pub default_branch: Option<String>,
}

#[derive(Serialize, Default, Debug, PartialEq)]
pub struct GhChecksSummary {
    pub total: u32,
    pub passing: u32,
    pub failing: u32,
    pub pending: u32,
}

#[derive(Serialize)]
pub struct GhPullRequest {
    pub number: u64,
    pub title: String,
    pub url: String,
    pub state: String,
    pub is_draft: bool,
    pub base_ref: String,
    pub checks: GhChecksSummary,
}

#[derive(Serialize)]
pub struct GhReviewComment {
    pub author: String,
    pub body: String,
    pub path: Option<String>,
    pub line: Option<u64>,
    pub state: Option<String>,
}

#[derive(Deserialize)]
pub struct GhPrCreateInput {
    pub title: String,
    pub body: String,
    pub base: String,
    pub labels: Vec<String>,
    pub draft: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawPullRequest {
    number: u64,
    title: String,
    url: String,
    state: String,
    is_draft: bool,
    base_ref_name: String,
    #[serde(default)]
    status_check_rollup: Option<Vec<RawCheck>>,
}

/// A check run carries `status`/`conclusion`, a commit status context carries `state`.
#[derive(Deserialize)]
struct RawCheck {
    status: Option<String>,
    conclusion: Option<String>,
    state: Option<String>,
}

#[derive(Deserialize)]
struct RawLogin {
    login: Option<String>,
}

#[derive(Deserialize)]
struct RawReview {
    author: Option<RawLogin>,
    body: Option<String>,
    state: Option<String>,
}

#[derive(Deserialize)]
struct RawReviews {
    #[serde(default)]
    reviews: Vec<RawReview>,
}

#[derive(Deserialize)]
struct RawInlineComment {
    user: Option<RawLogin>,
    body: Option<String>,
    path: Option<String>,
    line: Option<u64>,
    original_line: Option<u64>,
}

#[derive(Deserialize)]
struct RawLabel {
    name: String,
}

fn gh_program() -> Option<PathBuf> {
    resolve_program("gh").ok()
}

fn run_gh<I, S>(program: &Path, repo_root: &Path, args: I, timeout_secs: u64) -> Result<GitOutput>
where
    I: IntoIterator<Item = S>,
    S: AsRef<std::ffi::OsStr>,
{
    run_program(
        program.as_os_str(),
        Some(&repo_root.to_string_lossy()),
        args,
        &GH_ENV,
        timeout_secs,
    )
}

fn gh_stdout(output: GitOutput, context: &'static str) -> Result<String> {
    if output.timed_out {
        return Err(GitError::TimedOut(context));
    }
    if output.exit_code != Some(0) {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let detail = stderr.trim();
        return Err(GitError::command(
            context,
            if detail.is_empty() {
                "non-zero exit code"
            } else {
                detail
            },
        ));
    }
    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

fn require_gh() -> Result<PathBuf> {
    gh_program().ok_or_else(|| {
        GitError::command(
            "GitHub CLI not found",
            "install gh from https://cli.github.com",
        )
    })
}

fn parse_json<T: for<'de> Deserialize<'de>>(text: &str, context: &'static str) -> Result<T> {
    serde_json::from_str(text).map_err(|e| GitError::command(context, e.to_string()))
}

pub fn cli_status(repo_root: &str) -> Result<GhCliStatus> {
    let repo_root = authorized_repo_root(repo_root)?;
    let Some(program) = gh_program() else {
        return Ok(GhCliStatus {
            installed: false,
            authenticated: false,
        });
    };
    let version = run_gh(&program, &repo_root, ["--version"], DEFAULT_TIMEOUT_SECS)?;
    if version.timed_out || version.exit_code != Some(0) {
        return Ok(GhCliStatus {
            installed: false,
            authenticated: false,
        });
    }
    let auth = run_gh(
        &program,
        &repo_root,
        ["auth", "status"],
        DEFAULT_TIMEOUT_SECS,
    )?;
    Ok(GhCliStatus {
        installed: true,
        authenticated: !auth.timed_out && auth.exit_code == Some(0),
    })
}

fn read_pr_template(repo_root: &Path) -> Result<Option<String>> {
    for rel in PR_TEMPLATE_PATHS {
        if let TextSource::Text(text) = read_text_file(&repo_root.join(rel))? {
            return Ok(Some(text));
        }
    }
    Ok(None)
}

pub fn create_options(repo_root: &str) -> Result<GhPrCreateOptions> {
    let repo_root = authorized_repo_root(repo_root)?;
    let program = require_gh()?;
    let template = read_pr_template(&repo_root)?;

    let labels_out = run_gh(
        &program,
        &repo_root,
        ["label", "list", "--json", "name", "--limit", "200"],
        NETWORK_TIMEOUT_SECS,
    )?;
    let labels = match gh_stdout(labels_out, "gh label list failed") {
        Ok(text) => parse_json::<Vec<RawLabel>>(&text, "invalid label list")?
            .into_iter()
            .map(|label| label.name)
            .collect(),
        Err(_) => Vec::new(),
    };

    let repo_out = run_gh(
        &program,
        &repo_root,
        [
            "repo",
            "view",
            "--json",
            "defaultBranchRef",
            "--jq",
            ".defaultBranchRef.name",
        ],
        NETWORK_TIMEOUT_SECS,
    )?;
    let default_branch = gh_stdout(repo_out, "gh repo view failed")
        .ok()
        .map(|text| text.trim().to_string())
        .filter(|name| !name.is_empty());

    Ok(GhPrCreateOptions {
        template,
        labels,
        default_branch,
    })
}

fn summarize_checks(checks: &[RawCheck]) -> GhChecksSummary {
    let mut summary = GhChecksSummary::default();
    for check in checks {
        summary.total += 1;
        let outcome = if let Some(state) = check.state.as_deref() {
            match state {
                "SUCCESS" => "pass",
                "PENDING" | "EXPECTED" => "pending",
                _ => "fail",
            }
        } else if check.status.as_deref() != Some("COMPLETED") {
            "pending"
        } else {
            match check.conclusion.as_deref() {
                Some("SUCCESS" | "NEUTRAL" | "SKIPPED") => "pass",
                _ => "fail",
            }
        };
        match outcome {
            "pass" => summary.passing += 1,
            "pending" => summary.pending += 1,
            _ => summary.failing += 1,
        }
    }
    summary
}

fn parse_pull_request(text: &str) -> Result<GhPullRequest> {
    let raw: RawPullRequest = parse_json(text, "invalid pull request data")?;
    let checks = summarize_checks(raw.status_check_rollup.as_deref().unwrap_or(&[]));
    Ok(GhPullRequest {
        number: raw.number,
        title: raw.title,
        url: raw.url,
        state: raw.state,
        is_draft: raw.is_draft,
        base_ref: raw.base_ref_name,
        checks,
    })
}

/// The pull request of the current branch, or `None` when the branch has none.
pub fn current_pull_request(repo_root: &str) -> Result<Option<GhPullRequest>> {
    let repo_root = authorized_repo_root(repo_root)?;
    let program = require_gh()?;
    let output = run_gh(
        &program,
        &repo_root,
        [
            "pr",
            "view",
            "--json",
            "number,title,url,state,isDraft,baseRefName,statusCheckRollup",
        ],
        NETWORK_TIMEOUT_SECS,
    )?;
    if !output.timed_out && output.exit_code != Some(0) {
        let stderr = String::from_utf8_lossy(&output.stderr).to_ascii_lowercase();
        if stderr.contains("no pull requests found") {
            return Ok(None);
        }
    }
    let text = gh_stdout(output, "gh pr view failed")?;
    parse_pull_request(&text).map(Some)
}

fn is_safe_ref(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= MAX_REF_CHARS
        && !name.starts_with('-')
        && !name.contains("..")
        && !name
            .chars()
            .any(|c| c.is_whitespace() || c.is_control() || "~^:?*[\\".contains(c))
}

fn validate_create_input(input: &GhPrCreateInput) -> Result<()> {
    let title = input.title.trim();
    if title.is_empty() || title.chars().count() > MAX_TITLE_CHARS {
        return Err(GitError::command(
            "invalid pull request",
            format!("title must be 1 to {MAX_TITLE_CHARS} characters"),
        ));
    }
    if input.body.chars().count() > MAX_BODY_CHARS {
        return Err(GitError::command(
            "invalid pull request",
            format!("body must be {MAX_BODY_CHARS} characters or fewer"),
        ));
    }
    if !is_safe_ref(&input.base) {
        return Err(GitError::command(
            "invalid pull request",
            "invalid base branch",
        ));
    }
    if input.labels.len() > MAX_LABELS {
        return Err(GitError::command(
            "invalid pull request",
            format!("at most {MAX_LABELS} labels are allowed"),
        ));
    }
    for label in &input.labels {
        let label = label.trim();
        if label.is_empty()
            || label.chars().count() > MAX_LABEL_CHARS
            || label.contains(',')
            || label.chars().any(|c| c.is_control())
        {
            return Err(GitError::command("invalid pull request", "invalid label"));
        }
    }
    Ok(())
}

fn create_args(input: &GhPrCreateInput, head: &str) -> Vec<OsString> {
    let mut args: Vec<OsString> = vec![
        "pr".into(),
        "create".into(),
        format!("--title={}", input.title.trim()).into(),
        format!("--body={}", input.body).into(),
        format!("--base={}", input.base).into(),
        format!("--head={head}").into(),
    ];
    if input.draft {
        args.push("--draft".into());
    }
    for label in &input.labels {
        args.push(format!("--label={}", label.trim()).into());
    }
    args
}

/// Creates a pull request for the current branch, which must already be pushed.
pub fn create_pull_request(repo_root: &str, input: &GhPrCreateInput) -> Result<String> {
    validate_create_input(input)?;
    let repo_root = authorized_repo_root(repo_root)?;
    let program = require_gh()?;
    let head = git_stdout_line_opt(
        &repo_root.to_string_lossy(),
        ["rev-parse", "--abbrev-ref", "HEAD"],
    )?
    .filter(|branch| branch != "HEAD")
    .ok_or_else(|| GitError::command("cannot create a pull request", "HEAD is detached"))?;
    if head == input.base {
        return Err(GitError::command(
            "cannot create a pull request",
            "the base branch is the current branch",
        ));
    }
    let output = run_gh(
        &program,
        &repo_root,
        create_args(input, &head),
        NETWORK_TIMEOUT_SECS,
    )?;
    let text = gh_stdout(output, "gh pr create failed")?;
    Ok(text
        .lines()
        .rev()
        .find(|line| line.trim().starts_with("https://"))
        .unwrap_or("")
        .trim()
        .to_string())
}

fn login(raw: Option<RawLogin>) -> String {
    raw.and_then(|user| user.login)
        .unwrap_or_else(|| "unknown".to_string())
}

/// Review summaries and inline review comments of a pull request.
pub fn review_comments(repo_root: &str, number: u64) -> Result<Vec<GhReviewComment>> {
    if number == 0 {
        return Err(GitError::command(
            "invalid pull request",
            "number is required",
        ));
    }
    let repo_root = authorized_repo_root(repo_root)?;
    let program = require_gh()?;
    let number_arg = number.to_string();

    let reviews_out = run_gh(
        &program,
        &repo_root,
        ["pr", "view", number_arg.as_str(), "--json", "reviews"],
        NETWORK_TIMEOUT_SECS,
    )?;
    let reviews: RawReviews = parse_json(
        &gh_stdout(reviews_out, "gh pr view failed")?,
        "invalid review data",
    )?;

    let endpoint = format!("repos/{{owner}}/{{repo}}/pulls/{number}/comments?per_page=100");
    let inline_out = run_gh(
        &program,
        &repo_root,
        ["api", endpoint.as_str()],
        NETWORK_TIMEOUT_SECS,
    )?;
    let inline: Vec<RawInlineComment> = parse_json(
        &gh_stdout(inline_out, "gh api failed")?,
        "invalid review comment data",
    )?;

    let mut comments: Vec<GhReviewComment> = reviews
        .reviews
        .into_iter()
        .filter(|review| review.body.as_deref().is_some_and(|b| !b.trim().is_empty()))
        .map(|review| GhReviewComment {
            author: login(review.author),
            body: review.body.unwrap_or_default(),
            path: None,
            line: None,
            state: review.state,
        })
        .collect();
    comments.extend(
        inline
            .into_iter()
            .filter(|comment| {
                comment
                    .body
                    .as_deref()
                    .is_some_and(|b| !b.trim().is_empty())
            })
            .map(|comment| GhReviewComment {
                author: login(comment.user),
                body: comment.body.unwrap_or_default(),
                path: comment.path,
                line: comment.line.or(comment.original_line),
                state: None,
            }),
    );
    Ok(comments)
}

async fn blocking<F, T>(f: F) -> std::result::Result<T, String>
where
    F: FnOnce() -> Result<T> + Send + 'static,
    T: Send + 'static,
{
    tauri::async_runtime::spawn_blocking(move || f().map_err(String::from))
        .await
        .map_err(|e| e.to_string())?
}

fn require_repo_path(repo_path: &str) -> std::result::Result<(), String> {
    if repo_path.is_empty() {
        return Err("Repository path is required".to_string());
    }
    Ok(())
}

#[tauri::command]
pub async fn gh_cli_status(repo_path: String) -> std::result::Result<GhCliStatus, String> {
    require_repo_path(&repo_path)?;
    blocking(move || cli_status(&repo_path)).await
}

#[tauri::command]
pub async fn gh_pr_create_options(
    repo_path: String,
) -> std::result::Result<GhPrCreateOptions, String> {
    require_repo_path(&repo_path)?;
    blocking(move || create_options(&repo_path)).await
}

#[tauri::command]
pub async fn gh_pr_current(
    repo_path: String,
) -> std::result::Result<Option<GhPullRequest>, String> {
    require_repo_path(&repo_path)?;
    blocking(move || current_pull_request(&repo_path)).await
}

#[tauri::command]
pub async fn gh_pr_create(
    repo_path: String,
    input: GhPrCreateInput,
) -> std::result::Result<String, String> {
    require_repo_path(&repo_path)?;
    blocking(move || create_pull_request(&repo_path, &input)).await
}

#[tauri::command]
pub async fn gh_pr_review_comments(
    repo_path: String,
    number: u64,
) -> std::result::Result<Vec<GhReviewComment>, String> {
    require_repo_path(&repo_path)?;
    blocking(move || review_comments(&repo_path, number)).await
}

#[cfg(test)]
mod tests {
    use super::*;

    fn input(title: &str, base: &str, labels: &[&str]) -> GhPrCreateInput {
        GhPrCreateInput {
            title: title.to_string(),
            body: String::new(),
            base: base.to_string(),
            labels: labels.iter().map(|l| l.to_string()).collect(),
            draft: false,
        }
    }

    #[test]
    fn summarizes_check_runs_and_status_contexts() {
        let text = r#"{
            "number": 7,
            "title": "feat: x",
            "url": "https://github.com/o/r/pull/7",
            "state": "OPEN",
            "isDraft": true,
            "baseRefName": "main",
            "statusCheckRollup": [
                {"__typename": "CheckRun", "status": "COMPLETED", "conclusion": "SUCCESS"},
                {"__typename": "CheckRun", "status": "COMPLETED", "conclusion": "SKIPPED"},
                {"__typename": "CheckRun", "status": "COMPLETED", "conclusion": "FAILURE"},
                {"__typename": "CheckRun", "status": "IN_PROGRESS", "conclusion": ""},
                {"__typename": "StatusContext", "state": "PENDING"},
                {"__typename": "StatusContext", "state": "ERROR"}
            ]
        }"#;
        let pr = parse_pull_request(text).expect("parses");
        assert_eq!(pr.number, 7);
        assert!(pr.is_draft);
        assert_eq!(pr.base_ref, "main");
        assert_eq!(
            pr.checks,
            GhChecksSummary {
                total: 6,
                passing: 2,
                failing: 2,
                pending: 2,
            }
        );
    }

    #[test]
    fn missing_rollup_means_no_checks() {
        let text = r#"{"number": 1, "title": "t", "url": "u", "state": "MERGED",
            "isDraft": false, "baseRefName": "main", "statusCheckRollup": null}"#;
        let pr = parse_pull_request(text).expect("parses");
        assert_eq!(pr.checks, GhChecksSummary::default());
    }

    #[test]
    fn validates_create_input() {
        assert!(validate_create_input(&input("feat: x", "main", &["feat"])).is_ok());
        assert!(validate_create_input(&input("   ", "main", &[])).is_err());
        assert!(validate_create_input(&input(&"x".repeat(257), "main", &[])).is_err());
        assert!(validate_create_input(&input("t", "-main", &[])).is_err());
        assert!(validate_create_input(&input("t", "a..b", &[])).is_err());
        assert!(validate_create_input(&input("t", "a b", &[])).is_err());
        assert!(validate_create_input(&input("t", "main", &["a,b"])).is_err());
        assert!(validate_create_input(&input("t", "main", &[" "])).is_err());
    }

    #[test]
    fn create_args_use_equals_form() {
        let mut pr = input("-t", "main", &["feat", "area:git"]);
        pr.body = "--draft".to_string();
        pr.draft = true;
        let args: Vec<String> = create_args(&pr, "feat/x")
            .into_iter()
            .map(|a| a.to_string_lossy().into_owned())
            .collect();
        assert_eq!(
            args,
            vec![
                "pr",
                "create",
                "--title=-t",
                "--body=--draft",
                "--base=main",
                "--head=feat/x",
                "--draft",
                "--label=feat",
                "--label=area:git",
            ]
        );
    }
}
