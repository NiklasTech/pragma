use std::collections::HashMap;
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Deserialize;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

fn thread_debug() -> String {
    let current = std::thread::current();
    format!(
        "thread_id={:?} thread_name={}",
        current.id(),
        current.name().unwrap_or("unnamed")
    )
}

fn floating_debug_paths() -> Vec<PathBuf> {
    let mut paths = vec![std::env::temp_dir().join("pragma-floating-debug.log")];
    if let Ok(cwd) = std::env::current_dir() {
        paths.push(cwd.join("pragma-floating-debug.log"));
        paths.push(cwd.join("..").join("pragma-floating-debug.log"));
    }
    paths
}

fn write_floating_debug(message: &str) {
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let line = format!("{ts} {message}\n");
    eprintln!("[pragma-floating] {message}");
    for path in floating_debug_paths() {
        if let Ok(mut file) = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&path)
        {
            let _ = file.write_all(line.as_bytes());
        }
    }
}

fn clear_floating_debug() {
    for path in floating_debug_paths() {
        let _ = std::fs::write(&path, "");
    }
}

/// Appends a line to the floating-window debug log. Returns the temp log path.
#[tauri::command]
pub fn floating_debug_log(message: String) -> Result<String, String> {
    write_floating_debug(&format!("[js] {message}"));
    Ok(std::env::temp_dir()
        .join("pragma-floating-debug.log")
        .display()
        .to_string())
}

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

fn is_valid_node_id(node_id: &str) -> bool {
    !node_id.is_empty()
        && node_id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == ':' || c == '/')
}

fn build_label(node_id: &str) -> String {
    if node_id.starts_with(LABEL_PREFIX) {
        node_id.to_string()
    } else {
        format!("{LABEL_PREFIX}{node_id}")
    }
}

/// Creates a new external floating window for the given layout node.
///
/// WebView2 on Windows paints a blank white surface if the webview is created
/// off the UI thread (Tauri commands do not run on the main thread).
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

    clear_floating_debug();
    write_floating_debug(&format!(
        "[rust] create_external_window start {} node_id={} parent={} bounds={:?} {}",
        thread_debug(),
        request.node_id,
        window.label(),
        request.bounds,
        thread_debug()
    ));

    let label = build_label(&request.node_id);
    let parent = window.label().to_string();
    let url = floating_app_url(&request.node_id, &parent);
    let init_script = floating_init_script(&request.node_id, &parent)?;
    write_floating_debug(&format!(
        "[rust] label={label} url={url} init_script_len={}",
        init_script.len()
    ));
    let title = request.title;
    let bounds = request.bounds;

    let (tx, rx) = std::sync::mpsc::channel();
    let app_main = app.clone();
    let label_main = label.clone();
    write_floating_debug(&format!(
        "[rust] scheduling run_on_main_thread {}",
        thread_debug()
    ));
    app.run_on_main_thread(move || {
        write_floating_debug(&format!(
            "[rust] inside run_on_main_thread {}",
            thread_debug()
        ));
        let result = create_external_window_on_main(
            &app_main,
            &label_main,
            &url,
            &init_script,
            &title,
            &bounds,
        );
        write_floating_debug(&format!("[rust] main-thread build result={result:?}"));
        let _ = tx.send(result);
    })
    .map_err(|err| {
        let msg = format!("Failed to schedule window creation: {err}");
        write_floating_debug(&format!("[rust] {msg}"));
        msg
    })?;

    let result = rx
        .recv()
        .map_err(|err| format!("Window creation was cancelled: {err}"))?;
    write_floating_debug(&format!("[rust] create_external_window done {result:?}"));
    result
}

