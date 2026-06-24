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

fn is_valid_node_id(node_id: &str) -> bool {
    !node_id.is_empty()
        && node_id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == ':' || c == '/')
}

fn build_label(node_id: &str) -> String {
    format!("{LABEL_PREFIX}{node_id}")
}

/// Creates a new external floating window for the given layout node.
#[tauri::command]
pub fn create_external_window(
    app: AppHandle,
    node_id: String,
    title: String,
    bounds: WindowBounds,
) -> Result<String, String> {
    if !is_valid_node_id(&node_id) {
        return Err(format!("Invalid node id: {node_id}"));
    }

    if bounds.width == 0 || bounds.height == 0 {
        return Err("Window width and height must be greater than 0".to_string());
    }

    let label = build_label(&node_id);

    if app.get_webview_window(&label).is_some() {
        return Err(format!("External window {label} already exists"));
    }

    let url = format!("floating.html?nodeId={node_id}");

    WebviewWindowBuilder::new(&app, &label, WebviewUrl::App(url.into()))
        .title(title)
        .decorations(false)
        .resizable(true)
        .visible(false)
        .inner_size(bounds.width as f64, bounds.height as f64)
        .position(bounds.x as f64, bounds.y as f64)
        .build()
        .map(|_| label)
        .map_err(|err| format!("Failed to create external window: {err}"))
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
