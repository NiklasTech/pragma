//! Whether Pragma may use the microphone, asking for it, and opening the system setting
//! that controls it, so dictation can say why it does not hear anything.

use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum MicrophonePermission {
    Granted,
    Denied,
    NotDetermined,
    /// A device policy blocks the microphone; the user cannot allow it.
    Restricted,
    /// macOS cannot ask outside the app bundle, so development builds have no microphone.
    Unavailable,
    /// The system does not report a state Pragma can read.
    Unknown,
}

#[tauri::command]
pub async fn microphone_permission() -> Result<MicrophonePermission, String> {
    platform::permission(false).await
}

/// Asks for the microphone when the user was never asked and reports the resulting state.
#[tauri::command]
pub async fn request_microphone_permission() -> Result<MicrophonePermission, String> {
    platform::permission(true).await
}

#[tauri::command]
pub fn open_microphone_settings() -> Result<(), String> {
    platform::open_settings()
}

/// The `Value` of a `reg query` answer for a Windows privacy consent key.
#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
fn consent_value(output: &str) -> Option<bool> {
    output.lines().find_map(|line| {
        let mut parts = line.split_whitespace();
        if parts.next()? != "Value" || parts.next()? != "REG_SZ" {
            return None;
        }
        match parts.next()? {
            "Allow" => Some(true),
            "Deny" => Some(false),
            _ => None,
        }
    })
}

/// The answer to `authorizationStatusForMediaType:` (`AVAuthorizationStatus`).
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
fn from_av_status(status: isize) -> MicrophonePermission {
    match status {
        0 => MicrophonePermission::NotDetermined,
        1 => MicrophonePermission::Restricted,
        2 => MicrophonePermission::Denied,
        3 => MicrophonePermission::Granted,
        _ => MicrophonePermission::Unknown,
    }
}

#[cfg(target_os = "macos")]
mod platform {
    use std::sync::mpsc;
    use std::time::Duration;

    use block2::RcBlock;
    use objc2::msg_send;
    use objc2::runtime::{AnyClass, Bool};
    use objc2_foundation::NSString;

    use super::{from_av_status, MicrophonePermission};

    #[link(name = "AVFoundation", kind = "framework")]
    extern "C" {}

    const TIMEOUT: Duration = Duration::from_secs(120);
    // AVMediaTypeAudio.
    const MEDIA_TYPE_AUDIO: &str = "soun";
    const SETTINGS_URL: &str =
        "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone";

    fn capture_device() -> Result<&'static AnyClass, String> {
        AnyClass::get(c"AVCaptureDevice").ok_or_else(|| "AVFoundation is not available".to_string())
    }

    fn status() -> Result<MicrophonePermission, String> {
        let class = capture_device()?;
        let media = NSString::from_str(MEDIA_TYPE_AUDIO);
        // SAFETY: authorizationStatusForMediaType: takes an NSString and returns an NSInteger.
        let status: isize = unsafe { msg_send![class, authorizationStatusForMediaType: &*media] };
        Ok(from_av_status(status))
    }

    /// Starts the request; the block and the string are gone before anything awaits.
    fn start_request() -> Result<mpsc::Receiver<()>, String> {
        let class = capture_device()?;
        let media = NSString::from_str(MEDIA_TYPE_AUDIO);
        let (tx, rx) = mpsc::channel();
        let handler = RcBlock::new(move |_granted: Bool| {
            let _ = tx.send(());
        });
        // SAFETY: requestAccessForMediaType:completionHandler: takes an NSString and a block
        // that receives a BOOL; macOS copies the block and keeps it until it calls it.
        let () = unsafe {
            msg_send![class, requestAccessForMediaType: &*media, completionHandler: &*handler]
        };
        Ok(rx)
    }

    async fn request() -> Result<(), String> {
        let rx = start_request()?;
        tauri::async_runtime::spawn_blocking(move || rx.recv_timeout(TIMEOUT))
            .await
            .map_err(|e| format!("The microphone permission task failed: {e}"))?
            .map_err(|_| "macOS did not answer the microphone request in time".to_string())
    }

    pub async fn permission(ask: bool) -> Result<MicrophonePermission, String> {
        // An unbundled binary is aborted by macOS as soon as it asks for the microphone.
        if !crate::modules::voice_access::voice_input_available()? {
            return Ok(MicrophonePermission::Unavailable);
        }
        let current = status()?;
        if !ask || current != MicrophonePermission::NotDetermined {
            return Ok(current);
        }
        request().await?;
        status()
    }

    pub fn open_settings() -> Result<(), String> {
        std::process::Command::new("open")
            .arg(SETTINGS_URL)
            .status()
            .map_err(|e| format!("Failed to open System Settings: {e}"))?;
        Ok(())
    }
}

#[cfg(target_os = "windows")]
mod platform {
    use std::os::windows::process::CommandExt;
    use std::process::Command;

    use super::{consent_value, MicrophonePermission};

    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    const CONSENT: &str = r"HKCU\Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\microphone";

    fn consent(key: &str) -> Option<bool> {
        let output = Command::new("reg")
            .args(["query", key, "/v", "Value"])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .ok()?;
        consent_value(&String::from_utf8_lossy(&output.stdout))
    }

    /// Windows has no prompt for desktop apps: the microphone switch and the switch for desktop
    /// apps decide, and both default to on.
    pub async fn permission(_ask: bool) -> Result<MicrophonePermission, String> {
        tauri::async_runtime::spawn_blocking(|| {
            let desktop_apps = format!(r"{CONSENT}\NonPackaged");
            match (consent(CONSENT), consent(&desktop_apps)) {
                (Some(false), _) | (_, Some(false)) => MicrophonePermission::Denied,
                (Some(true), _) | (_, Some(true)) => MicrophonePermission::Granted,
                (None, None) => MicrophonePermission::Unknown,
            }
        })
        .await
        .map_err(|e| format!("The microphone permission task failed: {e}"))
    }

    pub fn open_settings() -> Result<(), String> {
        Command::new("explorer")
            .arg("ms-settings:privacy-microphone")
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| format!("Failed to open Settings: {e}"))?;
        Ok(())
    }
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
mod platform {
    use super::MicrophonePermission;

    pub async fn permission(_ask: bool) -> Result<MicrophonePermission, String> {
        Ok(MicrophonePermission::Unknown)
    }

    pub fn open_settings() -> Result<(), String> {
        Err("This system has no microphone setting Pragma can open".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_states_in_kebab_case() {
        let json = serde_json::to_string(&MicrophonePermission::NotDetermined).unwrap();
        assert_eq!(json, "\"not-determined\"");
    }

    #[test]
    fn maps_every_av_authorization_status() {
        assert_eq!(from_av_status(0), MicrophonePermission::NotDetermined);
        assert_eq!(from_av_status(1), MicrophonePermission::Restricted);
        assert_eq!(from_av_status(2), MicrophonePermission::Denied);
        assert_eq!(from_av_status(3), MicrophonePermission::Granted);
        assert_eq!(from_av_status(9), MicrophonePermission::Unknown);
    }

    #[test]
    fn reads_windows_consent_values() {
        let allow = "\r\nHKEY_CURRENT_USER\\...\\microphone\r\n    Value    REG_SZ    Allow\r\n";
        let deny = "    Value    REG_SZ    Deny";
        assert_eq!(consent_value(allow), Some(true));
        assert_eq!(consent_value(deny), Some(false));
        assert_eq!(consent_value("ERROR: The system was unable to find"), None);
        assert_eq!(consent_value("    Value    REG_SZ    Prompt"), None);
    }
}
