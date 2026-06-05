#[tauri::command]
pub fn lsp_list_servers() -> Result<Vec<String>, String> {
    Ok(vec![])
}
