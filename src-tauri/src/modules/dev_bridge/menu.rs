use tauri::menu::MenuItemKind;
use tauri::{AppHandle, Wry};

use super::protocol::BridgeReply;

/// Lists the native menu items, or triggers the one with `id` like a click would.
pub fn run(app: &AppHandle, id: Option<&str>) -> Result<BridgeReply, String> {
    let menu = app
        .menu()
        .ok_or("Pragma Dev has no native menu on this platform")?;
    let mut items = Vec::new();
    collect(&menu.items().map_err(|e| e.to_string())?, "", &mut items);
    let Some(id) = id else {
        let lines: Vec<String> = items
            .iter()
            .map(|item| {
                let state = if item.enabled { "" } else { " (disabled)" };
                format!("- {} : {}{state}", item.id, item.path)
            })
            .collect();
        return Ok(BridgeReply::text(lines.join("\n")));
    };
    let item = items
        .iter()
        .find(|item| item.id == id)
        .ok_or_else(|| format!("No menu item {id:?}; call without an id to list them"))?;
    if !item.enabled {
        return Err(format!("The menu item {:?} is disabled", item.path));
    }
    crate::app_menu::handle_menu_event(app, id);
    Ok(BridgeReply::text(format!("Triggered {}", item.path)))
}

struct Item {
    id: String,
    path: String,
    enabled: bool,
}

/// Normal and check items with their menu path; system items (Copy, Quit, ...) are left out.
fn collect(kinds: &[MenuItemKind<Wry>], prefix: &str, out: &mut Vec<Item>) {
    for kind in kinds {
        match kind {
            MenuItemKind::Submenu(submenu) => {
                let text = submenu.text().unwrap_or_default();
                if let Ok(children) = submenu.items() {
                    collect(&children, &format!("{prefix}{text} > "), out);
                }
            }
            MenuItemKind::MenuItem(item) => out.push(Item {
                id: item.id().0.clone(),
                path: format!("{prefix}{}", item.text().unwrap_or_default()),
                enabled: item.is_enabled().unwrap_or(false),
            }),
            MenuItemKind::Check(item) => out.push(Item {
                id: item.id().0.clone(),
                path: format!("{prefix}{}", item.text().unwrap_or_default()),
                enabled: item.is_enabled().unwrap_or(false),
            }),
            _ => {}
        }
    }
}
