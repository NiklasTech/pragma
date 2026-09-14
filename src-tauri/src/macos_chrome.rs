use tauri::{WebviewWindow, Window, WindowEvent};

pub const HEADER_HEIGHT: f64 = 40.0;
pub const TRAFFIC_LIGHT_X: f64 = 16.0;
pub const TRAFFIC_LIGHT_Y: f64 = HEADER_HEIGHT - 16.0;

pub fn align_webview(window: &WebviewWindow) {
    if let Ok(ptr) = window.ns_window() {
        unsafe { align_ptr(ptr) }
    }
}

pub fn on_window_event(window: &Window, event: &WindowEvent) {
    match event {
        WindowEvent::Resized(_)
        | WindowEvent::ScaleFactorChanged { .. }
        | WindowEvent::ThemeChanged(_)
        | WindowEvent::Focused(true) => {
            if let Ok(ptr) = window.ns_window() {
                unsafe { align_ptr(ptr) }
            }
        }
        _ => {}
    }
}

unsafe fn align_ptr(ns_window: *mut std::ffi::c_void) {
    if ns_window.is_null() {
        return;
    }

    use objc2_app_kit::{NSButton, NSView, NSWindow, NSWindowButton};

    let window = &*ns_window.cast::<NSWindow>();
    let Some(close) = window.standardWindowButton(NSWindowButton::CloseButton) else {
        return;
    };
    let Some(miniaturize) = window.standardWindowButton(NSWindowButton::MiniaturizeButton) else {
        return;
    };
    let zoom = window.standardWindowButton(NSWindowButton::ZoomButton);

    let Some(button_bar) = close.superview() else {
        return;
    };
    let Some(title_bar) = button_bar.superview() else {
        return;
    };

    let close_rect = NSView::frame(&close);
    let mut title_bar_rect = title_bar.frame();
    title_bar_rect.size.height = HEADER_HEIGHT;
    title_bar_rect.origin.y = window.frame().size.height - HEADER_HEIGHT;
    title_bar.setFrame(title_bar_rect);

    let y = ((HEADER_HEIGHT - close_rect.size.height) / 2.0).round();
    let space = NSView::frame(&miniaturize).origin.x - close_rect.origin.x;

    let mut buttons: Vec<&NSButton> = vec![&close, &miniaturize];
    if let Some(ref zoom) = zoom {
        buttons.push(zoom);
    }
    for (i, button) in buttons.into_iter().enumerate() {
        let mut rect = NSView::frame(button);
        rect.origin.x = TRAFFIC_LIGHT_X + i as f64 * space;
        rect.origin.y = y;
        button.setFrameOrigin(rect.origin);
    }
}
