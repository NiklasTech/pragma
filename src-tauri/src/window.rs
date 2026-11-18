use std::collections::HashMap;
use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

fn apply_window_chrome<'a, R: tauri::Runtime, M: Manager<R>>(
    builder: WebviewWindowBuilder<'a, R, M>,
    windows_decorations: bool,
) -> WebviewWindowBuilder<'a, R, M> {
    #[cfg(target_os = "macos")]
    {
        let _ = windows_decorations;
        builder
            .decorations(true)
            .title_bar_style(tauri::TitleBarStyle::Overlay)
            .hidden_title(true)
            .traffic_light_position(tauri::LogicalPosition::new(
                crate::macos_chrome::TRAFFIC_LIGHT_X,
                crate::macos_chrome::TRAFFIC_LIGHT_Y,
            ))
    }
    #[cfg(target_os = "windows")]
    {
        builder.decorations(windows_decorations)
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = windows_decorations;
        builder.decorations(false)
    }
}

const MIN_HEADER_HEIGHT: u32 = 20;
const MAX_HEADER_HEIGHT: u32 = 96;

fn validate_header_height(height: u32) -> Result<(), String> {
    if (MIN_HEADER_HEIGHT..=MAX_HEADER_HEIGHT).contains(&height) {
        Ok(())
    } else {
        Err(format!(
            "Header height must be between {MIN_HEADER_HEIGHT} and {MAX_HEADER_HEIGHT}"
        ))
    }
}

/// Centers the macOS traffic lights in the webview header of every window.
#[tauri::command]
#[cfg_attr(not(target_os = "macos"), allow(unused_variables))]
pub fn set_window_header_height(app: AppHandle, height: u32) -> Result<(), String> {
    validate_header_height(height)?;
    #[cfg(target_os = "macos")]
    {
        crate::macos_chrome::set_header_height(height);
        for window in app.webview_windows().into_values() {
            let target = window.clone();
            window
                .run_on_main_thread(move || crate::macos_chrome::align_webview(&target))
                .map_err(|err| err.to_string())?;
        }
    }
    Ok(())
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

/// Tracks which workspace window (label) has which repositories open, so a
/// second instance asking for an already-open folder can focus the existing
/// window instead of opening a duplicate.
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
    /// Sets the folders open in the given window, replacing the folders
    /// previously recorded for that window. An empty list clears them.
    fn update(&self, label: &str, folders: &[String]) -> Result<(), String> {
        let mut map = self
            .0
            .lock()
            .map_err(|_| "open-folders lock poisoned".to_string())?;
        map.retain(|_, existing| existing != label);
        for folder in folders {
            map.insert(folder_key(folder), label.to_string());
        }
        Ok(())
    }

    fn label_for(&self, folder: &str) -> Option<String> {
        let map = self.0.lock().ok()?;
        map.get(&folder_key(folder)).cloned()
    }
}

/// Records the repositories a workspace window has open, keeping the
/// folder-dedup registry in sync with the frontend.
#[tauri::command]
pub fn update_window_folder(
    window: tauri::Window,
    open_folders: tauri::State<OpenFolders>,
    folders: Vec<String>,
) -> Result<(), String> {
    validate_window_folders(&folders)?;
    open_folders.update(window.label(), &folders)
}

fn validate_window_folders(folders: &[String]) -> Result<(), String> {
    if let Some(folder) = folders
        .iter()
        .find(|folder| folder.trim().is_empty() || !std::path::Path::new(folder).is_absolute())
    {
        return Err(format!("Invalid repository path: {folder:?}"));
    }
    Ok(())
}

const ACTIVATE_REPOSITORY_EVENT: &str = "pragma:workspace:activate-repository";

