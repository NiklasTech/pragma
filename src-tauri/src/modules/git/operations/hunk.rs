use std::collections::HashSet;
use std::ffi::OsString;

use serde::Deserialize;

use crate::modules::git::errors::{GitError, Result};
use crate::modules::git::process::{
    ensure_git_available, ensure_success, run_git, run_git_with_input,
};
use crate::modules::git::types::DEFAULT_TIMEOUT_SECS;
use crate::modules::git::utils::authorized_repo_root;

use super::pathspec_from_input;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LineAction {
    Stage,
    Unstage,
    Discard,
}

/// Changed lines to act on: removed lines by their old number, added lines by their new number.
#[derive(Debug, Clone, Default, Deserialize)]
pub struct LineSelection {
    #[serde(default)]
    pub old_lines: Vec<u32>,
    #[serde(default)]
    pub new_lines: Vec<u32>,
}

/// Stages, unstages or discards the selected changed lines of one file.
pub fn apply_lines(
    repo_root: &str,
    path: &str,
    action: LineAction,
    selection: &LineSelection,
) -> Result<()> {
    let repo_root = authorized_repo_root(repo_root)?;
    ensure_git_available()?;
    let spec = pathspec_from_input(&repo_root, path)?;
    let root = repo_root.to_string_lossy();

    let staged = action == LineAction::Unstage;
    let mut diff_args: Vec<OsString> = vec![
        "-c".into(),
        "core.quotePath=false".into(),
        "diff".into(),
        "--no-ext-diff".into(),
        "--no-color".into(),
        "--no-renames".into(),
        "--src-prefix=a/".into(),
        "--dst-prefix=b/".into(),
    ];
    if staged {
        diff_args.push("--cached".into());
    }
    diff_args.push("--".into());
    diff_args.push(spec.into());
    let output = run_git(Some(&root), diff_args, DEFAULT_TIMEOUT_SECS)?;
    ensure_success(&output, "git diff failed")?;
    if output.truncated {
        return Err(GitError::command(
            "partial change failed",
            "the diff is too large",
        ));
    }
    let diff_text = String::from_utf8(output.stdout)
        .map_err(|_| GitError::command("partial change failed", "the diff is not valid UTF-8"))?;

    let reverse = action != LineAction::Stage;
    let patch = build_partial_patch(&diff_text, selection, reverse)?;

    let mut apply_args: Vec<OsString> = vec!["apply".into(), "--whitespace=nowarn".into()];
    if action != LineAction::Discard {
        apply_args.push("--cached".into());
    }
    if reverse {
        apply_args.push("--reverse".into());
    }
    apply_args.push("-".into());
    let output = run_git_with_input(&root, apply_args, patch.as_bytes(), DEFAULT_TIMEOUT_SECS)?;
    ensure_success(&output, "git apply failed")
}

struct Hunk<'a> {
    old_start: u32,
    new_start: u32,
    lines: Vec<&'a str>,
}

/// A hunk line with its line number on its own side and a trailing "no newline" marker.
struct PatchLine<'a> {
    kind: char,
    content: &'a str,
    number: u32,
    marker: Option<&'a str>,
}

fn number_lines<'a>(hunk: &Hunk<'a>) -> Vec<PatchLine<'a>> {
    let mut out: Vec<PatchLine<'a>> = Vec::with_capacity(hunk.lines.len());
    let mut old_no = hunk.old_start.max(1);
    let mut new_no = hunk.new_start.max(1);
    for line in &hunk.lines {
        let kind = line.chars().next().unwrap_or(' ');
        if kind == '\\' {
            if let Some(last) = out.last_mut() {
                last.marker = Some(line);
            }
            continue;
        }
        let number = match kind {
            '-' => {
                old_no += 1;
                old_no - 1
            }
            '+' => {
                new_no += 1;
                new_no - 1
            }
            _ => {
                old_no += 1;
                new_no += 1;
                old_no - 1
            }
        };
        out.push(PatchLine {
            kind: if kind == '-' || kind == '+' {
                kind
            } else {
                ' '
            },
            content: line.get(1..).unwrap_or(""),
            number,
            marker: None,
        });
    }
    out
}

#[derive(Default)]
struct HunkBody {
    lines: Vec<String>,
    old_count: i64,
    new_count: i64,
}

