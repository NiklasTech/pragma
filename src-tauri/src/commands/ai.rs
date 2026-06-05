#[tauri::command]
pub fn ai_list_providers() -> Result<Vec<String>, String> {
    Ok(vec![
        "openai".to_string(),
        "anthropic".to_string(),
        "ollama".to_string(),
    ])
}
