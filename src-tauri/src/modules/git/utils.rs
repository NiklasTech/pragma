use std::path::{Path, PathBuf};

use crate::modules::git::errors::{GitError, Result};

pub fn canonical_dir(path: &str) -> Result<PathBuf> {
    let p = Path::new(path);
    if !p.exists() {
        return Err(GitError::NotADirectory(path.into()));
    }
    p.canonicalize()
        .map_err(|e| GitError::InvalidPath(format!("{path}: {e}")))
}

pub fn authorized_repo_root(repo_root: &str) -> Result<PathBuf> {
    let canonical = canonical_dir(repo_root)?;
    if !canonical.is_dir() {
        return Err(GitError::NotADirectory(repo_root.into()));
    }
    Ok(canonical)
}

pub fn split_upstream(upstream: &str) -> (Option<String>, Option<String>) {
    if let Some(pos) = upstream.find('/') {
        let remote = &upstream[..pos];
        let branch = &upstream[pos + 1..];
        (Some(remote.into()), Some(branch.into()))
    } else {
        (None, None)
    }
}

pub fn sha_is_safe(sha: &str) -> bool {
    !sha.is_empty() && sha.len() <= 64 && sha.chars().all(|c| c.is_ascii_hexdigit())
}

pub fn resolve_within_repo(repo_root: &Path, rel: &str) -> Result<PathBuf> {
    let cleaned = rel.trim_start_matches("./").trim_start_matches(".\\");
    let resolved = repo_root.join(cleaned);
    let canonical = resolved.canonicalize().unwrap_or(resolved);
    if !canonical.starts_with(repo_root) {
        return Err(GitError::PathOutsideWorkspace(canonical));
    }
    Ok(canonical)
}

pub fn pathspec(repo_root: &Path, absolute: &Path) -> String {
    absolute
        .strip_prefix(repo_root)
        .map(|rel| rel.to_string_lossy().replace('\\', "/"))
        .unwrap_or_else(|_| absolute.to_string_lossy().replace('\\', "/"))
}

pub fn is_safe_pathspec(spec: &str) -> bool {
    !spec.contains(':') && !spec.contains('\0') && !spec.chars().any(|c| c.is_control())
}