impl HunkBody {
    fn push(&mut self, kind: char, line: &PatchLine) {
        self.lines.push(format!("{kind}{}", line.content));
        if let Some(marker) = line.marker {
            self.lines.push(marker.to_string());
        }
        if kind != '+' {
            self.old_count += 1;
        }
        if kind != '-' {
            self.new_count += 1;
        }
    }
}

/// Keeps only the selected changes of `diff_text`. A forward patch is applied to the old side,
/// a reverse patch is applied with `--reverse` to the new side.
fn build_partial_patch(
    diff_text: &str,
    selection: &LineSelection,
    reverse: bool,
) -> Result<String> {
    let (header, hunks) = parse_file_diff(diff_text)?;
    let old_selected: HashSet<u32> = selection.old_lines.iter().copied().collect();
    let new_selected: HashSet<u32> = selection.new_lines.iter().copied().collect();

    let mut out_hunks: Vec<String> = Vec::new();
    let mut selected_any = false;
    let mut skipped_any = false;
    let mut delta: i64 = 0;

    for hunk in &hunks {
        let lines = number_lines(hunk);
        let mut body = HunkBody::default();
        let mut changed = false;
        let mut i = 0;

        while i < lines.len() {
            if lines[i].kind == ' ' {
                body.push(' ', &lines[i]);
                i += 1;
                continue;
            }
            let block_end = lines[i..]
                .iter()
                .position(|l| l.kind == ' ')
                .map_or(lines.len(), |p| i + p);
            let (removed, added): (Vec<&PatchLine>, Vec<&PatchLine>) =
                lines[i..block_end].iter().partition(|l| l.kind == '-');
            let is_old = |l: &PatchLine| old_selected.contains(&l.number);
            let is_new = |l: &PatchLine| new_selected.contains(&l.number);
            changed |= removed.iter().any(|l| is_old(l)) || added.iter().any(|l| is_new(l));
            skipped_any |= removed.iter().any(|l| !is_old(l)) || added.iter().any(|l| !is_new(l));

            if reverse {
                // Selected removals go back in front of the first selected addition.
                let split = added.iter().position(|l| is_new(l)).unwrap_or(0);
                for line in &added[..split] {
                    body.push(' ', line);
                }
                for line in removed.iter().filter(|l| is_old(l)) {
                    body.push('-', line);
                }
                for line in &added[split..] {
                    body.push(if is_new(line) { '+' } else { ' ' }, line);
                }
            } else {
                // Selected additions go right after the last selected removal.
                let split = removed
                    .iter()
                    .rposition(|l| is_old(l))
                    .map_or(removed.len(), |p| p + 1);
                for line in &removed[..split] {
                    body.push(if is_old(line) { '-' } else { ' ' }, line);
                }
                for line in added.iter().filter(|l| is_new(l)) {
                    body.push('+', line);
                }
                for line in &removed[split..] {
                    body.push(' ', line);
                }
            }
            i = block_end;
        }
        let HunkBody {
            lines: body,
            old_count,
            new_count,
        } = body;

        if !changed {
            skipped_any = true;
            continue;
        }
        selected_any = true;

        let (old_start, new_start) = if reverse {
            let first_new = first_line(hunk.new_start, new_count);
            let first_old = first_new - delta;
            (range_start(first_old, old_count), i64::from(hunk.new_start))
        } else {
            let first_old = first_line(hunk.old_start, old_count);
            let first_new = first_old + delta;
            (i64::from(hunk.old_start), range_start(first_new, new_count))
        };
        delta += new_count - old_count;

        out_hunks.push(format!(
            "@@ -{old_start},{old_count} +{new_start},{new_count} @@\n{}\n",
            body.join("\n")
        ));
    }

    if !selected_any {
        return Err(GitError::command(
            "partial change failed",
            "no changed lines are selected",
        ));
    }
    if !skipped_any {
        let mut full = diff_text.to_string();
        if !full.ends_with('\n') {
            full.push('\n');
        }
        return Ok(full);
    }

    let mut patch = rewrite_header(&header);
    for hunk in out_hunks {
        patch.push_str(&hunk);
    }
    Ok(patch)
}

/// The first line a hunk side covers; an empty side names the line before it.
fn first_line(start: u32, count: i64) -> i64 {
    if count == 0 {
        i64::from(start) + 1
    } else {
        i64::from(start)
    }
}

fn range_start(first: i64, count: i64) -> i64 {
    if count == 0 {
        (first - 1).max(0)
    } else {
        first.max(1)
    }
}

