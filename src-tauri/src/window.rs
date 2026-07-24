use serde::Deserialize;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

const LABEL_PREFIX: &str = "floating-";

#[derive(Debug, Deserialize)]
pub struct WindowBounds {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateExternalWindowRequest {
    pub node_id: String,
    pub title: String,
    pub bounds: WindowBounds,
}

#[cfg(not(target_os = "windows"))]
fn is_valid_node_id(node_id: &str) -> bool {
    !node_id.is_empty()
        && node_id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == ':' || c == '/')
}

#[cfg(not(target_os = "windows"))]
fn build_label(node_id: &str) -> String {
    if node_id.starts_with(LABEL_PREFIX) {
        node_id.to_string()
    } else {
        format!("{LABEL_PREFIX}{node_id}")
    }
}

/// Creates a new external floating window for the given layout node.
#[cfg(target_os = "windows")]
#[tauri::command]
pub fn create_external_window(
    _app: AppHandle,
    _request: CreateExternalWindowRequest,
) -> Result<String, String> {
    Err("External floating windows are temporarily disabled on Windows.".to_string())
}

/// Creates a new external floating window for the given layout node.
#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub fn create_external_window(
    app: AppHandle,
    window: tauri::Window,
    request: CreateExternalWindowRequest,
) -> Result<String, String> {
    if !is_valid_node_id(&request.node_id) {
        let msg = format!("Invalid node id: {}", request.node_id);
        return Err(msg);
    }

    if request.bounds.width == 0 || request.bounds.height == 0 {
        let msg = "Window width and height must be greater than 0".to_string();
        return Err(msg);
    }

    let label = build_label(&request.node_id);

    if app.get_webview_window(&label).is_some() {
        let msg = format!("External window {label} already exists");
        return Err(msg);
    }

    let url = format!(
        "floating.html?nodeId={}&parent={}",
        request.node_id,
        url_encode(window.label())
    );

    let _window = WebviewWindowBuilder::new(&app, &label, WebviewUrl::App(url.into()))
        .title(request.title)
        .decorations(false)
        .resizable(true)
        .visible(true)
        .inner_size(request.bounds.width as f64, request.bounds.height as f64)
        .position(request.bounds.x as f64, request.bounds.y as f64)
        .build()
        .map_err(|err| {
            let msg = format!("Failed to create external window: {err}");
            msg
        })?;

    Ok(label)
}

/// Closes an external floating window by label.
#[tauri::command]
pub fn close_external_window(app: AppHandle, label: String) -> Result<(), String> {
    if !label.starts_with(LABEL_PREFIX) {
        return Err(format!("Invalid external window label: {label}"));
    }

    let window = app
        .get_webview_window(&label)
        .ok_or_else(|| format!("External window {label} not found"))?;

    window
        .close()
        .map_err(|err| format!("Failed to close external window: {err}"))
}

const WORKSPACE_LABEL_PREFIX: &str = "workspace-";

fn next_workspace_label(app: &AppHandle) -> String {
    let mut n = 2;
    loop {
        let label = format!("{WORKSPACE_LABEL_PREFIX}{n}");
        if app.get_webview_window(&label).is_none() {
            return label;
        }
        n += 1;
    }
}

/// Percent-encodes a string for use as a URL query value (unreserved
/// characters per RFC 3986 stay literal, everything else is %XX).
fn url_encode(input: &str) -> String {
    input
        .bytes()
        .map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' => {
                (b as char).to_string()
            }
            _ => format!("%{b:02X}"),
        })
        .collect()
}

/// Creates a new independent workspace window that opens the given folder.
/// The window starts hidden; the frontend reveals it after first paint,
/// same as the main window (see src/main.tsx).
pub fn create_workspace_window(app: &AppHandle, folder_path: &str) -> Result<String, String> {
    let label = next_workspace_label(app);
    let url = format!("index.html?folder={}", url_encode(folder_path));

    WebviewWindowBuilder::new(app, &label, WebviewUrl::App(url.into()))
        .title("Pragma")
        .decorations(false)
        .resizable(true)
        .visible(false)
        .inner_size(1200.0, 800.0)
        .build()
        .map_err(|err| format!("Failed to create workspace window: {err}"))?;

    Ok(label)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn url_encode_leaves_unreserved_characters() {
        assert_eq!(url_encode("abc-DEF_019.~"), "abc-DEF_019.~");
    }

    #[test]
    fn url_encode_escapes_spaces_and_backslashes() {
        assert_eq!(url_encode("C:\\my proj"), "C%3A%5Cmy%20proj");
    }
}
