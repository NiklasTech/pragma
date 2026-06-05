#[tauri::command]
pub fn mcp_list_servers() -> Result<Vec<String>, String> {
    Ok(vec![])
}
