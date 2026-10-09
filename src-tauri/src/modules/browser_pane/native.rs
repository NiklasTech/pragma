//! A native child webview over a browser pane, for sites that refuse to be framed.

use serde::Deserialize;
use tauri::{
    AppHandle, LogicalPosition, LogicalSize, Manager, Runtime, Url, Webview, WebviewBuilder,
    WebviewUrl,
};

const LABEL_PREFIX: &str = "browser-pane-";
const MAX_LEAF_ID_CHARS: usize = 64;
const MAX_URL_CHARS: usize = 4096;
const MAX_EXTENT: f64 = 20_000.0;

/// Pane area in logical pixels, relative to the window content.
#[derive(Debug, Clone, Copy, Deserialize)]
pub struct PaneBounds {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

fn label_for(leaf_id: &str) -> Result<String, String> {
    let valid = !leaf_id.is_empty()
        && leaf_id.chars().count() <= MAX_LEAF_ID_CHARS
        && leaf_id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_');
    if !valid {
        return Err("Invalid browser pane id".to_string());
    }
    Ok(format!("{LABEL_PREFIX}{leaf_id}"))
}

fn validate_bounds(bounds: PaneBounds) -> Result<PaneBounds, String> {
    let values = [bounds.x, bounds.y, bounds.width, bounds.height];
    if values
        .iter()
        .any(|value| !value.is_finite() || value.abs() > MAX_EXTENT)
        || bounds.width < 0.0
        || bounds.height < 0.0
    {
        return Err("Invalid browser pane bounds".to_string());
    }
    Ok(bounds)
}

/// Only remote http(s) pages; the app's own origin would get access to its commands.
fn is_allowed_url(url: &Url, app_origin: Option<&Url>) -> bool {
    let remote_scheme = matches!(url.scheme(), "http" | "https");
    let app_host = url
        .host_str()
        .is_some_and(|host| host == "tauri.localhost" || host.ends_with(".tauri.localhost"));
    let same_as_app = app_origin.is_some_and(|app| app.origin() == url.origin());
    remote_scheme && !app_host && !same_as_app
}

fn parse_url(raw: &str, app_origin: Option<&Url>) -> Result<Url, String> {
    if raw.chars().count() > MAX_URL_CHARS {
        return Err("URL is too long".to_string());
    }
    let url = Url::parse(raw).map_err(|e| format!("Invalid URL: {e}"))?;
    if !is_allowed_url(&url, app_origin) {
        return Err("Only http and https pages open in a native browser pane".to_string());
    }
    Ok(url)
}

/// The dev server serves the app only in debug builds; release builds use the tauri protocol.
fn app_origin<R: Runtime>(app: &AppHandle<R>) -> Option<Url> {
    if cfg!(debug_assertions) {
        app.config().build.dev_url.clone()
    } else {
        None
    }
}

fn place<R: Runtime>(webview: &Webview<R>, bounds: PaneBounds) -> Result<(), String> {
    webview
        .set_position(LogicalPosition::new(bounds.x, bounds.y))
        .and_then(|_| webview.set_size(LogicalSize::new(bounds.width, bounds.height)))
        .map_err(|e| format!("Failed to place the browser pane: {e}"))
}

/// Shows `url` in the pane's native webview, creating it in the caller's window when needed.
#[tauri::command]
pub async fn browser_webview_show<R: Runtime>(
    app: AppHandle<R>,
    webview: Webview<R>,
    leaf_id: String,
    url: String,
    bounds: PaneBounds,
) -> Result<(), String> {
    let label = label_for(&leaf_id)?;
    let bounds = validate_bounds(bounds)?;
    let origin = app_origin(&app);
    let url = parse_url(&url, origin.as_ref())?;

    if let Some(existing) = app.get_webview(&label) {
        place(&existing, bounds)?;
        let current = existing.url().ok();
        if current.as_ref() != Some(&url) {
            existing
                .navigate(url)
                .map_err(|e| format!("Failed to open the page: {e}"))?;
        }
        return existing
            .show()
            .map_err(|e| format!("Failed to show the browser pane: {e}"));
    }

    let builder = WebviewBuilder::new(&label, WebviewUrl::External(url))
        .on_navigation(move |target| is_allowed_url(target, origin.as_ref()));
    webview
        .window()
        .add_child(
            builder,
            LogicalPosition::new(bounds.x, bounds.y),
            LogicalSize::new(bounds.width, bounds.height),
        )
        .map(|_| ())
        .map_err(|e| format!("Failed to create the browser pane: {e}"))
}

/// Moves the pane's native webview, or hides it while the pane is covered or off screen.
#[tauri::command]
pub async fn browser_webview_place<R: Runtime>(
    app: AppHandle<R>,
    leaf_id: String,
    bounds: PaneBounds,
    visible: bool,
) -> Result<(), String> {
    let label = label_for(&leaf_id)?;
    let bounds = validate_bounds(bounds)?;
    let Some(webview) = app.get_webview(&label) else {
        return Ok(());
    };
    if !visible {
        return webview
            .hide()
            .map_err(|e| format!("Failed to hide the browser pane: {e}"));
    }
    place(&webview, bounds)?;
    webview
        .show()
        .map_err(|e| format!("Failed to show the browser pane: {e}"))
}

#[tauri::command]
pub async fn browser_webview_close<R: Runtime>(
    app: AppHandle<R>,
    leaf_id: String,
) -> Result<(), String> {
    let label = label_for(&leaf_id)?;
    match app.get_webview(&label) {
        Some(webview) => webview
            .close()
            .map_err(|e| format!("Failed to close the browser pane: {e}")),
        None => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn url(raw: &str) -> Url {
        Url::parse(raw).unwrap()
    }

    #[test]
    fn labels_come_only_from_plain_ids() {
        assert_eq!(label_for("leaf-1_a").unwrap(), "browser-pane-leaf-1_a");
        assert!(label_for("").is_err());
        assert!(label_for("../main").is_err());
        assert!(label_for(&"a".repeat(65)).is_err());
    }

    #[test]
    fn only_remote_pages_are_allowed() {
        let dev = url("http://localhost:5173");
        assert!(is_allowed_url(&url("https://github.com/"), Some(&dev)));
        assert!(is_allowed_url(&url("http://localhost:3000/"), Some(&dev)));
        assert!(!is_allowed_url(
            &url("http://localhost:5173/settings"),
            Some(&dev)
        ));
        assert!(!is_allowed_url(&url("https://tauri.localhost/"), None));
        assert!(!is_allowed_url(&url("tauri://localhost/"), None));
        assert!(!is_allowed_url(&url("file:///etc/passwd"), None));
        assert!(parse_url("not a url", None).is_err());
    }

    #[test]
    fn bounds_must_be_finite_and_positive() {
        let ok = PaneBounds {
            x: 10.0,
            y: 20.0,
            width: 300.0,
            height: 200.0,
        };
        assert!(validate_bounds(ok).is_ok());
        assert!(validate_bounds(PaneBounds { width: -1.0, ..ok }).is_err());
        assert!(validate_bounds(PaneBounds { x: f64::NAN, ..ok }).is_err());
        assert!(validate_bounds(PaneBounds { height: 1e9, ..ok }).is_err());
    }
}
