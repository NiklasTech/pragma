use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

static TEMP_FILE_COUNTER: AtomicU64 = AtomicU64::new(0);
static AGENTS_IO_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

const MAX_NAME_CHARS: usize = 40;
const MAX_BRIEF_CHARS: usize = 4000;
const MAX_MEMORY_TEXT_CHARS: usize = 500;
const MAX_MEMORY_ENTRIES: usize = 50;
const MAX_MEMORY_TOTAL_CHARS: usize = 16000;
const MAX_SKILL_ID_CHARS: usize = 64;
const SECRET_MARKERS: [&str; 5] = ["sk-", "ghp_", "github_pat_", "xai-", "Bearer "];

// ─── Public Types ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentEngine {
    pub kind: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub provider: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cli_provider_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentMemory {
    pub id: String,
    pub text: String,
    pub created_at: i64,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Agent {
    pub id: String,
    pub name: String,
    pub brief: String,
    pub engine: AgentEngine,
    #[serde(default)]
    pub folders: Vec<String>,
    #[serde(default)]
    pub memory: Vec<AgentMemory>,
    #[serde(default)]
    pub skills: Vec<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Deserialize)]
pub struct SaveAgentsRequest {
    pub agents: Vec<Agent>,
}

// ─── Paths ───────────────────────────────────────────────────────────────────

fn roster_path(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("failed to resolve app data dir: {e}"))?;
    Ok(base.join("pragma").join("agents").join("roster.json"))
}

// ─── Validation ──────────────────────────────────────────────────────────────

fn contains_secret(text: &str) -> bool {
    SECRET_MARKERS.iter().any(|marker| text.contains(marker))
}

fn is_valid_skill_id(id: &str) -> bool {
    !id.is_empty()
        && id.chars().count() <= MAX_SKILL_ID_CHARS
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

fn validate_agents(agents: &[Agent]) -> Result<(), String> {
    let mut seen = std::collections::HashSet::new();
    for agent in agents {
        let name = agent.name.trim();
        if name.is_empty() {
            return Err("Name is required".to_string());
        }
        if name.chars().count() > MAX_NAME_CHARS {
            return Err("Name must be 40 characters or fewer".to_string());
        }
        if !seen.insert(name.to_lowercase()) {
            return Err("Agent names must be unique".to_string());
        }
    }

    for agent in agents {
        let brief = agent.brief.trim();
        if brief.is_empty() {
            return Err("Brief is required".to_string());
        }
        if brief.chars().count() > MAX_BRIEF_CHARS {
            return Err("Brief must be 4000 characters or fewer".to_string());
        }

        let mut total_chars = 0usize;
        for entry in &agent.memory {
            if contains_secret(&entry.text) {
                return Err("Do not store secrets in memory".to_string());
            }
            let chars = entry.text.chars().count();
            if chars > MAX_MEMORY_TEXT_CHARS {
                return Err("Memory text must be 500 characters or fewer".to_string());
            }
            total_chars += chars;
        }

        if agent.memory.len() > MAX_MEMORY_ENTRIES || total_chars > MAX_MEMORY_TOTAL_CHARS {
            return Err("Memory is full".to_string());
        }

        if !agent.skills.iter().all(|id| is_valid_skill_id(id)) {
            return Err("Invalid skill id".to_string());
        }
    }

    Ok(())
}

// ─── IO ──────────────────────────────────────────────────────────────────────

async fn write_roster_atomic(path: &std::path::Path, content: &[u8]) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("failed to create agents dir: {e}"))?;
    }

    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| format!("invalid file path: {path:?}"))?;
    let nonce = TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed);
    let temp_path =
        path.with_file_name(format!("{file_name}.{}.{}.tmp", std::process::id(), nonce));

    if let Err(e) = tokio::fs::write(&temp_path, content).await {
        let _ = tokio::fs::remove_file(&temp_path).await;
        return Err(format!("failed to write temp file {temp_path:?}: {e}"));
    }
    if let Err(e) = tokio::fs::rename(&temp_path, path).await {
        let _ = tokio::fs::remove_file(&temp_path).await;
        return Err(format!("failed to replace file {path:?}: {e}"));
    }

    Ok(())
}

// ─── Commands ────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn agents_load(app: AppHandle) -> Result<Vec<Agent>, String> {
    let path = roster_path(&app)?;
    if !path.exists() {
        return Ok(Vec::new());
    }

    let content = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("failed to read roster file: {e}"))?;
    let agents = serde_json::from_str::<Vec<Agent>>(&content)
        .map_err(|e| format!("failed to parse roster file: {e}"))?;
    Ok(agents)
}

#[tauri::command]
pub async fn agents_save(app: AppHandle, req: SaveAgentsRequest) -> Result<(), String> {
    validate_agents(&req.agents)?;

    let _guard = AGENTS_IO_LOCK.lock().await;
    let path = roster_path(&app)?;
    let content = serde_json::to_string_pretty(&req.agents)
        .map_err(|e| format!("failed to serialize roster: {e}"))?;
    write_roster_atomic(&path, content.as_bytes()).await?;

    Ok(())
}