/// Creates a new independent workspace window that opens the given folder.
/// If the folder is already open in another window, that window is focused
/// and asked to activate it instead. The window starts hidden; the frontend
/// reveals it after first paint, same as the main window (see src/main.tsx).
pub fn create_workspace_window(app: &AppHandle, folder_path: &str) -> Result<String, String> {
    if let Some(open_folders) = app.try_state::<OpenFolders>() {
        if let Some(label) = open_folders.label_for(folder_path) {
            if let Some(window) = app.get_webview_window(&label) {
                let _ = window.unminimize();
                let _ = window.set_focus();
                if let Err(err) = app.emit_to(
                    label.as_str(),
                    ACTIVATE_REPOSITORY_EVENT,
                    serde_json::json!({ "path": folder_path }),
                ) {
                    log::warn!("failed to emit activate-repository event: {err}");
                }
                return Ok(label);
            }
            open_folders.update(&label, &[])?;
        }
    }

    let label = next_workspace_label(app);
    let url = format!("index.html?folder={}", url_encode(folder_path));

    let builder = WebviewWindowBuilder::new(app, &label, WebviewUrl::App(url.into()))
        .title("Pragma")
        .resizable(true)
        .visible(false)
        .inner_size(1200.0, 800.0);

    #[cfg_attr(not(target_os = "macos"), allow(unused_variables))]
    let created = apply_window_chrome(builder, false)
        .build()
        .map_err(|err| format!("Failed to create workspace window: {err}"))?;
    #[cfg(target_os = "macos")]
    crate::macos_chrome::align_webview(&created);

    if let Some(open_folders) = app.try_state::<OpenFolders>() {
        open_folders.update(&label, &[folder_path.to_string()])?;
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
        folders.update("main", &[path.to_string()]).unwrap();
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
        folders.update("main", &[first.to_string()]).unwrap();
        folders.update("main", &[second.to_string()]).unwrap();
        assert_eq!(folders.label_for(first), None);
        assert_eq!(folders.label_for(second), Some("main".to_string()));
    }

    #[test]
    fn open_folders_update_empty_clears_label() {
        let folders = OpenFolders::default();
        let path = if cfg!(target_os = "windows") {
            "C:\\a"
        } else {
            "/a"
        };
        folders.update("main", &[path.to_string()]).unwrap();
        folders.update("main", &[]).unwrap();
        assert_eq!(folders.label_for(path), None);
    }

    #[test]
    fn open_folders_update_registers_several_folders_per_window() {
        let folders = OpenFolders::default();
        let paths: Vec<String> = if cfg!(target_os = "windows") {
            vec!["C:\\a".into(), "C:\\b".into(), "C:\\c".into()]
        } else {
            vec!["/a".into(), "/b".into(), "/c".into()]
        };
        folders.update("main", &paths).unwrap();
        for path in &paths {
            assert_eq!(folders.label_for(path), Some("main".to_string()));
        }
    }

    #[test]
    fn open_folders_update_drops_closed_folders_and_keeps_other_windows() {
        let folders = OpenFolders::default();
        let (a, b, c) = if cfg!(target_os = "windows") {
            ("C:\\a", "C:\\b", "C:\\c")
        } else {
            ("/a", "/b", "/c")
        };
        folders
            .update("main", &[a.to_string(), b.to_string()])
            .unwrap();
        folders.update("workspace-2", &[c.to_string()]).unwrap();
        folders.update("main", &[b.to_string()]).unwrap();
        assert_eq!(folders.label_for(a), None);
        assert_eq!(folders.label_for(b), Some("main".to_string()));
        assert_eq!(folders.label_for(c), Some("workspace-2".to_string()));
    }

    #[test]
    fn header_height_outside_the_range_is_rejected() {
        assert!(super::validate_header_height(19).is_err());
        assert!(super::validate_header_height(20).is_ok());
        assert!(super::validate_header_height(96).is_ok());
        assert!(super::validate_header_height(97).is_err());
    }

    #[test]
    fn validate_window_folders_rejects_empty_and_relative_paths() {
        let absolute = if cfg!(target_os = "windows") {
            "C:\\a"
        } else {
            "/a"
        };
        assert!(validate_window_folders(&[absolute.to_string()]).is_ok());
        assert!(validate_window_folders(&[]).is_ok());
        assert!(validate_window_folders(&[String::new()]).is_err());
        assert!(validate_window_folders(&["relative/path".to_string()]).is_err());
    }

    #[test]
    fn open_folders_label_for_matches_normalized_key() {
        let folders = OpenFolders::default();
        let (registered, lookup) = if cfg!(target_os = "windows") {
            ("C:\\Projects\\Pragma", "c:/projects/pragma/")
        } else {
            ("/home/user/pragma", "/home/user/pragma/")
        };
        folders
            .update("workspace-2", &[registered.to_string()])
            .unwrap();
        assert_eq!(folders.label_for(lookup), Some("workspace-2".to_string()));
    }
}
