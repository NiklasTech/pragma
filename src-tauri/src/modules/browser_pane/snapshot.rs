use std::sync::mpsc::{self, Sender};
use std::time::Duration;

use tauri::ipc::Response;
use tauri::webview::PlatformWebview;
use tauri::Webview;

const SNAPSHOT_TIMEOUT: Duration = Duration::from_secs(10);

type SnapshotResult = Result<Vec<u8>, String>;

/// Captures the visible content of the calling webview as a PNG, cross-origin frames included.
#[tauri::command]
pub async fn browser_pane_snapshot(webview: Webview) -> Result<Response, String> {
    let (tx, rx) = mpsc::channel::<SnapshotResult>();
    webview
        .with_webview(move |platform| capture(platform, tx))
        .map_err(|e| format!("Failed to access the webview: {e}"))?;
    let png = tauri::async_runtime::spawn_blocking(move || rx.recv_timeout(SNAPSHOT_TIMEOUT))
        .await
        .map_err(|e| format!("The snapshot task failed: {e}"))?
        .map_err(|_| "The webview did not return a snapshot in time".to_string())??;
    Ok(Response::new(png))
}

#[cfg(target_os = "macos")]
fn capture(platform: PlatformWebview, tx: Sender<SnapshotResult>) {
    use block2::RcBlock;
    use objc2_app_kit::NSImage;
    use objc2_foundation::NSError;
    use objc2_web_kit::WKWebView;

    let webview = platform.inner().cast::<WKWebView>();
    if webview.is_null() {
        let _ = tx.send(Err("The webview is not available".to_string()));
        return;
    }
    let handler = RcBlock::new(move |image: *mut NSImage, error: *mut NSError| {
        // SAFETY: WebKit passes either a valid image or a valid error for the call.
        let result = match unsafe { image.as_ref() } {
            Some(image) => macos_png(image),
            None => Err(unsafe { error.as_ref() }
                .map(|error| error.localizedDescription().to_string())
                .unwrap_or_else(|| "The webview returned no snapshot".to_string())),
        };
        let _ = tx.send(result);
    });
    // SAFETY: the pointer is the live WKWebView of this webview and we are on the main thread.
    unsafe { (*webview).takeSnapshotWithConfiguration_completionHandler(None, &handler) };
}

#[cfg(target_os = "macos")]
fn macos_png(image: &objc2_app_kit::NSImage) -> SnapshotResult {
    use objc2_app_kit::{NSBitmapImageFileType, NSBitmapImageRep};
    use objc2_foundation::NSDictionary;

    let tiff = image
        .TIFFRepresentation()
        .ok_or("The snapshot has no bitmap data")?;
    let bitmap = NSBitmapImageRep::imageRepWithData(&tiff).ok_or("The snapshot is not a bitmap")?;
    // SAFETY: an empty property dictionary is valid for every file type.
    let png = unsafe {
        bitmap.representationUsingType_properties(NSBitmapImageFileType::PNG, &NSDictionary::new())
    }
    .ok_or("The snapshot could not be encoded as PNG")?;
    Ok(png.to_vec())
}

#[cfg(windows)]
fn capture(platform: PlatformWebview, tx: Sender<SnapshotResult>) {
    use webview2_com::CapturePreviewCompletedHandler;
    use webview2_com::Microsoft::Web::WebView2::Win32::COREWEBVIEW2_CAPTURE_PREVIEW_IMAGE_FORMAT_PNG;
    use windows::Win32::Foundation::HGLOBAL;
    use windows::Win32::System::Com::StructuredStorage::CreateStreamOnHGlobal;

    let started = (|| -> Result<(), String> {
        // SAFETY: the controller belongs to this webview and we are on its UI thread.
        let webview = unsafe { platform.controller().CoreWebView2() }
            .map_err(|e| format!("The webview is not available: {e}"))?;
        // SAFETY: a null HGLOBAL asks COM to allocate the stream memory itself.
        let stream = unsafe { CreateStreamOnHGlobal(HGLOBAL::default(), true) }
            .map_err(|e| format!("Failed to create the snapshot stream: {e}"))?;
        let reader = stream.clone();
        let done = tx.clone();
        let handler = CapturePreviewCompletedHandler::create(Box::new(move |result| {
            let _ = done.send(
                result
                    .map_err(|e| format!("The snapshot failed: {e}"))
                    .and_then(|()| read_stream(&reader)),
            );
            Ok(())
        }));
        // SAFETY: the stream and handler stay alive until WebView2 calls the handler.
        unsafe {
            webview.CapturePreview(
                COREWEBVIEW2_CAPTURE_PREVIEW_IMAGE_FORMAT_PNG,
                &stream,
                &handler,
            )
        }
        .map_err(|e| format!("The snapshot failed: {e}"))
    })();
    if let Err(error) = started {
        let _ = tx.send(Err(error));
    }
}

#[cfg(windows)]
fn read_stream(stream: &windows::Win32::System::Com::IStream) -> SnapshotResult {
    use windows::Win32::System::Com::STREAM_SEEK_SET;

    // SAFETY: the stream is a valid in-memory COM stream and every buffer outlives its call.
    unsafe {
        stream
            .Seek(0, STREAM_SEEK_SET, None)
            .map_err(|e| format!("Failed to read the snapshot: {e}"))?;
        let mut bytes = Vec::new();
        let mut chunk = vec![0u8; 64 * 1024];
        loop {
            let mut read = 0u32;
            stream
                .Read(
                    chunk.as_mut_ptr().cast(),
                    chunk.len() as u32,
                    Some(&mut read),
                )
                .ok()
                .map_err(|e| format!("Failed to read the snapshot: {e}"))?;
            if read == 0 {
                return Ok(bytes);
            }
            bytes.extend_from_slice(&chunk[..read as usize]);
        }
    }
}

#[cfg(target_os = "linux")]
fn capture(platform: PlatformWebview, tx: Sender<SnapshotResult>) {
    use webkit2gtk::{gio::Cancellable, SnapshotOptions, SnapshotRegion, WebViewExt};

    platform.inner().snapshot(
        SnapshotRegion::Visible,
        SnapshotOptions::NONE,
        None::<&Cancellable>,
        move |result| {
            let _ = tx.send(
                result
                    .map_err(|e| format!("The snapshot failed: {e}"))
                    .and_then(linux_png),
            );
        },
    );
}

#[cfg(target_os = "linux")]
fn linux_png(surface: cairo::Surface) -> SnapshotResult {
    let image = cairo::ImageSurface::try_from(surface)
        .map_err(|_| "The snapshot is not an image surface".to_string())?;
    let mut png = Vec::new();
    image
        .write_to_png(&mut png)
        .map_err(|e| format!("The snapshot could not be encoded as PNG: {e}"))?;
    Ok(png)
}

#[cfg(not(any(target_os = "macos", windows, target_os = "linux")))]
fn capture(_platform: PlatformWebview, tx: Sender<SnapshotResult>) {
    let _ = tx.send(Err(
        "Snapshots are not supported on this platform".to_string()
    ));
}
