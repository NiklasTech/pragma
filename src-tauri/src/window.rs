use std::collections::HashMap;
use std::sync::Mutex;

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

/// Tracks which workspace window (label) currently has which folder open,
/// so a second instance asking for an already-open folder can focus the
/// existing window instead of opening a duplicate.
#[derive(Default)]
pub struct OpenFolders(Mutex<HashMap<String, String>>);

/// Normalizes a folder path for dedup comparison: trims a trailing
/// separator, and on Windows ignores case and slash direction.
fn folder_key(path: &str) -> String {
    #[cfg(target_os = "windows")]
    {
        path.replace('/', "\\")
            .trim_end_matches('\\')
            .to_lowercase()
    }
    #[cfg(not(target_os = "windows"))]
    {
        path.trim_end_matches('/').to_string()
    }
}

impl OpenFolders {
    /// Sets the folder currently open in the given window, replacing any
    /// folder previously recorded for that window. `None` clears it.
    fn update(&self, label: &str, folder: Option<&str>) -> Result<(), String> {
        let mut map = self
            .0
            .lock()
            .map_err(|_| "open-folders lock poisoned".to_string())?;
        map.retain(|_, existing| existing != label);
        if let Some(folder) = folder {
            map.insert(folder_key(folder), label.to_string());
        }
        Ok(())
    }

    fn label_for(&self, folder: &str) -> Option<String> {
        let map = self.0.lock().ok()?;
        map.get(&folder_key(folder)).cloned()
    }
}

/// Records the folder a workspace window has open (or clears it), keeping
/// the folder-dedup registry in sync with the frontend.
#[tauri::command]
pub fn update_window_folder(
    window: tauri::Window,
    open_folders: tauri::State<OpenFolders>,
    folder: Option<String>,
) -> Result<(), String> {
    open_folders.update(window.label(), folder.as_deref())
}

/// Creates a new independent workspace window that opens the given folder.
/// If the folder is already open in another window, that window is focused
/// instead. The window starts hidden; the frontend reveals it after first
/// paint, same as the main window (see src/main.tsx).
pub fn create_workspace_window(app: &AppHandle, folder_path: &str) -> Result<String, String> {
    if let Some(open_folders) = app.try_state::<OpenFolders>() {
        if let Some(label) = open_folders.label_for(folder_path) {
            if let Some(window) = app.get_webview_window(&label) {
                let _ = window.unminimize();
                let _ = window.set_focus();
                return Ok(label);
            }
            open_folders.update(&label, None)?;
        }
    }

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

    if let Some(open_folders) = app.try_state::<OpenFolders>() {
        open_folders.update(&label, Some(folder_path))?;
    }

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

    #[test]
    fn folder_key_trims_trailing_separator() {
        let (plain, trailing) = if cfg!(target_os = "windows") {
            ("C:\\projects\\pragma", "C:\\projects\\pragma\\")
        } else {
            ("/home/user/pragma", "/home/user/pragma/")
        };
        assert_eq!(folder_key(plain), folder_key(trailing));
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn folder_key_ignores_case_and_slash_direction_on_windows() {
        assert_eq!(
            folder_key("C:\\Projects\\Pragma"),
            folder_key("c:/projects/pragma")
        );
    }

    #[test]
    fn open_folders_update_registers_and_looks_up_folder() {
        let folders = OpenFolders::default();
        let path = if cfg!(target_os = "windows") {
            "C:\\projects\\pragma"
        } else {
            "/home/user/pragma"
        };
        folders.update("main", Some(path)).unwrap();
        assert_eq!(folders.label_for(path), Some("main".to_string()));
    }

    #[test]
    fn open_folders_update_replaces_previous_folder_of_same_label() {
        let folders = OpenFolders::default();
        let (first, second) = if cfg!(target_os = "windows") {
            ("C:\\a", "C:\\b")
        } else {
            ("/a", "/b")
        };
        folders.update("main", Some(first)).unwrap();
        folders.update("main", Some(second)).unwrap();
        assert_eq!(folders.label_for(first), None);
        assert_eq!(folders.label_for(second), Some("main".to_string()));
    }

    #[test]
    fn open_folders_update_none_clears_label() {
        let folders = OpenFolders::default();
        let path = if cfg!(target_os = "windows") {
            "C:\\a"
        } else {
            "/a"
        };
        folders.update("main", Some(path)).unwrap();
        folders.update("main", None).unwrap();
        assert_eq!(folders.label_for(path), None);
    }

    #[test]
    fn open_folders_label_for_matches_normalized_key() {
        let folders = OpenFolders::default();
        let (registered, lookup) = if cfg!(target_os = "windows") {
            ("C:\\Projects\\Pragma", "c:/projects/pragma/")
        } else {
            ("/home/user/pragma", "/home/user/pragma/")
        };
        folders.update("workspace-2", Some(registered)).unwrap();
        assert_eq!(folders.label_for(lookup), Some("workspace-2".to_string()));
    }
}
