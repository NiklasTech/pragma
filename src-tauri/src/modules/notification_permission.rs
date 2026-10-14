use serde::Serialize;
use tauri::{AppHandle, Runtime};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum NotificationPermission {
    Granted,
    Denied,
    NotDetermined,
    /// Development builds send notifications as Terminal, so Terminal's permission applies.
    Terminal,
    /// Outside its app bundle macOS cannot attribute notifications to Pragma.
    Unavailable,
}

#[tauri::command]
pub async fn notification_permission() -> Result<NotificationPermission, String> {
    platform::permission(false).await
}

/// Asks for the permission when the user was never asked and reports the resulting state.
#[tauri::command]
pub async fn request_notification_permission() -> Result<NotificationPermission, String> {
    platform::permission(true).await
}

#[tauri::command]
pub fn open_notification_settings<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    platform::open_settings(&app)
}

#[cfg(target_os = "macos")]
mod platform {
    use std::ptr::NonNull;
    use std::sync::mpsc::{self, Receiver};
    use std::time::Duration;

    use block2::RcBlock;
    use objc2::runtime::Bool;
    use objc2_foundation::{NSBundle, NSError};
    use objc2_user_notifications::{
        UNAuthorizationOptions, UNAuthorizationStatus, UNNotificationSettings,
        UNUserNotificationCenter,
    };
    use tauri::{AppHandle, Runtime};

    use super::NotificationPermission;

    const TIMEOUT: Duration = Duration::from_secs(60);
    const TERMINAL_BUNDLE_ID: &str = "com.apple.Terminal";

    // UNUserNotificationCenter raises an Objective-C exception outside an app bundle.
    fn unavailable_state() -> Option<NotificationPermission> {
        if tauri::is_dev() {
            return Some(NotificationPermission::Terminal);
        }
        let bundled = NSBundle::mainBundle()
            .bundlePath()
            .to_string()
            .ends_with(".app");
        (!bundled).then_some(NotificationPermission::Unavailable)
    }

    fn map_status(status: UNAuthorizationStatus) -> NotificationPermission {
        match status {
            UNAuthorizationStatus::Denied => NotificationPermission::Denied,
            UNAuthorizationStatus::NotDetermined => NotificationPermission::NotDetermined,
            _ => NotificationPermission::Granted,
        }
    }

    async fn receive<T: Send + 'static>(rx: Receiver<T>) -> Result<T, String> {
        tauri::async_runtime::spawn_blocking(move || rx.recv_timeout(TIMEOUT))
            .await
            .map_err(|e| format!("The notification permission task failed: {e}"))?
            .map_err(|_| "macOS did not answer the notification permission in time".to_string())
    }

    fn start_status_query() -> Receiver<UNAuthorizationStatus> {
        let (tx, rx) = mpsc::channel();
        let handler = RcBlock::new(move |settings: NonNull<UNNotificationSettings>| {
            // SAFETY: macOS passes a valid settings object to the completion handler.
            let _ = tx.send(unsafe { settings.as_ref() }.authorizationStatus());
        });
        UNUserNotificationCenter::currentNotificationCenter()
            .getNotificationSettingsWithCompletionHandler(&handler);
        rx
    }

    fn start_authorization_request() -> Receiver<()> {
        let (tx, rx) = mpsc::channel();
        let handler = RcBlock::new(move |_granted: Bool, _error: *mut NSError| {
            let _ = tx.send(());
        });
        UNUserNotificationCenter::currentNotificationCenter()
            .requestAuthorizationWithOptions_completionHandler(
                UNAuthorizationOptions::Alert | UNAuthorizationOptions::Sound,
                &handler,
            );
        rx
    }

    pub async fn permission(request: bool) -> Result<NotificationPermission, String> {
        if let Some(state) = unavailable_state() {
            return Ok(state);
        }
        let status = receive(start_status_query()).await?;
        if !request || status != UNAuthorizationStatus::NotDetermined {
            return Ok(map_status(status));
        }
        receive(start_authorization_request()).await?;
        Ok(map_status(receive(start_status_query()).await?))
    }

    pub fn open_settings<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
        let bundle_id = if tauri::is_dev() {
            TERMINAL_BUNDLE_ID.to_string()
        } else {
            app.config().identifier.clone()
        };
        let url = format!(
            "x-apple.systempreferences:com.apple.Notifications-Settings.extension?id={bundle_id}"
        );
        std::process::Command::new("open")
            .arg(url)
            .status()
            .map_err(|e| format!("Failed to open System Settings: {e}"))?;
        Ok(())
    }
}

#[cfg(not(target_os = "macos"))]
mod platform {
    use tauri::{AppHandle, Runtime};

    use super::NotificationPermission;

    pub async fn permission(_request: bool) -> Result<NotificationPermission, String> {
        Ok(NotificationPermission::Granted)
    }

    pub fn open_settings<R: Runtime>(_app: &AppHandle<R>) -> Result<(), String> {
        Err("Notification settings can only be opened on macOS".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_states_in_kebab_case() {
        let json = serde_json::to_string(&NotificationPermission::NotDetermined).unwrap();
        assert_eq!(json, "\"not-determined\"");
    }
}
