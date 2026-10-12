/// Bundle identifier of the installed release build (`tauri.conf.json`).
const RELEASE_IDENTIFIER: &str = "dev.pragma.ide";

/// Rejects a debug build that runs under the release identifier. The single-instance
/// plugin would hand it to an installed Pragma and exit, and it would share that app's data.
pub fn check(identifier: &str, debug_build: bool) -> Result<(), String> {
    if debug_build && identifier == RELEASE_IDENTIFIER {
        return Err(format!(
            "This debug build uses the release identifier `{RELEASE_IDENTIFIER}`, so it would \
             hand off to an installed Pragma and share its data.\n\
             Start the dev app with `pnpm run dev:desktop` (it passes \
             `--config src-tauri/tauri.dev.conf.json`)."
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_release_identifier_in_debug_build() {
        let err = check(RELEASE_IDENTIFIER, true).unwrap_err();
        assert!(err.contains("pnpm run dev:desktop"));
    }

    #[test]
    fn accepts_dev_identifier_in_debug_build() {
        assert!(check("dev.pragma.ide.dev", true).is_ok());
    }

    #[test]
    fn accepts_release_identifier_in_release_build() {
        assert!(check(RELEASE_IDENTIFIER, false).is_ok());
    }
}
