use std::path::{Component, Path, PathBuf};

use serde_json::Value;

use super::error::{AcpError, Result};
use super::types::{
    FsReadTextFileRequest, FsReadTextFileResponse, FsWriteTextFileRequest, FsWriteTextFileResponse,
};

const MAX_FILE_SIZE_BYTES: u64 = 10 * 1024 * 1024;

pub fn handle_fs_request(method: &str, params: Option<Value>, cwd: &str) -> Result<Value> {
    match method {
        "fs/read_text_file" => {
            let req: FsReadTextFileRequest = serde_json::from_value(params.unwrap_or(Value::Null))?;
            let path = resolve_path(&req.path, cwd)?;
            read_text_file(&path)
        }
        "fs/write_text_file" => {
            let req: FsWriteTextFileRequest =
                serde_json::from_value(params.unwrap_or(Value::Null))?;
            let path = resolve_path(&req.path, cwd)?;
            write_text_file(&path, &req.content)
        }
        _ => Err(AcpError::Protocol(format!("unknown fs method: {method}"))),
    }
}

fn resolve_path(request_path: &str, cwd: &str) -> Result<PathBuf> {
    let cwd = Path::new(cwd);
    let path = Path::new(request_path);

    let resolved = if path.is_absolute() {
        path.to_path_buf()
    } else {
        cwd.join(path)
    };

    // Reject paths that try to escape the workspace via `..`.
    let mut clean = PathBuf::new();
    for component in resolved.components() {
        match component {
            Component::Prefix(_) | Component::RootDir | Component::CurDir => {
                clean.push(component);
            }
            Component::ParentDir => {
                clean.pop();
            }
            Component::Normal(part) => {
                clean.push(part);
            }
        }
    }

    let canonical_cwd = canonicalize_or_same(cwd)?;
    let canonical_clean = canonicalize_or_same(&clean)?;

    if !canonical_clean.starts_with(&canonical_cwd) {
        return Err(AcpError::InvalidPath(format!(
            "path {} is outside of cwd {}",
            canonical_clean.display(),
            canonical_cwd.display()
        )));
    }

    Ok(canonical_clean)
}

fn canonicalize_or_same(path: &Path) -> Result<PathBuf> {
    match path.canonicalize() {
        Ok(p) => Ok(p),
        Err(_) => Ok(path.to_path_buf()),
    }
}

fn read_text_file(path: &Path) -> Result<Value> {
    if !path.exists() {
        return Err(AcpError::InvalidPath(format!(
            "file not found: {}",
            path.display()
        )));
    }

    if !path.is_file() {
        return Err(AcpError::InvalidPath(format!(
            "not a file: {}",
            path.display()
        )));
    }

    let metadata = std::fs::metadata(path)
        .map_err(|e| AcpError::InvalidPath(format!("failed to read metadata: {e}")))?;
    let file_size = metadata.len();

    if file_size > MAX_FILE_SIZE_BYTES {
        return Err(AcpError::InvalidPath(format!(
            "file is too large ({} MB). Maximum supported size is {} MB.",
            file_size / (1024 * 1024),
            MAX_FILE_SIZE_BYTES / (1024 * 1024)
        )));
    }

    let bytes = std::fs::read(path)
        .map_err(|e| AcpError::InvalidPath(format!("failed to read file: {e}")))?;

    if bytes.contains(&0) {
        return Err(AcpError::InvalidPath(
            "binary files are not supported".to_string(),
        ));
    }

    let content = String::from_utf8(bytes)
        .map_err(|e| AcpError::InvalidPath(format!("file is not valid UTF-8: {e}")))?;

    let response = FsReadTextFileResponse { content };
    serde_json::to_value(response).map_err(Into::into)
}

fn write_text_file(path: &Path, content: &str) -> Result<Value> {
    if !path.exists() {
        return Err(AcpError::InvalidPath(format!(
            "file not found: {}",
            path.display()
        )));
    }

    if !path.is_file() {
        return Err(AcpError::InvalidPath(format!(
            "not a file: {}",
            path.display()
        )));
    }

    std::fs::write(path, content)
        .map_err(|e| AcpError::InvalidPath(format!("failed to write file: {e}")))?;

    let response = FsWriteTextFileResponse { written: true };
    serde_json::to_value(response).map_err(Into::into)
}
