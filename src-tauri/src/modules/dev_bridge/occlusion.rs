use tauri::{Webview, Wry};

/// Keeps a webview rendering while its window is covered, e.g. by the installed Pragma.
/// Otherwise WebKit reports the page as hidden, pauses animation frames and throttles timers,
/// so focus, transitions and screenshots stall while an agent drives the app.
pub fn keep_rendering_when_covered(webview: &Webview<Wry>) {
    #[cfg(target_os = "macos")]
    if let Err(e) = webview.with_webview(|platform| {
        use objc2::runtime::AnyObject;
        use objc2::{msg_send, sel};

        let webview = platform.inner().cast::<AnyObject>();
        // SAFETY: the pointer is the live WKWebView of this webview and we are on the main thread;
        // the private setter is only called when WebKit has it.
        unsafe {
            let Some(webview) = webview.as_ref() else {
                return;
            };
            let setter = sel!(_setWindowOcclusionDetectionEnabled:);
            let available: bool = msg_send![webview, respondsToSelector: setter];
            if available {
                let _: () = msg_send![webview, _setWindowOcclusionDetectionEnabled: false];
            }
        }
    }) {
        log::warn!("dev bridge could not disable occlusion detection: {e}");
    }
    #[cfg(not(target_os = "macos"))]
    let _ = webview;
}
