pub mod client;
pub mod manager;
pub mod types;
pub mod uris;

pub use manager::{resolve_project_root, LspManager};
pub use types::{
    LspDiagnostic, LspDiagnosticsEvent, LspPosition, LspRange, LspServerStatus, LspStatusEvent,
    ProjectLanguage,
};

#[tauri::command]
pub async fn lsp_did_open(
    state: tauri::State<'_, LspManager>,
    language: String,
    file_path: String,
    content: String,
) -> Result<(), String> {
    if language.is_empty() {
        return Err("language is required".to_string());
    }
    if file_path.is_empty() {
        return Err("file_path is required".to_string());
    }
    let project_root = resolve_project_root(&language, &file_path)
        .ok_or_else(|| format!("Could not resolve project root for {file_path}"))?;
    state
        .did_open(&language, &project_root, &file_path, &content)
        .await
}

#[tauri::command]
pub async fn lsp_did_change(
    state: tauri::State<'_, LspManager>,
    language: String,
    file_path: String,
    content: String,
) -> Result<(), String> {
    if file_path.is_empty() {
        return Err("file_path is required".to_string());
    }
    let project_root = resolve_project_root(&language, &file_path)
        .ok_or_else(|| format!("Could not resolve project root for {file_path}"))?;
    state
        .did_change(&language, &project_root, &file_path, &content)
        .await
}

#[tauri::command]
pub async fn lsp_did_save(
    state: tauri::State<'_, LspManager>,
    language: String,
    file_path: String,
) -> Result<(), String> {
    if file_path.is_empty() {
        return Err("file_path is required".to_string());
    }
    let project_root = resolve_project_root(&language, &file_path)
        .ok_or_else(|| format!("Could not resolve project root for {file_path}"))?;
    state.did_save(&language, &project_root, &file_path).await
}

#[tauri::command]
pub async fn lsp_check_server(language: String) -> Result<bool, String> {
    LspManager::check_server_installed(&language).await
}

#[tauri::command]
pub async fn lsp_install_server(language: String) -> Result<String, String> {
    if language.is_empty() {
        return Err("language is required".to_string());
    }
    LspManager::install_server(&language).await
}

#[tauri::command]
pub async fn lsp_detect_project_languages(
    project_root: String,
) -> Result<Vec<ProjectLanguage>, String> {
    if project_root.is_empty() {
        return Err("project_root is required".to_string());
    }
    LspManager::detect_project_languages(&project_root).await
}
