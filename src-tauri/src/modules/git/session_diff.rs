use std::ffi::OsStr;
use std::io::Read;
use std::path::Path;

use serde::Serialize;

use crate::modules::git::process::run_git;
use crate::modules::git::types::DEFAULT_TIMEOUT_SECS;

#[derive(Debug, Default, PartialEq, Eq, Serialize)]
pub struct SessionDiffStat {
    pub files: u32,
    pub added: u32,
    pub removed: u32,
}

async fn blocking<F, T>(f: F) -> Result<T, String>
where
    F: FnOnce() -> Result<T, String> + Send + 'static,
    T: Send + 'static,
{
    tauri::async_runtime::spawn_blocking(f)
        .await
        .map_err(|e| format!("blocking task failed: {e}"))?
}

fn git_text<I, S>(path: &str, args: I) -> Result<String, String>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    let output = run_git(Some(path), args, DEFAULT_TIMEOUT_SECS)?;
    if output.timed_out {
        return Err("git timed out".to_string());
    }
    if output.exit_code != Some(0) {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

/// Sums `git diff --numstat` output; binary files count as changed files without lines.
fn parse_numstat(text: &str) -> SessionDiffStat {
    let mut stat = SessionDiffStat::default();
    for line in text.lines() {
        let mut parts = line.split('\t');
        let (Some(added), Some(removed), Some(_)) = (parts.next(), parts.next(), parts.next())
        else {
            continue;
        };
        stat.files += 1;
        stat.added += added.parse::<u32>().unwrap_or(0);
        stat.removed += removed.parse::<u32>().unwrap_or(0);
    }
    stat
}

/// Untracked files are new files to the user; count their lines, reading at most 1 MB each.
fn add_untracked(path: &str, stat: &mut SessionDiffStat) -> Result<(), String> {
    const MAX_BYTES: u64 = 1024 * 1024;
    let listing = git_text(path, ["ls-files", "--others", "--exclude-standard", "-z"])?;
    for name in listing.split('\0').filter(|name| !name.is_empty()) {
        stat.files += 1;
        let Ok(file) = std::fs::File::open(Path::new(path).join(name)) else {
            continue;
        };
        let mut bytes = Vec::new();
        if file.take(MAX_BYTES).read_to_end(&mut bytes).is_err() || bytes.contains(&0) {
            continue;
        }
        let lines = bytes.iter().filter(|byte| **byte == b'\n').count();
        let unterminated = usize::from(bytes.last().is_some_and(|byte| *byte != b'\n'));
        stat.added += u32::try_from(lines + unterminated).unwrap_or(u32::MAX);
    }
    Ok(())
}

/// Lines changed in `path` since it branched from `base`, committed or not; without a base, since HEAD.
pub(crate) fn session_diff_stat(path: &str, base: Option<&str>) -> Result<SessionDiffStat, String> {
    if path.is_empty() {
        return Err("Path is required".to_string());
    }
    let from = match base {
        Some(base) => {
            if base.is_empty() || base.starts_with('-') {
                return Err(format!("Invalid base branch: {base}"));
            }
            let reference = format!("refs/heads/{base}");
            git_text(path, ["merge-base", reference.as_str(), "HEAD"])?
                .trim()
                .to_string()
        }
        None => "HEAD".to_string(),
    };
    let text = git_text(path, ["diff", "--numstat", from.as_str(), "--"])?;
    let mut stat = parse_numstat(&text);
    add_untracked(path, &mut stat)?;
    Ok(stat)
}

#[tauri::command]
pub async fn git_session_diff_stat(
    path: String,
    base_branch: Option<String>,
) -> Result<SessionDiffStat, String> {
    blocking(move || session_diff_stat(&path, base_branch.as_deref())).await
}

#[cfg(test)]
mod tests {
    use super::*;

    fn git(dir: &str, args: &[&str]) {
        let output = std::process::Command::new("git")
            .args(["-c", "user.email=t@example.com", "-c", "user.name=T"])
            .args(args)
            .current_dir(dir)
            .output()
            .expect("spawn git");
        assert!(output.status.success(), "git {args:?} failed");
    }

    #[test]
    fn numstat_sums_lines_and_counts_binary_files() {
        let stat = parse_numstat("3\t1\ta.rs\n-\t-\timage.png\n10\t0\tb.rs\n\n");
        assert_eq!(
            stat,
            SessionDiffStat {
                files: 3,
                added: 13,
                removed: 1
            }
        );
    }

    #[test]
    fn counts_commits_and_uncommitted_changes_since_the_base() {
        let dir = tempfile::tempdir().expect("tempdir");
        let path = dir.path().to_string_lossy().to_string();
        git(&path, &["init", "-b", "main"]);
        std::fs::write(dir.path().join("a.txt"), "one\n").expect("write");
        git(&path, &["add", "."]);
        git(&path, &["commit", "-m", "init"]);
        git(&path, &["checkout", "-b", "work"]);
        std::fs::write(dir.path().join("a.txt"), "one\ntwo\n").expect("write");
        git(&path, &["commit", "-am", "two"]);
        std::fs::write(dir.path().join("a.txt"), "two\nthree\n").expect("write");
        std::fs::write(dir.path().join("new.txt"), "x\ny\nz").expect("write");

        let stat = session_diff_stat(&path, Some("main")).expect("stat");
        assert_eq!(stat.files, 2);
        assert_eq!((stat.added, stat.removed), (5, 1));
        assert!(session_diff_stat(&path, Some("--all")).is_err());
        assert_eq!(session_diff_stat(&path, None).expect("head").added, 4);
    }
}
