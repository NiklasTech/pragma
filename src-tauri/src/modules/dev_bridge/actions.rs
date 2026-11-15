use base64::Engine;
use serde_json::Value;
use tauri::{AppHandle, Manager, WebviewWindow};

use super::protocol::{number_arg, BridgeReply, BridgeRequest};
use super::{backend_logs, menu, page};
use crate::modules::browser_pane::snapshot::capture_png;

pub async fn run(app: &AppHandle, request: BridgeRequest) -> BridgeReply {
    let window = request.window.as_deref();
    let result = match request.action.as_str() {
        "status" => Ok(status(app)),
        "screenshot" => screenshot(app, window).await,
        "backend_logs" => backend_logs::read(app, number_arg(&request.args, "lines", 100, 1, 2000)),
        "menu" => menu::run(app, request.args.get("id").and_then(Value::as_str)),
        action if page::ACTIONS.contains(&action) => match target_window(app, window) {
            Ok(target) => page::run(&target, action, &request.args).await,
            Err(e) => Err(e),
        },
        other => Err(format!("Unknown action: {other}")),
    };
    result.unwrap_or_else(BridgeReply::error)
}

/// The named window, otherwise the focused one, otherwise `main`.
fn target_window(app: &AppHandle, label: Option<&str>) -> Result<WebviewWindow, String> {
    let windows = app.webview_windows();
    if let Some(label) = label {
        return windows.get(label).cloned().ok_or_else(|| {
            let mut labels: Vec<&String> = windows.keys().collect();
            labels.sort();
            format!("No window {label:?}; open windows: {labels:?}")
        });
    }
    windows
        .values()
        .find(|window| window.is_focused().unwrap_or(false))
        .or_else(|| windows.get("main"))
        .or_else(|| windows.values().next())
        .cloned()
        .ok_or_else(|| "Pragma Dev has no open window".to_string())
}

fn status(app: &AppHandle) -> BridgeReply {
    let mut windows: Vec<WebviewWindow> = app.webview_windows().into_values().collect();
    windows.sort_by(|a, b| a.label().cmp(b.label()));
    let mut lines = vec![format!(
        "Pragma Dev is running (pid {}). Windows:",
        std::process::id()
    )];
    for window in windows {
        let size = window
            .inner_size()
            .ok()
            .zip(window.scale_factor().ok())
            .map(|(size, scale)| {
                let logical = size.to_logical::<u32>(scale);
                format!("{}x{}", logical.width, logical.height)
            })
            .unwrap_or_default();
        let flags = [
            (window.is_focused().unwrap_or(false), "focused"),
            (!window.is_visible().unwrap_or(true), "hidden"),
            (window.is_minimized().unwrap_or(false), "minimized"),
        ]
        .iter()
        .filter(|(on, _)| *on)
        .map(|(_, name)| *name)
        .collect::<Vec<_>>()
        .join(", ");
        lines.push(format!(
            "- {} \"{}\" {} {}{}",
            window.label(),
            window.title().unwrap_or_default(),
            window.url().map(|url| url.to_string()).unwrap_or_default(),
            size,
            if flags.is_empty() {
                String::new()
            } else {
                format!(" ({flags})")
            }
        ));
    }
    BridgeReply::text(lines.join("\n"))
}

async fn screenshot(app: &AppHandle, label: Option<&str>) -> Result<BridgeReply, String> {
    let window = target_window(app, label)?;
    let png = capture_png(window.as_ref()).await?;
    Ok(BridgeReply {
        ok: true,
        text: format!(
            "Screenshot of window {} at {}x the CSS pixels that click coordinates use",
            window.label(),
            window.scale_factor().unwrap_or(1.0)
        ),
        image: Some(base64::engine::general_purpose::STANDARD.encode(png)),
    })
}
