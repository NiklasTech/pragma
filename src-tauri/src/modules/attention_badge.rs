use std::collections::HashMap;
use std::sync::Mutex;

use tauri::{AppHandle, Manager, Runtime, State, Window};

const MAX_COUNT: u32 = 9_999;

/// Sessions waiting for approval per window; the dock badge shows their sum
/// because every workspace window runs its own sessions.
#[derive(Default)]
pub struct AttentionBadges(Mutex<HashMap<String, u32>>);

impl AttentionBadges {
    fn set(&self, label: &str, count: u32) -> Result<u32, String> {
        let mut counts = self
            .0
            .lock()
            .map_err(|_| "Attention badge state is poisoned".to_string())?;
        if count == 0 {
            counts.remove(label);
        } else {
            counts.insert(label.to_string(), count);
        }
        Ok(counts.values().sum())
    }

    /// Drops the count of a closed window and refreshes the badge from the rest.
    pub fn remove_window<R: Runtime>(&self, app: &AppHandle<R>, label: &str) {
        let total = match self.set(label, 0) {
            Ok(total) => total,
            Err(e) => {
                log::warn!("{e}");
                return;
            }
        };
        let Some(window) = app
            .webview_windows()
            .into_values()
            .find(|window| window.label() != label)
        else {
            return;
        };
        if let Err(e) = window.set_badge_count(badge_value(total)) {
            log::warn!("failed to update the attention badge: {e}");
        }
    }
}

fn badge_value(total: u32) -> Option<i64> {
    (total > 0).then_some(i64::from(total))
}

#[tauri::command]
pub fn set_attention_badge<R: Runtime>(
    window: Window<R>,
    badges: State<'_, AttentionBadges>,
    count: u32,
) -> Result<(), String> {
    if count > MAX_COUNT {
        return Err(format!("Badge count must be at most {MAX_COUNT}"));
    }
    let total = badges.set(window.label(), count)?;
    window
        .set_badge_count(badge_value(total))
        .map_err(|e| format!("Failed to set the badge count: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sums_counts_across_windows() {
        let badges = AttentionBadges::default();
        assert_eq!(badges.set("main", 2), Ok(2));
        assert_eq!(badges.set("workspace-1", 3), Ok(5));
        assert_eq!(badges.set("main", 1), Ok(4));
    }

    #[test]
    fn zero_clears_a_window() {
        let badges = AttentionBadges::default();
        badges.set("main", 2).unwrap();
        badges.set("workspace-1", 1).unwrap();
        assert_eq!(badges.set("main", 0), Ok(1));
        assert_eq!(badges.set("workspace-1", 0), Ok(0));
    }

    #[test]
    fn hides_the_badge_at_zero() {
        assert_eq!(badge_value(0), None);
        assert_eq!(badge_value(3), Some(3));
    }
}
