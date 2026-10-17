use std::collections::HashMap;

use tauri::AppHandle;

#[cfg(target_os = "macos")]
use serde::Serialize;
#[cfg(target_os = "macos")]
use tauri::image::Image;
#[cfg(target_os = "macos")]
use tauri::menu::{
    AboutMetadata, CheckMenuItem, MenuBuilder, MenuItem, PredefinedMenuItem, Submenu,
    SubmenuBuilder,
};
#[cfg(target_os = "macos")]
use tauri::{Emitter, Manager, Wry};

#[cfg(target_os = "macos")]
const APP_DISPLAY_NAME: &str = "Pragma";
#[cfg(target_os = "macos")]
const APP_COPYRIGHT: &str = "Copyright \u{00a9} 2026 NiklasTech";
#[cfg(target_os = "macos")]
const APP_CREDITS: &str = "A lightweight, AI-native desktop IDE.";

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
    "file.reopenClosedTab",
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
    "debug.attach",
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
    /// Menu items whose key equivalent follows the shortcut settings.
    shortcut_items: Vec<(&'static str, ShortcutItem)>,
}

#[cfg(target_os = "macos")]
enum ShortcutItem {
    Plain(MenuItem<Wry>),
    Check(CheckMenuItem<Wry>),
}

#[cfg(target_os = "macos")]
impl ShortcutItem {
    fn set_accelerator(&self, accelerator: Option<&str>) -> tauri::Result<()> {
        match self {
            Self::Plain(item) => item.set_accelerator(accelerator),
            Self::Check(item) => item.set_accelerator(accelerator),
        }
    }
}

