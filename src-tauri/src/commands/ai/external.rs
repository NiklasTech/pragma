fn is_web_url(url: &str) -> bool {
    url.starts_with("https://") || url.starts_with("http://")
}

#[tauri::command]
pub async fn open_external_url(url: String, app_handle: tauri::AppHandle) -> Result<(), String> {
    if !is_web_url(&url) {
        return Err("only HTTP and HTTPS URLs are allowed".to_string());
    }

    use tauri_plugin_opener::OpenerExt;
    app_handle
        .opener()
        .open_url(&url, None::<&str>)
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::is_web_url;

    #[test]
    fn allows_only_http_and_https() {
        assert!(is_web_url("https://example.com"));
        assert!(is_web_url("http://localhost:5173/"));
        assert!(!is_web_url("file:///etc/passwd"));
        assert!(!is_web_url("javascript:alert(1)"));
    }
}
