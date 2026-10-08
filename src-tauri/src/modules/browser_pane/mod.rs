//! Lets agents inspect the browser pane: a console capture in its frame and a webview snapshot.

pub mod snapshot;

use tauri::plugin::{Builder, TauriPlugin};
use tauri::Runtime;

const CONSOLE_CAPTURE_SCRIPT: &str = include_str!("console_capture.js");

/// Injects the console capture into every frame; it only activates in child frames of the app.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("browser-pane")
        .js_init_script_on_all_frames(CONSOLE_CAPTURE_SCRIPT)
        .build()
}
