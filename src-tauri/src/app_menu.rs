use tauri::AppHandle;

#[cfg(target_os = "macos")]
use serde::Serialize;
#[cfg(target_os = "macos")]
use tauri::menu::{
    AboutMetadata, CheckMenuItem, MenuBuilder, MenuItem, PredefinedMenuItem, Submenu,
    SubmenuBuilder,
};
#[cfg(target_os = "macos")]
use tauri::{Emitter, Manager, Wry};

#[cfg(target_os = "macos")]
const MENU_EVENT: &str = "pragma:menu";
const RECENT_PREFIX: &str = "recent:";
#[cfg(target_os = "macos")]
const RECENT_EMPTY_ID: &str = "file.openRecentMenu.empty";
const TOGGLE_TERMINAL_MENU_ID: &str = "view.toggleTerminalMenu";

const MENU_ACTION_IDS: &[&str] = &[
    "app.checkForUpdates",
    "app.openGitHub",
    "file.open",
    "file.openFolder",
    "file.save",
    "file.closeTab",
    "file.goToFile",
    "tab.next",
    "tab.prev",
    "search.find",
    "search.replace",
    "search.findInFiles",
    "editor.formatDocument",
    "edit.editWithAI",
    "view.commandPalette",
    "view.toggleSidebar",
    "view.toggleTerminal",
    "view.toggleProblems",
    "view.togglePreview",
    "view.splitEditor",
    "view.switchToAgents",
    "view.switchToEditor",
    "view.toggleUiMode",
    "view.newTerminalTab",
    "view.openSettings",
    "ai.toggle",
    "debug.currentFile",
    "debug.stop",
    "debug.stepOver",
    "debug.stepInto",
    "debug.stepOut",
    "debug.toggleBreakpoint",
];

fn parse_recent_menu_id(id: &str) -> Option<&str> {
    id.strip_prefix(RECENT_PREFIX)
}

fn resolve_menu_event(id: &str) -> Option<(&str, Option<String>)> {
    if let Some(path) = parse_recent_menu_id(id) {
        return Some(("file.openRecent", Some(path.to_string())));
    }
    if id == TOGGLE_TERMINAL_MENU_ID {
        return Some(("view.toggleTerminal", None));
    }
    MENU_ACTION_IDS.contains(&id).then_some((id, None))
}

#[cfg_attr(not(target_os = "macos"), allow(unused_variables))]
pub fn handle_menu_event(app: &AppHandle, id: &str) {
    let Some((action, path)) = resolve_menu_event(id) else {
        return;
    };
    #[cfg(target_os = "macos")]
    emit_menu_event(app, action, path);
}

#[cfg(target_os = "macos")]
fn emit_menu_event(app: &AppHandle, action: &str, path: Option<String>) {
    let payload = MenuPayload {
        action: action.to_string(),
        path,
    };
    let focused = app
        .webview_windows()
        .into_values()
        .find(|window| window.is_focused().unwrap_or(false));
    if let Some(window) = focused {
        let _ = window.emit(MENU_EVENT, payload);
    } else if let Some(main) = app.get_webview_window("main") {
        let _ = main.emit(MENU_EVENT, payload);
    }
}

#[cfg(target_os = "macos")]
#[derive(Clone, Serialize)]
struct MenuPayload {
    action: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    path: Option<String>,
}

#[cfg(target_os = "macos")]
struct AppMenuState {
    recent_menu: Submenu<Wry>,
    save_item: MenuItem<Wry>,
    toggle_sidebar_item: CheckMenuItem<Wry>,
    toggle_terminal_item: CheckMenuItem<Wry>,
    toggle_ai_item: CheckMenuItem<Wry>,
}

