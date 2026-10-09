//! Keeps the app manifest in build.rs in step with the registered commands; a command missing
//! from it is denied at runtime.

use std::collections::BTreeSet;

fn manifest_commands() -> BTreeSet<String> {
    include_str!("../build.rs")
        .lines()
        .filter_map(|line| line.trim().strip_prefix('"')?.strip_suffix("\","))
        .map(str::to_string)
        .collect()
}

fn registered_commands() -> BTreeSet<String> {
    let source = include_str!("lib.rs");
    let start = source
        .find("generate_handler![")
        .expect("lib.rs registers commands");
    let end = start
        + source[start..]
            .find("])")
            .expect("the handler list is closed");
    source[start + "generate_handler![".len()..end]
        .split(',')
        .map(str::trim)
        .filter(|entry| !entry.is_empty() && !entry.starts_with("//"))
        .filter_map(|entry| entry.rsplit("::").next())
        .map(str::to_string)
        .collect()
}

#[test]
fn every_registered_command_has_a_permission() {
    let registered = registered_commands();
    assert!(
        registered.len() > 100,
        "parsed {} commands",
        registered.len()
    );
    assert_eq!(manifest_commands(), registered);
}

#[test]
fn the_permission_set_allows_every_command() {
    let set = include_str!("../permissions/app-commands.toml");
    for command in manifest_commands() {
        let permission = format!("\"allow-{}\"", command.replace('_', "-"));
        assert!(set.contains(&permission), "{permission} is missing");
    }
}

#[test]
fn only_the_app_webviews_may_call_commands() {
    use tauri::ipc::{CallbackFn, InvokeBody};
    use tauri::test::{get_ipc_response, mock_builder, INVOKE_KEY};
    use tauri::webview::InvokeRequest;
    use tauri::WebviewWindowBuilder;

    let app = mock_builder()
        .invoke_handler(tauri::generate_handler![crate::modules::fs::list_directory])
        .build(tauri::generate_context!(test = true))
        .expect("mock app");
    let dir = tempfile::tempdir().expect("tempdir");
    let request = || InvokeRequest {
        cmd: "list_directory".into(),
        callback: CallbackFn(0),
        error: CallbackFn(1),
        url: if cfg!(windows) {
            "http://tauri.localhost"
        } else {
            "tauri://localhost"
        }
        .parse()
        .expect("url"),
        body: InvokeBody::Json(serde_json::json!({ "path": dir.path() })),
        headers: Default::default(),
        invoke_key: INVOKE_KEY.to_string(),
    };

    for label in ["main", "workspace-1", "floating-panel"] {
        let webview = WebviewWindowBuilder::new(&app, label, Default::default())
            .build()
            .expect("webview");
        assert!(get_ipc_response(&webview, request()).is_ok(), "{label}");
    }
    let browser = WebviewWindowBuilder::new(&app, "browser-pane-leaf", Default::default())
        .build()
        .expect("webview");
    assert!(get_ipc_response(&browser, request()).is_err());
}
