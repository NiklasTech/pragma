#[tauri::command]
pub async fn open_external_url(url: String, app_handle: tauri::AppHandle) -> Result<(), String> {
    if !url.starts_with("https://") {
        return Err("only HTTPS URLs are allowed".to_string());
    }

    use tauri_plugin_opener::OpenerExt;
    app_handle
        .opener()
        .open_url(&url, None::<&str>)
        .map_err(|e| e.to_string())
}