#[cfg(target_os = "macos")]
pub fn init(app: &AppHandle) -> tauri::Result<()> {
    let about_metadata = AboutMetadata {
        name: Some("Pragma".to_string()),
        version: Some(app.package_info().version.to_string()),
        ..Default::default()
    };

    let save_item = MenuItem::with_id(app, "file.save", "Save", false, Some("CmdOrCtrl+S"))?;
    let toggle_sidebar_item = CheckMenuItem::with_id(
        app,
        "view.toggleSidebar",
        "Toggle Sidebar",
        true,
        false,
        Some("CmdOrCtrl+B"),
    )?;
    let toggle_terminal_item = CheckMenuItem::with_id(
        app,
        "view.toggleTerminal",
        "Toggle Terminal",
        true,
        false,
        Some("CmdOrCtrl+Shift+T"),
    )?;
    let toggle_ai_item = CheckMenuItem::with_id(
        app,
        "ai.toggle",
        "Toggle AI Chat",
        true,
        false,
        Some("CmdOrCtrl+Shift+A"),
    )?;

    let recent_menu = SubmenuBuilder::with_id(app, "file.openRecentMenu", "Open Recent")
        .item(&MenuItem::with_id(
            app,
            RECENT_EMPTY_ID,
            "No Recent Folders",
            false,
            None::<&str>,
        )?)
        .build()?;

    let pragma = SubmenuBuilder::new(app, "Pragma")
        .item(&PredefinedMenuItem::about(
            app,
            Some("About Pragma"),
            Some(about_metadata),
        )?)
        .item(&MenuItem::with_id(
            app,
            "app.checkForUpdates",
            "Check for Updates",
            true,
            None::<&str>,
        )?)
        .separator()
        .item(&MenuItem::with_id(
            app,
            "view.openSettings",
            "Settings…",
            true,
            Some("CmdOrCtrl+,"),
        )?)
        .separator()
        .item(&PredefinedMenuItem::services(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::hide(app, None)?)
        .item(&PredefinedMenuItem::hide_others(app, None)?)
        .item(&PredefinedMenuItem::show_all(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::quit(app, None)?)
        .build()?;

    let file = SubmenuBuilder::new(app, "File")
        .item(&MenuItem::with_id(
            app,
            "file.open",
            "Open File",
            true,
            Some("CmdOrCtrl+O"),
        )?)
        .item(&MenuItem::with_id(
            app,
            "file.openFolder",
            "Open Folder",
            true,
            None::<&str>,
        )?)
        .item(&recent_menu)
        .separator()
        .item(&save_item)
        .separator()
        .item(&MenuItem::with_id(
            app,
            "file.closeTab",
            "Close Tab",
            true,
            Some("CmdOrCtrl+W"),
        )?)
        .build()?;

    let edit = SubmenuBuilder::new(app, "Edit")
        .item(&PredefinedMenuItem::undo(app, None)?)
        .item(&PredefinedMenuItem::redo(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::cut(app, None)?)
        .item(&PredefinedMenuItem::copy(app, None)?)
        .item(&PredefinedMenuItem::paste(app, None)?)
        .item(&PredefinedMenuItem::select_all(app, None)?)
        .separator()
        .item(&MenuItem::with_id(
            app,
            "search.find",
            "Find",
            true,
            Some("CmdOrCtrl+F"),
        )?)
        .item(&MenuItem::with_id(
            app,
            "search.replace",
            "Replace",
            true,
            Some("CmdOrCtrl+H"),
        )?)
        .item(&MenuItem::with_id(
            app,
            "search.findInFiles",
            "Find in Files",
            true,
            Some("CmdOrCtrl+Shift+F"),
        )?)
        .separator()
        .item(&MenuItem::with_id(
            app,
            "editor.formatDocument",
            "Format Document",
            true,
            Some("Shift+Alt+F"),
        )?)
        .item(&MenuItem::with_id(
            app,
            "edit.editWithAI",
            "Edit Selection with AI",
            true,
            Some("CmdOrCtrl+L"),
        )?)
        .build()?;

    let view = SubmenuBuilder::new(app, "View")
        .item(&MenuItem::with_id(
            app,
            "view.commandPalette",
            "Command Palette",
            true,
            Some("CmdOrCtrl+Shift+P"),
        )?)
        .separator()
        .item(&toggle_sidebar_item)
        .item(&toggle_terminal_item)
        .item(&toggle_ai_item)
        .item(&MenuItem::with_id(
            app,
            "view.toggleProblems",
            "Toggle Problems",
            true,
            Some("CmdOrCtrl+Shift+M"),
        )?)
        .item(&MenuItem::with_id(
            app,
            "view.togglePreview",
            "Toggle Preview",
            true,
            Some("CmdOrCtrl+Shift+V"),
        )?)
        .item(&MenuItem::with_id(
            app,
            "view.splitEditor",
            "Split Editor",
            true,
            Some("CmdOrCtrl+\\"),
        )?)
        .separator()
        .item(&MenuItem::with_id(
            app,
            "view.switchToAgents",
            "Switch to Agents",
            true,
            None::<&str>,
        )?)
        .item(&MenuItem::with_id(
            app,
            "view.switchToEditor",
            "Switch to Editor",
            true,
            None::<&str>,
        )?)
        .item(&MenuItem::with_id(
            app,
            "view.toggleUiMode",
            "Toggle Agents / Editor",
            true,
            Some("CmdOrCtrl+Shift+E"),
        )?)
        .separator()
        .item(&PredefinedMenuItem::fullscreen(app, None)?)
        .build()?;

    let go = SubmenuBuilder::new(app, "Go")
        .item(&MenuItem::with_id(
            app,
            "file.goToFile",
            "Go to File",
            true,
            Some("CmdOrCtrl+P"),
        )?)
        .item(&MenuItem::with_id(
            app,
            "tab.next",
            "Next Tab",
            true,
            None::<&str>,
        )?)
        .item(&MenuItem::with_id(
            app,
            "tab.prev",
            "Previous Tab",
            true,
            None::<&str>,
        )?)
        .build()?;

    let run = SubmenuBuilder::new(app, "Run")
        .item(&MenuItem::with_id(
            app,
            "debug.currentFile",
            "Start / Continue",
            true,
            Some("F5"),
        )?)
        .item(&MenuItem::with_id(
            app,
            "debug.stop",
            "Stop",
            true,
            Some("Shift+F5"),
        )?)
        .separator()
        .item(&MenuItem::with_id(
            app,
            "debug.stepOver",
            "Step Over",
            true,
            Some("F10"),
        )?)
        .item(&MenuItem::with_id(
            app,
            "debug.stepInto",
            "Step Into",
            true,
            Some("F11"),
        )?)
        .item(&MenuItem::with_id(
            app,
            "debug.stepOut",
            "Step Out",
            true,
            Some("Shift+F11"),
        )?)
        .separator()
        .item(&MenuItem::with_id(
            app,
            "debug.toggleBreakpoint",
            "Toggle Breakpoint",
            true,
            Some("F9"),
        )?)
        .build()?;

    let terminal = SubmenuBuilder::new(app, "Terminal")
        .item(&MenuItem::with_id(
            app,
            "view.newTerminalTab",
            "New Terminal Tab",
            true,
            Some("CmdOrCtrl+T"),
        )?)
        .item(&MenuItem::with_id(
            app,
            TOGGLE_TERMINAL_MENU_ID,
            "Toggle Terminal",
            true,
            None::<&str>,
        )?)
        .build()?;

    let window = SubmenuBuilder::new(app, "Window")
        .item(&PredefinedMenuItem::minimize(app, None)?)
        .item(&PredefinedMenuItem::maximize(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::bring_all_to_front(app, None)?)
        .build()?;

    let help = SubmenuBuilder::new(app, "Help")
        .item(&MenuItem::with_id(
            app,
            "app.openGitHub",
            "View on GitHub",
            true,
            None::<&str>,
        )?)
        .build()?;

    let menu = MenuBuilder::new(app)
        .items(&[
            &pragma, &file, &edit, &view, &go, &run, &terminal, &window, &help,
        ])
        .build()?;

    app.set_menu(menu)?;
    window.set_as_windows_menu_for_nsapp()?;
    help.set_as_help_menu_for_nsapp()?;

    app.manage(AppMenuState {
        recent_menu,
        save_item,
        toggle_sidebar_item,
        toggle_terminal_item,
        toggle_ai_item,
    });

    Ok(())
}

#[cfg(target_os = "macos")]
fn menu_state(app: &AppHandle) -> Result<tauri::State<'_, AppMenuState>, String> {
    app.try_state::<AppMenuState>()
        .ok_or_else(|| "app menu state is not initialized".to_string())
}

#[tauri::command]
#[cfg_attr(not(target_os = "macos"), allow(unused_variables))]
pub fn macos_menu_set_recent(app: AppHandle, paths: Vec<String>) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        set_recent(&app, &paths)
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(())
    }
}

#[tauri::command]
#[cfg_attr(not(target_os = "macos"), allow(unused_variables))]
pub fn macos_menu_set_enabled(app: AppHandle, id: String, enabled: bool) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let state = menu_state(&app)?;
        if id == "file.save" {
            state
                .save_item
                .set_enabled(enabled)
                .map_err(|e| e.to_string())?;
        }
        Ok(())
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(())
    }
}

