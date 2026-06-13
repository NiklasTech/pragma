use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_CONTEXT_TOKENS: usize = 8_000;
const MAX_FILE_BYTES: u64 = 1_048_576; // 1 MiB
const MAX_DIRECTORY_DEPTH: usize = 8;
const CONTEXT_PREFIX: &str = "You have access to the following project files as context:\n\n";
const CONTEXT_SUFFIX: &str = "\nUse this context to answer the user's question.";

// ─── Request / Response ──────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ReadChatContextRequest {
    pub root_path: String,
    pub paths: Vec<String>,
    pub max_tokens: Option<usize>,
}

#[derive(Debug, Serialize)]
pub struct ReadChatContextResult {
    pub content: String,
    pub files_read: usize,
    pub tokens_used: usize,
    pub truncated: bool,
}

// ─── Public Command ──────────────────────────────────────────────────────────

#[tauri::command]
pub fn read_chat_context(req: ReadChatContextRequest) -> Result<ReadChatContextResult, String> {
    if req.root_path.is_empty() {
        return Err("root_path is required".to_string());
    }
    if req.paths.is_empty() {
        return Ok(ReadChatContextResult {
            content: String::new(),
            files_read: 0,
            tokens_used: 0,
            truncated: false,
        });
    }

    let root = Path::new(&req.root_path);
    let root =
        fs::canonicalize(root).map_err(|e| format!("Failed to resolve workspace root: {}", e))?;

    let max_tokens = req.max_tokens.unwrap_or(MAX_CONTEXT_TOKENS);
    let mut items: Vec<ContextItem> = Vec::new();

    for raw_path in &req.paths {
        let resolved = resolve_context_path(&root, raw_path)?;
        collect_context(&root, &resolved, &mut items)?;
    }

    let mut content = String::with_capacity(CONTEXT_PREFIX.len() + CONTEXT_SUFFIX.len());
    content.push_str(CONTEXT_PREFIX);

    let mut tokens_used = estimate_tokens(&content);
    let mut files_read = 0;
    let mut truncated = false;

    for item in items {
        let item_text = format!("--- {} ---\n{}\n", item.relative_path, item.content);
        let item_tokens = estimate_tokens(&item_text);

        if tokens_used + item_tokens > max_tokens {
            truncated = true;
            break;
        }

        content.push_str(&item_text);
        tokens_used += item_tokens;
        files_read += 1;
    }

    if files_read > 0 {
        content.push_str(CONTEXT_SUFFIX);
        tokens_used += estimate_tokens(CONTEXT_SUFFIX);
    }

    Ok(ReadChatContextResult {
        content,
        files_read,
        tokens_used,
        truncated,
    })
}

// ─── Internal Types ──────────────────────────────────────────────────────────

struct ContextItem {
    relative_path: String,
    content: String,
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

fn resolve_context_path(root: &Path, raw_path: &str) -> Result<PathBuf, String> {
    let path = Path::new(raw_path);

    let absolute = if path.is_absolute() {
        path.to_path_buf()
    } else {
        root.join(path)
    };

    let canonical = fs::canonicalize(&absolute)
        .map_err(|e| format!("Failed to resolve path '{}': {}", raw_path, e))?;

    if !canonical.starts_with(root) {
        return Err(format!("Path '{}' is outside the workspace root", raw_path));
    }

    Ok(canonical)
}

fn collect_context(root: &Path, path: &Path, out: &mut Vec<ContextItem>) -> Result<(), String> {
    if path.is_file() {
        if let Some(item) = read_context_file(root, path)? {
            out.push(item);
        }
        return Ok(());
    }

    if path.is_dir() {
        let mut files: Vec<PathBuf> = Vec::new();
        collect_files_recursively(path, &mut files, 0)?;

        for file in files {
            if let Some(item) = read_context_file(root, &file)? {
                out.push(item);
            }
        }
    }

    Ok(())
}

fn read_context_file(root: &Path, path: &Path) -> Result<Option<ContextItem>, String> {
    let metadata = fs::metadata(path).map_err(|e| format!("Failed to read metadata: {}", e))?;

    if !metadata.is_file() {
        return Ok(None);
    }

    let relative_path = relative_path(root, path);

    if metadata.len() > MAX_FILE_BYTES {
        return Ok(Some(ContextItem {
            relative_path,
            content: format!(
                "[File exceeds size limit of {} bytes and was skipped]",
                MAX_FILE_BYTES
            ),
        }));
    }

    let bytes = fs::read(path).map_err(|e| format!("Failed to read file: {}", e))?;

    if bytes.contains(&0) {
        return Ok(Some(ContextItem {
            relative_path,
            content: "[Binary file skipped]".to_string(),
        }));
    }

    let content =
        String::from_utf8(bytes).map_err(|e| format!("File is not valid UTF-8: {}", e))?;

    Ok(Some(ContextItem {
        relative_path,
        content,
    }))
}

fn collect_files_recursively(
    dir: &Path,
    out: &mut Vec<PathBuf>,
    depth: usize,
) -> Result<(), String> {
    if depth > MAX_DIRECTORY_DEPTH {
        return Ok(());
    }

    let entries = fs::read_dir(dir).map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();
        let name = entry.file_name().to_str().unwrap_or("").to_string();

        if name.starts_with('.') || name == "node_modules" || name == "target" {
            continue;
        }

        let metadata = entry
            .metadata()
            .map_err(|e| format!("Failed to read metadata: {}", e))?;

        if metadata.is_dir() {
            collect_files_recursively(&path, out, depth + 1)?;
        } else if metadata.is_file() {
            out.push(path);
        }
    }

    Ok(())
}

fn relative_path(root: &Path, path: &Path) -> String {
    path.strip_prefix(root)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/")
}

fn estimate_tokens(text: &str) -> usize {
    // Conservative approximation without an external tokenizer.
    // Empirically 1 token ~ 3-4 characters for code/text.
    (text.chars().count() + 2) / 3
}
