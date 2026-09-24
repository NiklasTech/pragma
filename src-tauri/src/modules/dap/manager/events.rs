use crate::modules::dap::client::DapEventMessage;
use crate::modules::dap::types::{DapEvent, DapSessionStatus, DapStatusEvent};
use tauri::{AppHandle, Emitter};

use super::session::SessionSlot;
use super::DapManager;

impl DapManager {
    pub(super) async fn forward_events(
        app_handle: AppHandle,
        adapter: String,
        slot: SessionSlot,
        mut rx: tokio::sync::mpsc::UnboundedReceiver<DapEventMessage>,
        mut initialized_tx: Option<tokio::sync::oneshot::Sender<()>>,
    ) {
        while let Some(message) = rx.recv().await {
            if message.event == "initialized" {
                if let Some(tx) = initialized_tx.take() {
                    let _ = tx.send(());
                }
            }
            let _ = app_handle.emit(
                "dap_event",
                DapEvent {
                    event: message.event,
                    body: message.body,
                },
            );
        }

        // The event channel closes when the adapter exits (or crashes): clear
        // the session so a new one can start, and notify the frontend.
        {
            let mut session = slot.write().await;
            session.take();
        }
        let _ = app_handle.emit(
            "dap_status_changed",
            DapStatusEvent {
                status: DapSessionStatus::Stopped,
                adapter: Some(adapter),
                error: None,
            },
        );
    }

    pub(super) async fn forward_logs(
        app_handle: AppHandle,
        adapter: String,
        mut rx: tokio::sync::mpsc::UnboundedReceiver<String>,
    ) {
        while let Some(line) = rx.recv().await {
            let _ = app_handle.emit(
                "dap_log",
                serde_json::json!({
                    "adapter": adapter,
                    "line": line,
                }),
            );
        }
    }
}