#[cfg(target_os = "macos")]
fn shortcut_item(
    app: &AppHandle,
    items: &mut Vec<(&'static str, ShortcutItem)>,
    id: &'static str,
    label: &str,
) -> tauri::Result<MenuItem<Wry>> {
    let item = MenuItem::with_id(app, id, label, true, None::<&str>)?;
    items.push((id, ShortcutItem::Plain(item.clone())));
    Ok(item)
}

#[cfg(target_os = "macos")]
fn set_app_menu_title(title: &str) {
    use objc2::MainThreadMarker;
    use objc2_app_kit::NSApplication;
    use objc2_foundation::NSString;

    let Some(mtm) = MainThreadMarker::new() else {
        return;
    };
    let app = NSApplication::sharedApplication(mtm);
    let Some(menu) = app.mainMenu() else {
        return;
    };
    let title = NSString::from_str(title);
    if let Some(item) = menu.itemAtIndex(0) {
        item.setTitle(&title);
        if let Some(submenu) = item.submenu() {
            submenu.setTitle(&title);
        }
    }
}

#[cfg(target_os = "macos")]
pub fn init(app: &AppHandle) -> tauri::Result<()> {
    let version = app.package_info().version.to_string();
    let icon = Image::from_bytes(include_bytes!("../icons/128x128.png"))?;
    let about_metadata = AboutMetadata {
        name: Some(APP_DISPLAY_NAME.to_string()),
        version: Some(version.clone()),
        short_version: Some(version),
        copyright: Some(APP_COPYRIGHT.to_string()),
        credits: Some(APP_CREDITS.to_string()),
        icon: Some(icon),
        ..Default::default()
    };

    let mut shortcut_items = Vec::new();
    let save_item = MenuItem::with_id(app, "file.save", "Save", false, None::<&str>)?;
    shortcut_items.push(("file.save", ShortcutItem::Plain(save_item.clone())));
    let toggle_sidebar_item = CheckMenuItem::with_id(
        app,
        "view.toggleSidebar",
        "Toggle Sidebar",
        true,
        false,
        None::<&str>,
    )?;
    shortcut_items.push((
        "view.toggleSidebar",
        ShortcutItem::Check(toggle_sidebar_item.clone()),
    ));
    let toggle_terminal_item = CheckMenuItem::with_id(
        app,
        "view.toggleTerminal",
        "Toggle Terminal",
        true,
        false,
        None::<&str>,
    )?;
    shortcut_items.push((
        "view.toggleTerminal",
        ShortcutItem::Check(toggle_terminal_item.clone()),
    ));
    let toggle_ai_item = CheckMenuItem::with_id(
        app,
        "ai.toggle",
        "Toggle AI Chat",
        true,
        false,
        None::<&str>,
    )?;
    shortcut_items.push(("ai.toggle", ShortcutItem::Check(toggle_ai_item.clone())));

    let recent_menu = SubmenuBuilder::with_id(app, "file.openRecentMenu", "Open Recent")
        .item(&MenuItem::with_id(
            app,
            RECENT_EMPTY_ID,
            "No Recent Folders",
            false,
            None::<&str>,
        )?)
        .build()?;

    let pragma = SubmenuBuilder::new(app, APP_DISPLAY_NAME)
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
        .item(&shortcut_item(
            app,
            &mut shortcut_items,
            "view.openSettings",
            "Settings…",
        )?)
        .separator()
        .item(&PredefinedMenuItem::services(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::hide(app, Some("Hide Pragma"))?)
        .item(&PredefinedMenuItem::hide_others(app, Some("Hide Others"))?)
        .item(&PredefinedMenuItem::show_all(app, Some("Show All"))?)
        .separator()
        .item(&PredefinedMenuItem::quit(app, Some("Quit Pragma"))?)
        .build()?;

    let file = SubmenuBuilder::new(app, "File")
        .item(&shortcut_item(
            app,
            &mut shortcut_items,
            "file.open",
            "Open File",
        )?)
        .item(&shortcut_item(
            app,
            &mut shortcut_items,
            "file.openFolder",
            "Open Folder",
        )?)
        .item(&recent_menu)
        .separator()
        .item(&save_item)
        .separator()
        .item(&shortcut_item(
            app,
            &mut shortcut_items,
            "file.closeTab",
            "Close Tab",
        )?)
        .item(&shortcut_item(
            app,
            &mut shortcut_items,
            "file.reopenClosedTab",
            "Reopen Closed Tab",
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
        .item(&shortcut_item(
            app,
            &mut shortcut_items,
            "search.find",
            "Find",
        )?)
        .item(&shortcut_item(
            app,
            &mut shortcut_items,
            "search.replace",
            "Replace",
        )?)
        .item(&shortcut_item(
            app,
            &mut shortcut_items,
            "search.findInFiles",
            "Find in Files",
        )?)
        .separator()
        .item(&shortcut_item(
            app,
            &mut shortcut_items,
            "editor.formatDocument",
            "Format Document",
        )?)
        .item(&shortcut_item(
            app,
            &mut shortcut_items,
            "edit.editWithAI",
            "Edit Selection with AI",
        )?)
        .build()?;

    let view = SubmenuBuilder::new(app, "View")
        .item(&shortcut_item(
            app,
            &mut shortcut_items,
            "view.commandPalette",
            "Command Palette",
        )?)
        .separator()
        .item(&toggle_sidebar_item)
        .item(&toggle_terminal_item)
        .item(&toggle_ai_item)
        .item(&shortcut_item(
            app,
            &mut shortcut_items,
            "view.toggleProblems",
            "Toggle Problems",
        )?)
        .item(&shortcut_item(
            app,
            &mut shortcut_items,
            "view.togglePreview",
            "Toggle Preview",
        )?)
        .item(&shortcut_item(
            app,
            &mut shortcut_items,
            "view.splitEditor",
            "Split Editor",
        )?)
        .separator()
        .item(&shortcut_item(
            app,
            &mut shortcut_items,
            "view.switchToAgents",
            "Switch to Agents",
        )?)
        .item(&shortcut_item(
            app,
            &mut shortcut_items,
            "view.switchToEditor",
            "Switch to Editor",
        )?)
        .item(&shortcut_item(
            app,
            &mut shortcut_items,
            "view.toggleUiMode",
            "Toggle Agents / Editor",
        )?)
        .separator()
        .item(&PredefinedMenuItem::fullscreen(app, None)?)
        .build()?;

    let go = SubmenuBuilder::new(app, "Go")
        .item(&shortcut_item(
            app,
            &mut shortcut_items,
            "file.goToFile",
            "Go to File",
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
        .item(&shortcut_item(
            app,
            &mut shortcut_items,
            "debug.currentFile",
            "Start / Continue",
        )?)
        .item(&shortcut_item(
            app,
            &mut shortcut_items,
            "debug.stop",
            "Stop",
        )?)
        .item(&shortcut_item(
            app,
            &mut shortcut_items,
            "debug.attach",
            "Attach to Process…",
        )?)
        .separator()
        .item(&shortcut_item(
            app,
            &mut shortcut_items,
            "debug.stepOver",
            "Step Over",
        )?)
        .item(&shortcut_item(
            app,
            &mut shortcut_items,
            "debug.stepInto",
            "Step Into",
        )?)
        .item(&shortcut_item(
            app,
            &mut shortcut_items,
            "debug.stepOut",
            "Step Out",
        )?)
        .separator()
        .item(&shortcut_item(
            app,
            &mut shortcut_items,
            "debug.toggleBreakpoint",
            "Toggle Breakpoint",
        )?)
        .build()?;

    let terminal = SubmenuBuilder::new(app, "Terminal")
        .item(&shortcut_item(
            app,
            &mut shortcut_items,
            "view.newTerminalTab",
            "New Terminal Tab",
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
    set_app_menu_title(APP_DISPLAY_NAME);

    app.manage(AppMenuState {
        recent_menu,
        save_item,
        toggle_sidebar_item,
        toggle_terminal_item,
        toggle_ai_item,
        shortcut_items,
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

const MAX_ACCELERATOR_CHARS: usize = 64;
const MAX_SHORTCUTS: usize = 256;

fn validate_shortcuts(shortcuts: &HashMap<String, Option<String>>) -> Result<(), String> {
    if shortcuts.len() > MAX_SHORTCUTS {
        return Err("too many shortcuts".to_string());
    }
    if shortcuts
        .values()
        .flatten()
        .any(|accelerator| accelerator.chars().count() > MAX_ACCELERATOR_CHARS)
    {
        return Err("shortcut is too long".to_string());
    }
    Ok(())
}

/// Sets the key equivalents of the menu items to the shortcut settings, keyed by action id.
#[tauri::command]
#[cfg_attr(not(target_os = "macos"), allow(unused_variables))]
pub fn macos_menu_set_shortcuts(
    app: AppHandle,
    shortcuts: HashMap<String, Option<String>>,
) -> Result<(), String> {
    validate_shortcuts(&shortcuts)?;
    #[cfg(target_os = "macos")]
    {
        let state = menu_state(&app)?;
        for (id, item) in &state.shortcut_items {
            let accelerator = shortcuts.get(*id).and_then(Option::as_deref);
            // A binding the menu cannot show leaves the item without one; the webview still handles it.
            if item.set_accelerator(accelerator).is_err() {
                item.set_accelerator(None).map_err(|e| e.to_string())?;
            }
        }
        Ok(())
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
    use std::collections::HashMap;

    use super::{
        parse_recent_menu_id, resolve_menu_event, validate_shortcuts, MAX_SHORTCUTS,
        TOGGLE_TERMINAL_MENU_ID,
    };

    #[test]
    fn validates_shortcut_count_and_length() {
        let mut shortcuts = HashMap::from([
            ("file.open".to_string(), Some("Cmd+KeyO".to_string())),
            ("file.openFolder".to_string(), None),
        ]);
        assert!(validate_shortcuts(&shortcuts).is_ok());

        shortcuts.insert("file.save".to_string(), Some("Cmd+".repeat(20)));
        assert!(validate_shortcuts(&shortcuts).is_err());

        let many = (0..=MAX_SHORTCUTS)
            .map(|index| (index.to_string(), None))
            .collect::<HashMap<_, _>>();
        assert!(validate_shortcuts(&many).is_err());
    }

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