fn parse_file_diff(diff_text: &str) -> Result<(Vec<&str>, Vec<Hunk<'_>>)> {
    let mut header: Vec<&str> = Vec::new();
    let mut hunks: Vec<Hunk<'_>> = Vec::new();
    let mut files = 0;

    // Split on '\n' only, so CRLF content lines keep their '\r'.
    for line in diff_text
        .strip_suffix('\n')
        .unwrap_or(diff_text)
        .split('\n')
    {
        if line.starts_with("diff --git ") {
            files += 1;
            if files > 1 {
                return Err(GitError::command(
                    "partial change failed",
                    "the diff covers more than one file",
                ));
            }
        }
        if line.starts_with("Binary files ") || line.starts_with("GIT binary patch") {
            return Err(GitError::command(
                "partial change failed",
                "binary files can only be changed as a whole",
            ));
        }
        if line.starts_with("@@") {
            let (old_start, new_start) = parse_hunk_header(line)?;
            hunks.push(Hunk {
                old_start,
                new_start,
                lines: Vec::new(),
            });
            continue;
        }
        match hunks.last_mut() {
            Some(hunk) => hunk.lines.push(line),
            None => header.push(line),
        }
    }

    if hunks.is_empty() {
        return Err(GitError::command(
            "partial change failed",
            "the file has no changes to apply",
        ));
    }
    Ok((header, hunks))
}

fn parse_hunk_header(line: &str) -> Result<(u32, u32)> {
    let invalid = || {
        GitError::command(
            "partial change failed",
            format!("invalid hunk header {line}"),
        )
    };
    let mut parts = line.split_whitespace().skip(1);
    let old = parts
        .next()
        .and_then(|p| p.strip_prefix('-'))
        .ok_or_else(invalid)?;
    let new = parts
        .next()
        .and_then(|p| p.strip_prefix('+'))
        .ok_or_else(invalid)?;
    let start = |range: &str| -> Result<u32> {
        range
            .split(',')
            .next()
            .and_then(|n| n.parse::<u32>().ok())
            .ok_or_else(invalid)
    };
    Ok((start(old)?, start(new)?))
}

