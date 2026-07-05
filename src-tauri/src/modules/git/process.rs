use std::ffi::{OsStr, OsString};
use std::io::Read;
use std::path::Path;
use std::process::{Command, Stdio};

use crate::platform::new_std_command;
use std::sync::mpsc;
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use std::time::{Duration, Instant};

use shared_child::SharedChild;

use crate::modules::git::errors::{GitError, Result};
use crate::modules::git::types::{
    GitOutput, TextSource, DEFAULT_TIMEOUT_SECS, MAX_FILE_BYTES, MAX_OUTPUT_BYTES,
    MAX_TIMEOUT_SECS, MIN_GIT_VERSION,
};

#[derive(Clone)]
enum Availability {
    Ok,
    NotInstalled,
    TooOld(String),
}

const AVAILABILITY_TTL: Duration = Duration::from_secs(60);

struct AvailabilityCache {
    value: Availability,
    checked_at: Instant,
}

static GIT_AVAILABILITY: OnceLock<Mutex<AvailabilityCache>> = OnceLock::new();

fn availability_cell() -> &'static Mutex<AvailabilityCache> {
    GIT_AVAILABILITY.get_or_init(|| {
        Mutex::new(AvailabilityCache {
            value: Availability::NotInstalled,
            checked_at: Instant::now() - Duration::from_secs(120),
        })
    })
}

fn lock_availability() -> std::sync::MutexGuard<'static, AvailabilityCache> {
    match availability_cell().lock() {
        Ok(g) => g,
        Err(e) => e.into_inner(),
    }
}

pub fn ensure_git_available() -> Result<()> {
    let cached = {
        let guard = lock_availability();
        if guard.checked_at.elapsed() < AVAILABILITY_TTL {
            Some(guard.value.clone())
        } else {
            None
        }
    };
    let value = match cached {
        Some(v) => v,
        None => {
            let fresh = check_git_availability();
            let mut guard = lock_availability();
            guard.value = fresh.clone();
            guard.checked_at = Instant::now();
            fresh
        }
    };
    match value {
        Availability::Ok => Ok(()),
        Availability::NotInstalled => Err(GitError::NotInstalled),
        Availability::TooOld(v) => Err(GitError::TooOld {
            found: v,
            required: MIN_GIT_VERSION,
        }),
    }
}

fn check_git_availability() -> Availability {
    let output = match run_git_uncached(None, ["--version"], 10) {
        Ok(o) => o,
        Err(_) => return Availability::NotInstalled,
    };
    if output.timed_out || output.exit_code != Some(0) {
        return Availability::NotInstalled;
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    let version = parse_git_version(stdout.trim()).unwrap_or_else(|| "unknown".into());
    if !version_meets_minimum(&version, MIN_GIT_VERSION) {
        return Availability::TooOld(version);
    }
    Availability::Ok
}

fn parse_git_version(line: &str) -> Option<String> {
    line.split_whitespace()
        .find(|tok| tok.chars().next().is_some_and(|c| c.is_ascii_digit()))
        .map(|s| s.split('.').take(3).collect::<Vec<_>>().join("."))
}

fn version_meets_minimum(found: &str, required: &str) -> bool {
    let parse = |s: &str| -> Vec<u32> {
        s.split('.')
            .map(|p| p.parse::<u32>().unwrap_or(0))
            .collect()
    };
    let f = parse(found);
    let r = parse(required);
    for (i, &b) in r.iter().enumerate() {
        let a = f.get(i).copied().unwrap_or(0);
        if a > b {
            return true;
        }
        if a < b {
            return false;
        }
    }
    true
}

pub fn git_show_text(repo_root: &str, spec: &str) -> Result<TextSource> {
    let output = run_git(
        Some(repo_root),
        [
            OsStr::new("show"),
            OsStr::new("--no-textconv"),
            OsStr::new(spec),
        ],
        DEFAULT_TIMEOUT_SECS,
    )?;
    if output.timed_out {
        return Err(GitError::TimedOut("git show"));
    }
    if output.exit_code != Some(0) {
        return Ok(TextSource::Missing);
    }
    Ok(decode_text(output.stdout))
}

pub fn git_stdout_line_opt<I, S>(repo_root: &str, args: I) -> Result<Option<String>>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    let output = run_git(Some(repo_root), args, DEFAULT_TIMEOUT_SECS)?;
    if output.timed_out {
        return Err(GitError::TimedOut("git command"));
    }
    if output.exit_code != Some(0) {
        return Ok(None);
    }
    let stdout = std::str::from_utf8(&output.stdout).unwrap_or("");
    let line = stdout.lines().next().unwrap_or("").trim();
    if line.is_empty() {
        Ok(None)
    } else {
        Ok(Some(line.to_string()))
    }
}

pub fn git_stdout_lines<I, S>(repo_root: &str, args: I) -> Result<Vec<String>>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    let output = run_git(Some(repo_root), args, DEFAULT_TIMEOUT_SECS)?;
    if output.timed_out {
        return Err(GitError::TimedOut("git command"));
    }
    if output.exit_code != Some(0) {
        return Ok(Vec::new());
    }
    let stdout = std::str::from_utf8(&output.stdout).unwrap_or("");
    Ok(stdout
        .lines()
        .map(|line| line.trim_end_matches('\r').to_string())
        .collect())
}

