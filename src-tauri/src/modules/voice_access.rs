//! macOS aborts a process through TCC when an unbundled binary (such as the
//! `tauri dev` build) asks for microphone or speech access, so voice input is
//! only offered when Pragma runs from its `.app` bundle.

#[tauri::command]
pub fn voice_input_available() -> Result<bool, String> {
    Ok(runs_from_app_bundle())
}

#[cfg(target_os = "macos")]
fn runs_from_app_bundle() -> bool {
    std::env::current_exe()
        .map(|path| is_bundle_executable(&path.to_string_lossy()))
        .unwrap_or(false)
}

#[cfg(not(target_os = "macos"))]
fn runs_from_app_bundle() -> bool {
    true
}

#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
fn is_bundle_executable(path: &str) -> bool {
    path.contains(".app/Contents/MacOS/")
}

#[cfg(test)]
mod tests {
    use super::is_bundle_executable;

    #[test]
    fn detects_bundled_and_dev_binaries() {
        assert!(is_bundle_executable(
            "/Applications/Pragma.app/Contents/MacOS/pragma"
        ));
        assert!(!is_bundle_executable(
            "/Users/dev/pragma/src-tauri/target/debug/app"
        ));
    }
}
