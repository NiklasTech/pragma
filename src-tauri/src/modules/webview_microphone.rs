//! Lets Pragma's own pages use the microphone without WebView2's site prompt on Windows.
//! The Windows privacy switches still decide; pages in a browser pane keep the prompt.

use tauri::plugin::{Builder, TauriPlugin};
use tauri::{Runtime, Url};

/// Whether `uri` belongs to one of Pragma's own origins.
#[cfg_attr(not(windows), allow(dead_code))]
fn is_app_page(uri: &str, origins: &[String]) -> bool {
    let Ok(url) = Url::parse(uri) else {
        return false;
    };
    let origin = url.origin().ascii_serialization();
    origins.contains(&origin)
}

pub fn init<R: Runtime>(dev_url: Option<&Url>) -> TauriPlugin<R> {
    let origins = super::browser_pane::app_origins(dev_url);
    Builder::new("webview-microphone")
        .on_webview_ready(move |webview| allow_app_microphone(&webview, origins.clone()))
        .build()
}

#[cfg(windows)]
fn allow_app_microphone<R: Runtime>(webview: &tauri::Webview<R>, origins: Vec<String>) {
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        COREWEBVIEW2_PERMISSION_KIND, COREWEBVIEW2_PERMISSION_KIND_MICROPHONE,
        COREWEBVIEW2_PERMISSION_STATE_ALLOW,
    };
    use webview2_com::{take_pwstr, PermissionRequestedEventHandler};
    use windows::core::PWSTR;

    let result = webview.with_webview(move |platform| {
        // SAFETY: the controller belongs to this webview and we are on its UI thread.
        let Ok(core) = (unsafe { platform.controller().CoreWebView2() }) else {
            return;
        };
        let handler = PermissionRequestedEventHandler::create(Box::new(move |_, args| {
            let Some(args) = args else {
                return Ok(());
            };
            let mut kind = COREWEBVIEW2_PERMISSION_KIND::default();
            let mut uri = PWSTR::null();
            // SAFETY: WebView2 owns the arguments for this call; take_pwstr frees the string.
            unsafe {
                args.PermissionKind(&mut kind)?;
                args.Uri(&mut uri)?;
            }
            let uri = take_pwstr(uri);
            if kind == COREWEBVIEW2_PERMISSION_KIND_MICROPHONE && is_app_page(&uri, &origins) {
                // SAFETY: setting the state is valid while the event is being handled.
                unsafe { args.SetState(COREWEBVIEW2_PERMISSION_STATE_ALLOW)? };
            }
            Ok(())
        }));
        let mut token = 0i64;
        // SAFETY: WebView2 keeps the handler alive for the lifetime of the webview.
        if let Err(e) = unsafe { core.add_PermissionRequested(&handler, &mut token) } {
            log::warn!("could not handle microphone requests: {e}");
        }
    });
    if let Err(e) = result {
        log::warn!("could not reach the webview for microphone requests: {e}");
    }
}

#[cfg(not(windows))]
fn allow_app_microphone<R: Runtime>(_webview: &tauri::Webview<R>, _origins: Vec<String>) {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_app_origins_count_as_app_pages() {
        let origins = vec![
            "http://tauri.localhost".to_string(),
            "http://localhost:5173".to_string(),
        ];
        assert!(is_app_page("http://tauri.localhost/index.html", &origins));
        assert!(is_app_page("http://localhost:5173/", &origins));
        assert!(!is_app_page("http://localhost:3000/", &origins));
        assert!(!is_app_page("https://example.com/", &origins));
        assert!(!is_app_page("not a url", &origins));
    }
}
