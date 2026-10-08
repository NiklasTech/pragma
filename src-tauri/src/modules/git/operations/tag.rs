use std::ffi::OsString;

use serde::Serialize;

use crate::modules::git::errors::{GitError, Result};
use crate::modules::git::process::{ensure_git_available, ensure_success, run_git};
use crate::modules::git::types::DEFAULT_TIMEOUT_SECS;
use crate::modules::git::utils::{authorized_repo_root, sha_is_safe};

use super::revision::{ensure_ref_name, ref_exists, resolve_commit};

const TAG_FORMAT: &str =
    "--format=%(refname:short)%1f%(objecttype)%1f%(objectname)%1f%(*objectname)%1f%(contents:subject)%1f%(creatordate:unix)";
const MAX_TAG_MESSAGE_CHARS: usize = 4096;

#[derive(Serialize, Debug, Clone)]
pub struct GitTag {
    pub name: String,
    pub target_sha: String,
    pub annotated: bool,
    pub message: String,
    pub timestamp_secs: i64,
}

/// All tags, newest first. Annotated tags report the commit they point at.
pub fn list_tags(repo_root: &str) -> Result<Vec<GitTag>> {
    let repo_root = authorized_repo_root(repo_root)?;
    ensure_git_available()?;
    let output = run_git(
        Some(&repo_root.to_string_lossy()),
        [
            "for-each-ref",
            "--sort=-creatordate",
            TAG_FORMAT,
            "refs/tags",
        ],
        DEFAULT_TIMEOUT_SECS,
    )?;
    ensure_success(&output, "git for-each-ref failed")?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.lines().filter_map(parse_tag_line).collect())
}

fn parse_tag_line(line: &str) -> Option<GitTag> {
    let mut fields = line.splitn(6, '\x1f');
    let name = fields.next()?.to_string();
    let object_type = fields.next()?;
    let object = fields.next()?;
    let peeled = fields.next()?;
    let message = fields.next()?.to_string();
    let timestamp_secs = fields.next()?.trim().parse::<i64>().unwrap_or(0);
    let annotated = object_type == "tag";
    let target_sha = if annotated { peeled } else { object }.to_string();
    if name.is_empty() || !sha_is_safe(&target_sha) {
        return None;
    }
    Some(GitTag {
        name,
        target_sha,
        annotated,
        message: if annotated { message } else { String::new() },
        timestamp_secs,
    })
}

/// Creates a tag at `target` (HEAD when omitted). A non-empty message makes it annotated.
pub fn create_tag(
    repo_root: &str,
    name: &str,
    target: Option<&str>,
    message: Option<&str>,
) -> Result<()> {
    let repo_root = authorized_repo_root(repo_root)?;
    ensure_git_available()?;
    let root = repo_root.to_string_lossy();
    ensure_ref_name(&root, "tags", name)?;
    if ref_exists(&root, "tags", name)? {
        return Err(GitError::command("tag already exists", name.to_string()));
    }
    let sha = resolve_commit(&root, target.filter(|t| !t.is_empty()).unwrap_or("HEAD"))?;

    let mut args: Vec<OsString> = vec!["tag".into()];
    if let Some(message) = message.map(str::trim).filter(|m| !m.is_empty()) {
        if message.len() > MAX_TAG_MESSAGE_CHARS {
            return Err(GitError::command("tag message is too long", ""));
        }
        args.extend(["-a".into(), "-m".into(), message.into()]);
    }
    args.extend([name.into(), sha.into()]);
    let output = run_git(Some(&root), args, DEFAULT_TIMEOUT_SECS)?;
    ensure_success(&output, "git tag failed")
}

pub fn delete_tag(repo_root: &str, name: &str) -> Result<()> {
    let repo_root = authorized_repo_root(repo_root)?;
    ensure_git_available()?;
    let root = repo_root.to_string_lossy();
    ensure_ref_name(&root, "tags", name)?;
    if !ref_exists(&root, "tags", name)? {
        return Err(GitError::command("tag not found", name.to_string()));
    }
    let output = run_git(Some(&root), ["tag", "-d", name], DEFAULT_TIMEOUT_SECS)?;
    ensure_success(&output, "git tag -d failed")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modules::git::operations::test_support::TestRepo;

    #[test]
    fn lists_lightweight_and_annotated_tags() {
        let repo = TestRepo::new();
        let first = repo.git(&["rev-parse", "HEAD"]);
        repo.write("file.txt", "next\n");
        repo.commit_all("next");
        let second = repo.git(&["rev-parse", "HEAD"]);

        create_tag(&repo.root, "v1", Some(&first), None).unwrap();
        create_tag(&repo.root, "v2", None, Some("Release two")).unwrap();

        let tags = list_tags(&repo.root).unwrap();
        let v1 = tags.iter().find(|t| t.name == "v1").unwrap();
        let v2 = tags.iter().find(|t| t.name == "v2").unwrap();

        assert_eq!(v1.target_sha, first);
        assert!(!v1.annotated);
        assert_eq!(v2.target_sha, second);
        assert!(v2.annotated);
        assert_eq!(v2.message, "Release two");
    }

    #[test]
    fn create_tag_rejects_duplicates_and_bad_input() {
        let repo = TestRepo::new();
        create_tag(&repo.root, "v1", None, None).unwrap();

        assert!(create_tag(&repo.root, "v1", None, None).is_err());
        assert!(create_tag(&repo.root, "-d", None, None).is_err());
        assert!(create_tag(&repo.root, "bad name", None, None).is_err());
        assert!(create_tag(&repo.root, "v2", Some("missing"), None).is_err());
    }

    #[test]
    fn delete_tag_removes_only_existing_tags() {
        let repo = TestRepo::new();
        create_tag(&repo.root, "v1", None, None).unwrap();

        delete_tag(&repo.root, "v1").unwrap();

        assert!(list_tags(&repo.root).unwrap().is_empty());
        assert!(delete_tag(&repo.root, "v1").is_err());
    }
}
