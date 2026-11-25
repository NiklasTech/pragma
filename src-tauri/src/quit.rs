//! Asks before Pragma quits while agents work.

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

use tauri::{AppHandle, Manager, Runtime, State, Window};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};

#[cfg(target_os = "macos")]
pub const QUIT_MENU_ID: &str = "app.quit";

const MAX_COUNT: u32 = 9_999;

static ASKING: AtomicBool = AtomicBool::new(false);

/// Agents working per window; every workspace window runs its own sessions.
#[derive(Default)]
pub struct WorkingAgents(Mutex<HashMap<String, u32>>);

impl WorkingAgents {
    fn set(&self, label: &str, count: u32) -> Result<(), String> {
        let mut counts = self
            .0
            .lock()
            .map_err(|_| "Working agents state is poisoned".to_string())?;
        if count == 0 {
            counts.remove(label);
        } else {
            counts.insert(label.to_string(), count);
        }
        Ok(())
    }

    /// Drops the count of a closed window.
    pub fn remove_window(&self, label: &str) {
        if let Err(e) = self.set(label, 0) {
            log::warn!("{e}");
        }
    }

    fn total(&self) -> u32 {
        // A poisoned count must not keep the app from quitting.
        self.0.lock().map_or(0, |counts| counts.values().sum())
    }
}

#[tauri::command]
pub fn set_working_agents<R: Runtime>(
    window: Window<R>,
    working: State<'_, WorkingAgents>,
    count: u32,
) -> Result<(), String> {
    if count > MAX_COUNT {
        return Err(format!("Agent count must be at most {MAX_COUNT}"));
    }
    working.set(window.label(), count)
}

fn question(count: u32) -> String {
    if count == 1 {
        "An agent is still working. Quitting stops it.".to_string()
    } else {
        format!("{count} agents are still working. Quitting stops them.")
    }
}

fn working_count<R: Runtime>(app: &AppHandle<R>) -> u32 {
    app.try_state::<WorkingAgents>()
        .map_or(0, |working| working.total())
}

/// The window the question belongs to; without one, macOS shows it only while the app is active.
fn question_window<R: Runtime>(app: &AppHandle<R>) -> Option<Window<R>> {
    let mut windows: Vec<Window<R>> = app.windows().into_values().collect();
    windows.sort_by_key(|window| {
        (
            !window.is_focused().unwrap_or(false),
            window.label() != "main",
        )
    });
    windows.into_iter().next()
}

fn ask<R: Runtime>(app: &AppHandle<R>, count: u32) {
    // Asked a second time while the question is open: that is an answer too.
    if ASKING.swap(true, Ordering::SeqCst) {
        app.exit(0);
        return;
    }
    let mut dialog = app
        .dialog()
        .message(question(count))
        .title("Quit Pragma?")
        .kind(MessageDialogKind::Warning)
        .buttons(MessageDialogButtons::OkCancelCustom(
            "Quit".to_string(),
            "Cancel".to_string(),
        ));
    if let Some(window) = question_window(app) {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        dialog = dialog.parent(&window);
    }
    let exiting = app.clone();
    dialog.show(move |confirmed| {
        ASKING.store(false, Ordering::SeqCst);
        if confirmed {
            exiting.exit(0);
        }
    });
}

/// Quits, or asks first while agents work.
#[cfg(target_os = "macos")]
pub fn request<R: Runtime>(app: &AppHandle<R>) {
    match working_count(app) {
        0 => app.exit(0),
        count => ask(app, count),
    }
}

/// Whether closing this window has to wait for an answer, because it quits while agents work.
pub fn holds_close<R: Runtime>(window: &Window<R>) -> bool {
    let app = window.app_handle();
    if app.windows().len() > 1 {
        return false;
    }
    let count = working_count(app);
    if count == 0 {
        return false;
    }
    ask(app, count);
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sums_agents_across_windows() {
        let working = WorkingAgents::default();
        working.set("main", 2).unwrap();
        working.set("workspace-1", 1).unwrap();
        assert_eq!(working.total(), 3);
        working.remove_window("main");
        assert_eq!(working.total(), 1);
    }

    #[test]
    fn asks_with_the_number_of_agents() {
        assert_eq!(question(1), "An agent is still working. Quitting stops it.");
        assert_eq!(
            question(3),
            "3 agents are still working. Quitting stops them."
        );
    }
}