/// Turns a created or deleted file header into a plain modification, so a partial patch keeps
/// the file on both sides.
fn rewrite_header(header: &[&str]) -> String {
    let old_path = header
        .iter()
        .find_map(|l| l.strip_prefix("--- "))
        .unwrap_or("/dev/null");
    let new_path = header
        .iter()
        .find_map(|l| l.strip_prefix("+++ "))
        .unwrap_or("/dev/null");
    let swap_prefix = |path: &str, from: char, to: char| -> String {
        let quoted = path.starts_with('"');
        let rest = path.trim_start_matches('"');
        let rest = rest.strip_prefix(&format!("{from}/")).unwrap_or(rest);
        if quoted {
            format!("\"{to}/{rest}")
        } else {
            format!("{to}/{rest}")
        }
    };
    let old_side = if old_path == "/dev/null" {
        swap_prefix(new_path, 'b', 'a')
    } else {
        old_path.to_string()
    };
    let new_side = if new_path == "/dev/null" {
        swap_prefix(old_path, 'a', 'b')
    } else {
        new_path.to_string()
    };

    let mut out = String::new();
    if let Some(line) = header.iter().find(|l| l.starts_with("diff --git ")) {
        out.push_str(line);
        out.push('\n');
    }
    out.push_str(&format!("--- {old_side}\n+++ {new_side}\n"));
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modules::git::operations::test_support::TestRepo;

    const BASE: &str =
        "one\ntwo\nthree\nfour\nfive\nsix\nseven\neight\nnine\nten\neleven\ntwelve\n";

    fn repo_with_base() -> TestRepo {
        let repo = TestRepo::new();
        repo.write("file.txt", BASE);
        repo.commit_all("base");
        repo
    }

    fn select(old_lines: &[u32], new_lines: &[u32]) -> LineSelection {
        LineSelection {
            old_lines: old_lines.to_vec(),
            new_lines: new_lines.to_vec(),
        }
    }

    fn index_content(repo: &TestRepo, path: &str) -> String {
        let output = std::process::Command::new("git")
            .args(["show", &format!(":{path}")])
            .current_dir(&repo.root)
            .output()
            .expect("spawn git");
        String::from_utf8_lossy(&output.stdout).into_owned()
    }

    #[test]
    fn stages_one_hunk_and_leaves_the_other_unstaged() {
        let repo = repo_with_base();
        let changed = BASE
            .replace("two\n", "TWO\n")
            .replace("eleven\n", "ELEVEN\n");
        repo.write("file.txt", &changed);

        apply_lines(
            &repo.root,
            "file.txt",
            LineAction::Stage,
            &select(&[2], &[2]),
        )
        .unwrap();

        assert_eq!(
            index_content(&repo, "file.txt"),
            BASE.replace("two\n", "TWO\n")
        );
        assert_eq!(repo.read("file.txt"), changed);
    }

    #[test]
    fn stages_selected_added_lines_only() {
        let repo = repo_with_base();
        repo.write(
            "file.txt",
            &BASE.replace("three\n", "three\nadd-a\nadd-b\n"),
        );

        apply_lines(
            &repo.root,
            "file.txt",
            LineAction::Stage,
            &select(&[], &[5]),
        )
        .unwrap();

        assert_eq!(
            index_content(&repo, "file.txt"),
            BASE.replace("three\n", "three\nadd-b\n")
        );
    }

    #[test]
    fn stages_selected_removed_lines_only() {
        let repo = repo_with_base();
        repo.write("file.txt", &BASE.replace("four\nfive\n", ""));

        apply_lines(
            &repo.root,
            "file.txt",
            LineAction::Stage,
            &select(&[5], &[]),
        )
        .unwrap();

        assert_eq!(index_content(&repo, "file.txt"), BASE.replace("five\n", ""));
    }

    #[test]
    fn stages_part_of_a_mixed_hunk() {
        let repo = repo_with_base();
        repo.write("file.txt", &BASE.replace("six\nseven\n", "SIX\nSEVEN\n"));

        apply_lines(
            &repo.root,
            "file.txt",
            LineAction::Stage,
            &select(&[6], &[6]),
        )
        .unwrap();

        assert_eq!(
            index_content(&repo, "file.txt"),
            BASE.replace("six\n", "SIX\n")
        );
    }

    #[test]
    fn stages_the_second_line_of_a_replaced_block() {
        let repo = repo_with_base();
        repo.write("file.txt", &BASE.replace("six\nseven\n", "SIX\nSEVEN\n"));

        apply_lines(
            &repo.root,
            "file.txt",
            LineAction::Stage,
            &select(&[7], &[7]),
        )
        .unwrap();

        assert_eq!(
            index_content(&repo, "file.txt"),
            BASE.replace("seven\n", "SEVEN\n")
        );
    }

    #[test]
    fn discards_part_of_a_replaced_block() {
        let repo = repo_with_base();
        repo.write("file.txt", &BASE.replace("six\nseven\n", "SIX\nSEVEN\n"));

        apply_lines(
            &repo.root,
            "file.txt",
            LineAction::Discard,
            &select(&[6], &[6]),
        )
        .unwrap();

        assert_eq!(repo.read("file.txt"), BASE.replace("seven\n", "SEVEN\n"));
    }

    #[test]
    fn keeps_crlf_line_endings() {
        let repo = TestRepo::new();
        repo.write("crlf.txt", "a\r\nb\r\n");
        repo.commit_all("crlf");
        repo.write("crlf.txt", "A\r\nB\r\n");

        apply_lines(
            &repo.root,
            "crlf.txt",
            LineAction::Stage,
            &select(&[1], &[1]),
        )
        .unwrap();

        assert_eq!(index_content(&repo, "crlf.txt"), "A\r\nb\r\n");
    }

    #[test]
    fn stages_a_later_hunk_after_an_unselected_earlier_one() {
        let repo = repo_with_base();
        let changed = BASE
            .replace("one\n", "one\nextra-1\nextra-2\n")
            .replace("twelve\n", "TWELVE\n");
        repo.write("file.txt", &changed);

        apply_lines(
            &repo.root,
            "file.txt",
            LineAction::Stage,
            &select(&[12], &[14]),
        )
        .unwrap();

        assert_eq!(
            index_content(&repo, "file.txt"),
            BASE.replace("twelve\n", "TWELVE\n")
        );
    }

    #[test]
    fn unstages_selected_lines() {
        let repo = repo_with_base();
        let changed = BASE
            .replace("two\n", "TWO\n")
            .replace("eleven\n", "ELEVEN\n");
        repo.write("file.txt", &changed);
        repo.git(&["add", "file.txt"]);

        apply_lines(
            &repo.root,
            "file.txt",
            LineAction::Unstage,
            &select(&[11], &[11]),
        )
        .unwrap();

        assert_eq!(
            index_content(&repo, "file.txt"),
            BASE.replace("two\n", "TWO\n")
        );
        assert_eq!(repo.read("file.txt"), changed);
    }

    #[test]
    fn unstages_one_added_line_of_a_new_file() {
        let repo = repo_with_base();
        repo.write("new.txt", "a\nb\nc\n");
        repo.git(&["add", "new.txt"]);

        apply_lines(
            &repo.root,
            "new.txt",
            LineAction::Unstage,
            &select(&[], &[2]),
        )
        .unwrap();

        assert_eq!(index_content(&repo, "new.txt"), "a\nc\n");
    }

    #[test]
    fn unstaging_every_line_of_a_new_file_removes_it_from_the_index() {
        let repo = repo_with_base();
        repo.write("new.txt", "a\nb\n");
        repo.git(&["add", "new.txt"]);

        apply_lines(
            &repo.root,
            "new.txt",
            LineAction::Unstage,
            &select(&[], &[1, 2]),
        )
        .unwrap();

        assert!(repo.git(&["ls-files", "--", "new.txt"]).is_empty());
        assert_eq!(repo.read("new.txt"), "a\nb\n");
    }

    #[test]
    fn discards_selected_lines_in_the_worktree() {
        let repo = repo_with_base();
        repo.write(
            "file.txt",
            &BASE
                .replace("two\n", "TWO\n")
                .replace("eleven\n", "ELEVEN\n"),
        );

        apply_lines(
            &repo.root,
            "file.txt",
            LineAction::Discard,
            &select(&[2], &[2]),
        )
        .unwrap();

        assert_eq!(repo.read("file.txt"), BASE.replace("eleven\n", "ELEVEN\n"));
    }

    #[test]
    fn discards_an_added_line_and_keeps_its_neighbor() {
        let repo = repo_with_base();
        repo.write(
            "file.txt",
            &BASE.replace("three\n", "three\nadd-a\nadd-b\n"),
        );

        apply_lines(
            &repo.root,
            "file.txt",
            LineAction::Discard,
            &select(&[], &[4]),
        )
        .unwrap();

        assert_eq!(
            repo.read("file.txt"),
            BASE.replace("three\n", "three\nadd-b\n")
        );
    }

    #[test]
    fn discard_keeps_staged_lines() {
        let repo = repo_with_base();
        repo.write("file.txt", &BASE.replace("two\n", "TWO\n"));
        repo.git(&["add", "file.txt"]);
        repo.write(
            "file.txt",
            &BASE.replace("two\n", "TWO\n").replace("ten\n", "TEN\n"),
        );

        apply_lines(
            &repo.root,
            "file.txt",
            LineAction::Discard,
            &select(&[10], &[10]),
        )
        .unwrap();

        assert_eq!(repo.read("file.txt"), BASE.replace("two\n", "TWO\n"));
    }

    #[test]
    fn stages_a_change_to_the_last_line_without_newline() {
        let repo = TestRepo::new();
        repo.write("file.txt", "a\nb");
        repo.commit_all("no newline");
        repo.write("file.txt", "A\nb\nc");

        apply_lines(
            &repo.root,
            "file.txt",
            LineAction::Stage,
            &select(&[1], &[1]),
        )
        .unwrap();

        assert_eq!(index_content(&repo, "file.txt"), "A\nb");
    }

    #[test]
    fn rejects_an_empty_selection() {
        let repo = repo_with_base();
        repo.write("file.txt", &BASE.replace("two\n", "TWO\n"));

        let result = apply_lines(&repo.root, "file.txt", LineAction::Stage, &select(&[], &[]));

        assert!(result.is_err());
        assert_eq!(index_content(&repo, "file.txt"), BASE);
    }

    #[test]
    fn rejects_a_file_without_changes() {
        let repo = repo_with_base();

        let result = apply_lines(
            &repo.root,
            "file.txt",
            LineAction::Stage,
            &select(&[1], &[1]),
        );

        assert!(result.is_err());
    }

    #[test]
    fn rejects_paths_outside_the_repository() {
        let repo = repo_with_base();
        std::fs::write(repo.outside_path("outside.txt"), "secret\n").unwrap();

        let result = apply_lines(
            &repo.root,
            "../outside.txt",
            LineAction::Stage,
            &select(&[1], &[]),
        );

        assert!(matches!(result, Err(GitError::PathOutsideWorkspace(_))));
    }
}
