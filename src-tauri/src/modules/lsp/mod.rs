pub mod client;
pub mod manager;
pub mod types;

pub use manager::{resolve_project_root, LspManager};
pub use types::{
    LspDiagnostic, LspDiagnosticsEvent, LspPosition, LspRange, LspServerStatus, LspStatusEvent,
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
    let project_root = resolve_project_root(&file_path)
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
    let project_root = resolve_project_root(&file_path)
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
    let project_root = resolve_project_root(&file_path)
        .ok_or_else(|| format!("Could not resolve project root for {file_path}"))?;
    state.did_save(&language, &project_root, &file_path).await
}
