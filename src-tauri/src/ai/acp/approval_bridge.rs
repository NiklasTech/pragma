use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Emitter};
use tokio::sync::{oneshot, Mutex};
use tokio::time::timeout;

use super::error::{AcpError, Result};
use super::types::{PermissionOutcome, RequestPermissionRequest, RequestPermissionResponse};

const APPROVAL_TIMEOUT_SECONDS: u64 = 60;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ApprovalEvent {
    session_id: String,
    tool_call_id: String,
    tool_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    args: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    description: Option<String>,
}

#[derive(Clone)]
pub struct ApprovalBridge {
    app_handle: AppHandle,
    pending: Arc<Mutex<HashMap<String, oneshot::Sender<bool>>>>,
}

impl ApprovalBridge {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            app_handle,
            pending: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn request_permission(&self, params: Option<Value>) -> Result<Value> {
        let req: RequestPermissionRequest = serde_json::from_value(params.unwrap_or(Value::Null))?;

        let tool_call_id = req.tool_call.tool_call_id.clone();
        let tool_name = req.tool_call.title.clone();
        // Best-effort args: prefer the first text content entry, fall back to rawInput.
        let args = req.tool_call.content.iter().find_map(|c| match &c.content {
            Some(super::types::ContentBlock::Text { text }) => {
                Some(serde_json::Value::String(text.clone()))
            }
            _ => None,
        });

        let (tx, rx) = oneshot::channel();
        {
            let mut pending = self.pending.lock().await;
            pending.insert(tool_call_id.clone(), tx);
        }

        let event = ApprovalEvent {
            session_id: req.session_id,
            tool_call_id: tool_call_id.clone(),
            tool_name,
            args,
            description: None,
        };

        self.app_handle
            .emit("acp_request_permission", event)
            .map_err(|e| AcpError::Protocol(format!("failed to emit approval event: {e}")))?;

        let approved = match timeout(Duration::from_secs(APPROVAL_TIMEOUT_SECONDS), rx).await {
            Ok(Ok(approved)) => approved,
            Ok(Err(_)) => false,
            Err(_) => {
                let mut pending = self.pending.lock().await;
                pending.remove(&tool_call_id);
                return Err(AcpError::ApprovalTimeout);
            }
        };

        if !approved {
            return Err(AcpError::ApprovalRejected);
        }

        // Map a simple approve/deny to Kimi's canonical "approve_once" option.
        let response = RequestPermissionResponse {
            outcome: PermissionOutcome::Selected {
                option_id: "approve_once".to_string(),
            },
        };
        serde_json::to_value(response).map_err(Into::into)
    }

    pub async fn respond(&self, tool_call_id: &str, approved: bool) -> Result<()> {
        let sender = {
            let mut pending = self.pending.lock().await;
            pending.remove(tool_call_id)
        };

        match sender {
            Some(tx) => {
                let _ = tx.send(approved);
                Ok(())
            }
            None => Err(AcpError::Protocol(format!(
                "no pending approval for tool_call_id {tool_call_id}"
            ))),
        }
    }
}