pub fn read_text_file(path: &Path) -> Result<TextSource> {
    let meta = match std::fs::symlink_metadata(path) {
        Ok(m) => m,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(TextSource::Missing),
        Err(e) => return Err(GitError::Io(e)),
    };
    if meta.file_type().is_symlink() {
        return Err(GitError::SymlinkRejected(path.to_path_buf()));
    }
    if !meta.is_file() {
        return Ok(TextSource::Missing);
    }
    let size = meta.len();
    if size > MAX_FILE_BYTES {
        return Err(GitError::FileTooLarge {
            path: path.to_path_buf(),
            size,
            max: MAX_FILE_BYTES,
        });
    }
    let bytes = std::fs::read(path)?;
    Ok(decode_text(bytes))
}

pub fn run_git<I, S>(repo_root: Option<&str>, args: I, timeout_secs: u64) -> Result<GitOutput>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    run_git_uncached(repo_root, args, timeout_secs)
}

fn run_git_uncached<I, S>(repo_root: Option<&str>, args: I, timeout_secs: u64) -> Result<GitOutput>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    let dur = Duration::from_secs(timeout_secs.clamp(1, MAX_TIMEOUT_SECS));
    let args: Vec<OsString> = args
        .into_iter()
        .map(|arg| arg.as_ref().to_os_string())
        .collect();
    let mut cmd = build_git_command(repo_root, &args)?;
    cmd.env("GIT_TERMINAL_PROMPT", "0")
        .env("GIT_ASKPASS", "")
        .env("SSH_ASKPASS", "")
        .env("GIT_OPTIONAL_LOCKS", "0")
        .env("GCM_INTERACTIVE", "Never")
        .env("GCM_PROVIDER", "")
        .env("LC_ALL", "C")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let child = Arc::new(SharedChild::spawn(&mut cmd).map_err(|e| GitError::Spawn(e.to_string()))?);
    let mut stdout_pipe = child
        .take_stdout()
        .ok_or_else(|| GitError::Spawn("no stdout pipe".into()))?;
    let mut stderr_pipe = child
        .take_stderr()
        .ok_or_else(|| GitError::Spawn("no stderr pipe".into()))?;

    let stdout_handle = thread::spawn(move || drain(&mut stdout_pipe, 64 * 1024));
    let stderr_handle = thread::spawn(move || drain(&mut stderr_pipe, 4 * 1024));

    let (tx, rx) = mpsc::channel();
    let waiter = Arc::clone(&child);
    thread::spawn(move || {
        let _ = tx.send(waiter.wait());
    });

    let (exit_code, timed_out) = match rx.recv_timeout(dur) {
        Ok(Ok(status)) => (status.code(), false),
        Ok(Err(e)) => return Err(GitError::Io(e)),
        Err(mpsc::RecvTimeoutError::Timeout) => {
            let _ = child.kill();
            let _ = child.wait();
            (None, true)
        }
        Err(mpsc::RecvTimeoutError::Disconnected) => {
            return Err(GitError::Spawn("git wait thread disconnected".into()));
        }
    };

    let (stdout, stdout_truncated) = stdout_handle.join().unwrap_or((Vec::new(), false));
    let (stderr, _stderr_truncated) = stderr_handle.join().unwrap_or((Vec::new(), false));

    Ok(GitOutput {
        stdout,
        stderr,
        exit_code,
        timed_out,
        truncated: stdout_truncated,
    })
}

fn build_git_command(repo_root: Option<&str>, args: &[OsString]) -> Result<Command> {
    let mut cmd = new_std_command("git");
    if let Some(cwd) = repo_root {
        cmd.current_dir(cwd);
    }
    cmd.args(args);
    Ok(cmd)
}

fn drain(pipe: &mut impl Read, prealloc: usize) -> (Vec<u8>, bool) {
    let mut buf = vec![0u8; 16 * 1024];
    let mut out = Vec::with_capacity(prealloc);
    let mut truncated = false;
    loop {
        match pipe.read(&mut buf) {
            Ok(0) => break,
            Ok(n) => {
                if out.len() + n > MAX_OUTPUT_BYTES {
                    let take = MAX_OUTPUT_BYTES.saturating_sub(out.len());
                    out.extend_from_slice(&buf[..take]);
                    truncated = true;
                    break;
                }
                out.extend_from_slice(&buf[..n]);
            }
            Err(_) => break,
        }
    }
    (out, truncated)
}

fn decode_text(bytes: Vec<u8>) -> TextSource {
    if bytes.is_empty() {
        return TextSource::Missing;
    }
    if bytes.contains(&0) {
        return TextSource::Binary;
    }
    match String::from_utf8(bytes) {
        Ok(text) => TextSource::Text(text),
        Err(e) => TextSource::Text(String::from_utf8_lossy(&e.into_bytes()).into_owned()),
    }
}

pub fn ensure_success(output: &GitOutput, context: &'static str) -> Result<()> {
    if output.timed_out {
        return Err(GitError::TimedOut(context));
    }
    if output.exit_code == Some(0) {
        return Ok(());
    }
    let stderr = String::from_utf8_lossy(&output.stderr);
    let detail = stderr.trim();
    if classify_auth_error(detail) {
        return Err(GitError::AuthRequired(detail.to_string()));
    }
    if detail.contains("host key verification failed") {
        return Err(GitError::HostKeyUnverified);
    }
    Err(GitError::CommandFailed {
        context,
        detail: if detail.is_empty() {
            "non-zero exit code".into()
        } else {
            detail.into()
        },
    })
}

fn classify_auth_error(stderr: &str) -> bool {
    let lower = stderr.to_ascii_lowercase();
    lower.contains("could not read username")
        || lower.contains("authentication failed")
        || lower.contains("permission denied (publickey)")
        || lower.contains("permission denied")
        || lower.contains("fatal: could not access")
        || lower.contains("invalid username or password")
}
