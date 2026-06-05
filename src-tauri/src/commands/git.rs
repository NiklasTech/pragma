#[tauri::command]
pub fn git_status() -> Result<String, String> {
    Ok("git module ready".to_string())
}
