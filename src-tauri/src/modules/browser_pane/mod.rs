//! Lets agents inspect the browser pane: a console capture in its frame and a webview snapshot.

pub mod native;
pub mod snapshot;

use tauri::plugin::{Builder, TauriPlugin};
use tauri::{Runtime, Url};

const CONSOLE_CAPTURE_SCRIPT: &str = include_str!("console_capture.js");
const APP_ORIGINS_PLACEHOLDER: &str = "__PRAGMA_APP_ORIGINS__";
const BUNDLED_APP_ORIGINS: [&str; 3] = [
    "tauri://localhost",
    "http://tauri.localhost",
    "https://tauri.localhost",
];

/// Origins the app page is served from; the dev server only in debug builds.
fn app_origins(dev_url: Option<&Url>) -> Vec<String> {
    let mut origins: Vec<String> = BUNDLED_APP_ORIGINS.iter().map(|o| o.to_string()).collect();
    if cfg!(debug_assertions) {
        if let Some(url) = dev_url {
            origins.push(url.origin().ascii_serialization());
        }
    }
    origins
}

/// Injects the console capture into every frame; it only activates in child frames of the app,
/// never in frames of pages shown in a native browser pane.
pub fn init<R: Runtime>(dev_url: Option<&Url>) -> TauriPlugin<R> {
    let origins = serde_json::to_string(&app_origins(dev_url)).unwrap_or_else(|_| "[]".to_string());
    Builder::new("browser-pane")
        .js_init_script_on_all_frames(
            CONSOLE_CAPTURE_SCRIPT.replace(APP_ORIGINS_PLACEHOLDER, &origins),
        )
        .build()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_capture_script_lists_the_app_origins() {
        assert!(CONSOLE_CAPTURE_SCRIPT.contains(APP_ORIGINS_PLACEHOLDER));
        let dev = Url::parse("http://localhost:5173/").unwrap();
        let origins = app_origins(Some(&dev));
        assert!(origins.contains(&"tauri://localhost".to_string()));
        assert!(origins.contains(&"http://localhost:5173".to_string()));
    }
}