fn create_external_window_on_main(
    app: &AppHandle,
    label: &str,
    url: &str,
    init_script: &str,
    title: &str,
    bounds: &WindowBounds,
) -> Result<String, String> {
    if app.get_webview_window(label).is_some() {
        return Err(format!("External window {label} already exists"));
    }

    let builder = WebviewWindowBuilder::new(app, label, WebviewUrl::App(url.into()))
        .title(title)
        .resizable(true)
        .visible(true)
        .inner_size(bounds.width as f64, bounds.height as f64)
        .position(bounds.x as f64, bounds.y as f64)
        .initialization_script(init_script);

    #[cfg(target_os = "windows")]
    let builder = builder.decorations(true);
    #[cfg(not(target_os = "windows"))]
    let builder = builder.decorations(false);

    let built = builder
        .build()
        .map_err(|err| format!("Failed to create external window: {err}"))?;

    match built.url() {
        Ok(loaded) => write_floating_debug(&format!("[rust] webview.url={loaded}")),
        Err(err) => write_floating_debug(&format!("[rust] webview.url error={err}")),
    }

    let paint = r#"(function(){function paint(){try{document.documentElement.style.backgroundColor='#e100ff';if(document.body){document.body.style.backgroundColor='#e100ff';if(!document.getElementById('pragma-float-debug')){var d=document.createElement('div');d.id='pragma-float-debug';d.textContent='FLOATING EVAL';d.style.cssText='position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:#e100ff;color:#fff;font:20px sans-serif;';document.body.appendChild(d);}}}catch(e){}}paint();setTimeout(paint,100);setTimeout(paint,500);setTimeout(paint,1500);})();"#;
    match built.eval(paint) {
        Ok(()) => write_floating_debug("[rust] eval paint ok"),
        Err(err) => write_floating_debug(&format!("[rust] eval paint error={err}")),
    }

    Ok(label.to_string())
}

fn floating_app_url(node_id: &str, parent: &str) -> String {
    // Same entry as the main/workspace windows. A second HTML file plus a
    // hash fragment 404s as a blank WebView2 on Windows; query params on
    // index.html already work for workspace windows.
    format!(
        "index.html?nodeId={}&parent={}",
        url_encode(node_id),
        url_encode(parent)
    )
}

fn floating_init_script(node_id: &str, parent: &str) -> Result<String, String> {
    let payload = serde_json::json!({
        "nodeId": node_id,
        "parent": parent,
    });
    Ok(format!(
        r#"window.__PRAGMA_FLOATING__ = {payload};
(function(){{
  function paint(){{
    try {{
      document.documentElement.style.backgroundColor = '#e100ff';
      document.documentElement.style.color = '#fff';
      if (document.body) {{
        document.body.style.backgroundColor = '#e100ff';
        if (!document.getElementById('pragma-float-debug')) {{
          var d = document.createElement('div');
          d.id = 'pragma-float-debug';
          d.textContent = 'FLOATING INIT ' + (window.__PRAGMA_FLOATING__ && window.__PRAGMA_FLOATING__.nodeId);
          d.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:#e100ff;color:#fff;font:18px sans-serif;';
          document.body.appendChild(d);
        }}
      }}
    }} catch (e) {{}}
  }}
  paint();
  document.addEventListener('DOMContentLoaded', paint);
  setTimeout(paint, 50);
  setTimeout(paint, 250);
  setTimeout(paint, 1000);
}})();"#
    ))
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
    fn floating_app_url_uses_index_html_query() {
        let url = floating_app_url("floating-abc", "main");
        assert!(url.starts_with("index.html?"));
        assert!(!url.contains('#'));
        assert!(url.contains("nodeId=floating-abc"));
        assert!(url.contains("parent=main"));
    }

    #[test]
    fn floating_init_script_json_escapes_quotes() {
        let script = floating_init_script("id\"x", "main").unwrap();
        let payload = serde_json::json!({ "nodeId": "id\"x", "parent": "main" }).to_string();
        assert!(script.contains(&format!("window.__PRAGMA_FLOATING__ = {payload};")));
        assert!(script.contains("FLOATING INIT"));
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
