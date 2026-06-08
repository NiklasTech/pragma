use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;

use tauri::Manager;
use tauri_plugin_store::Store;

const STORE_NAME: &str = "workspaces.dat";
const KEY_PREFIX: &str = "workspaces";

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CursorPosition {
    pub line: u32,
    pub column: u32,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum WorkspaceTab {
    File {
        id: String,
        path: String,
        name: String,
        language: Option<String>,
    },
    Diff {
        id: String,
        path: String,
        name: String,
        staged: bool,
    },
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct WorkspaceLayout {
    pub sidebar_open: bool,
    pub sidebar_width: u32,
    pub sidebar_tab: String,
    pub chat_panel_open: bool,
    pub chat_panel_width: u32,
    pub terminal_height: u32,
    pub editor_height: u32,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct WorkspaceData {
    pub tabs: Vec<WorkspaceTab>,
    pub active_tab_id: Option<String>,
    pub cursor_positions: HashMap<String, CursorPosition>,
    pub layout: WorkspaceLayout,
    pub terminal_cwd: Option<String>,
    pub active_run_config: Option<String>,
}

fn repo_hash(repo_path: &str) -> Result<String, String> {
    let canonical = std::fs::canonicalize(Path::new(repo_path))
        .map_err(|e| format!("failed to canonicalize repo path: {e}"))?;
    let input = canonical.to_string_lossy().into_owned();
    let hash = repo_hash_inner::digest(input);
    Ok(hash)
}

fn store_key(repo_hash: &str, branch_name: &str) -> String {
    format!("{KEY_PREFIX}.{repo_hash}.{branch_name}")
}

fn load_store(app: &tauri::AppHandle) -> Result<Arc<Store<tauri::Wry>>, String> {
    let path = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("failed to resolve app config dir: {e}"))?
        .join(STORE_NAME);
    tauri_plugin_store::StoreBuilder::new(app, path)
        .build()
        .map_err(|e| format!("failed to load store: {e}"))
}

#[tauri::command]
pub async fn workspace_save(
    app: tauri::AppHandle,
    repo_path: String,
    branch_name: String,
    data: WorkspaceData,
) -> Result<(), String> {
    if repo_path.is_empty() {
        return Err("Repository path is required".to_string());
    }
    if branch_name.is_empty() {
        return Err("Branch name is required".to_string());
    }

    let hash = repo_hash(&repo_path)?;
    let key = store_key(&hash, &branch_name);
    let store = load_store(&app)?;

    store.set(key, serde_json::to_value(&data).map_err(|e| e.to_string())?);
    store
        .save()
        .map_err(|e| format!("failed to save store: {e}"))?;
    Ok(())
}

#[tauri::command]
pub async fn workspace_load(
    app: tauri::AppHandle,
    repo_path: String,
    branch_name: String,
) -> Result<Option<WorkspaceData>, String> {
    if repo_path.is_empty() {
        return Err("Repository path is required".to_string());
    }
    if branch_name.is_empty() {
        return Err("Branch name is required".to_string());
    }

    let hash = repo_hash(&repo_path)?;
    let key = store_key(&hash, &branch_name);
    let store = load_store(&app)?;

    match store.get(&key) {
        Some(value) => {
            let data: WorkspaceData = serde_json::from_value(value)
                .map_err(|e| format!("corrupt workspace data: {e}"))?;
            Ok(Some(data))
        }
        None => Ok(None),
    }
}

#[tauri::command]
pub async fn workspace_delete(
    app: tauri::AppHandle,
    repo_path: String,
    branch_name: String,
) -> Result<(), String> {
    if repo_path.is_empty() {
        return Err("Repository path is required".to_string());
    }
    if branch_name.is_empty() {
        return Err("Branch name is required".to_string());
    }

    let hash = repo_hash(&repo_path)?;
    let key = store_key(&hash, &branch_name);
    let store = load_store(&app)?;

    store.delete(&key);
    store
        .save()
        .map_err(|e| format!("failed to save store: {e}"))?;
    Ok(())
}

mod repo_hash_inner {
    pub fn digest(input: String) -> String {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        let mut hasher = DefaultHasher::new();
        input.hash(&mut hasher);
        let first = hasher.finish();
        let mut hasher = DefaultHasher::new();
        first.hash(&mut hasher);
        input.hash(&mut hasher);
        format!("{:016x}", hasher.finish())
    }
}