#[tauri::command]
#[cfg_attr(not(target_os = "macos"), allow(unused_variables))]
pub fn macos_menu_set_checked(app: AppHandle, id: String, checked: bool) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let state = menu_state(&app)?;
        let result = match id.as_str() {
            "view.toggleSidebar" => state.toggle_sidebar_item.set_checked(checked),
            "view.toggleTerminal" => state.toggle_terminal_item.set_checked(checked),
            "ai.toggle" => state.toggle_ai_item.set_checked(checked),
            _ => return Ok(()),
        };
        result.map_err(|e| e.to_string())
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(())
    }
}

#[cfg(target_os = "macos")]
fn set_recent(app: &AppHandle, paths: &[String]) -> Result<(), String> {
    let state = menu_state(app)?;
    let recent_menu = &state.recent_menu;

    while !recent_menu.items().map_err(|e| e.to_string())?.is_empty() {
        recent_menu.remove_at(0).map_err(|e| e.to_string())?;
    }

    if paths.is_empty() {
        let empty = MenuItem::with_id(
            app,
            RECENT_EMPTY_ID,
            "No Recent Folders",
            false,
            None::<&str>,
        )
        .map_err(|e| e.to_string())?;
        recent_menu.append(&empty).map_err(|e| e.to_string())?;
    } else {
        for path in paths {
            let item = MenuItem::with_id(app, format!("recent:{path}"), path, true, None::<&str>)
                .map_err(|e| e.to_string())?;
            recent_menu.append(&item).map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{parse_recent_menu_id, resolve_menu_event, TOGGLE_TERMINAL_MENU_ID};

    #[test]
    fn parses_recent_prefix_and_preserves_extra_colons() {
        assert_eq!(
            parse_recent_menu_id("recent:/home/user/project"),
            Some("/home/user/project")
        );
        assert_eq!(
            parse_recent_menu_id("recent:C:\\work\\nested:dir"),
            Some("C:\\work\\nested:dir")
        );
    }

    #[test]
    fn ignores_ids_without_recent_prefix() {
        assert_eq!(parse_recent_menu_id("file.open"), None);
        assert_eq!(parse_recent_menu_id("file.openRecentMenu"), None);
    }

    #[test]
    fn resolve_maps_known_actions_and_aliases() {
        assert_eq!(resolve_menu_event("file.save"), Some(("file.save", None)));
        assert_eq!(
            resolve_menu_event(TOGGLE_TERMINAL_MENU_ID),
            Some(("view.toggleTerminal", None))
        );
        assert_eq!(
            resolve_menu_event("recent:/tmp/demo"),
            Some(("file.openRecent", Some("/tmp/demo".to_string())))
        );
        assert_eq!(resolve_menu_event("nsmenu.about"), None);
    }
}
