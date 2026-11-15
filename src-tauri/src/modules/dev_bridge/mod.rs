//! Debug builds only: lets coding agents drive Pragma Dev (inspect, click, type, screenshot,
//! read logs) through a loopback bridge. `scripts/dev-bridge-mcp.mjs` exposes it as MCP tools.

mod actions;
mod backend_logs;
mod menu;
mod occlusion;
mod page;
mod protocol;
mod server;

use tauri::plugin::{Builder, TauriPlugin};
use tauri::{RunEvent, Url, Wry};

const PAGE_AGENT_SCRIPT: &str = include_str!("page_agent.js");
const APP_ORIGINS_PLACEHOLDER: &str = "__PRAGMA_APP_ORIGINS__";

/// Injects the page agent into the app pages and serves the bridge while the app runs.
pub fn init(dev_url: Option<&Url>) -> TauriPlugin<Wry> {
    let origins = serde_json::to_string(&super::browser_pane::app_origins(dev_url))
        .unwrap_or_else(|_| "[]".to_string());
    Builder::new("dev-bridge")
        .js_init_script(PAGE_AGENT_SCRIPT.replace(APP_ORIGINS_PLACEHOLDER, &origins))
        .on_webview_ready(|webview| occlusion::keep_rendering_when_covered(&webview))
        .setup(|app, _api| {
            server::start(app.clone());
            Ok(())
        })
        .on_event(|app, event| {
            if let RunEvent::Exit = event {
                server::remove_discovery_file(app);
            }
        })
        .build()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_page_agent_lists_the_app_origins() {
        assert!(PAGE_AGENT_SCRIPT.contains(APP_ORIGINS_PLACEHOLDER));
    }
}
