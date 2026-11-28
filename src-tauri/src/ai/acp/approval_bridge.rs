use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Emitter};
use tokio::sync::{oneshot, Mutex};
use tokio::time::timeout;

use super::error::{AcpError, Result};
use super::tool_calls::diffs;
use super::types::{
    PermissionOption, PermissionOutcome, RequestPermissionRequest, RequestPermissionResponse,
};
use crate::commands::ai::ToolCallDiff;

const APPROVAL_TIMEOUT_SECONDS: u64 = 60;
/// Kimi answers to this id when it sends no options of the standard kinds.
const LEGACY_APPROVE_OPTION: &str = "approve_once";

/// How the user answered a permission request.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ApprovalDecision {
    Allow,
    AllowAlways,
    Deny,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ApprovalEvent {
    session_id: String,
    chat_session_id: String,
    tool_call_id: String,
    tool_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    args: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    description: Option<String>,
    /// The agent's own name for "always allow", when it offers one.
    #[serde(skip_serializing_if = "Option::is_none")]
    always_label: Option<String>,
    /// The file changes the agent asks to make, so the person sees what they allow.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    diffs: Vec<ToolCallDiff>,
}

/// The option that carries a decision, preferring the exact kind the agent offers.
fn pick_option(options: &[PermissionOption], decision: ApprovalDecision) -> Option<String> {
    let kinds: &[&str] = match decision {
        ApprovalDecision::Allow => &["allow_once"],
        ApprovalDecision::AllowAlways => &["allow_always", "allow_once"],
        ApprovalDecision::Deny => &["reject_once"],
    };
    kinds.iter().find_map(|kind| {
        options
            .iter()
            .find(|option| option.kind == *kind)
            .map(|option| option.option_id.clone())
    })
}

fn response_for(options: &[PermissionOption], decision: ApprovalDecision) -> Result<Value> {
    let option_id = match pick_option(options, decision) {
        Some(option_id) => option_id,
        None if decision == ApprovalDecision::Deny => return Err(AcpError::ApprovalRejected),
        None => LEGACY_APPROVE_OPTION.to_string(),
    };
    let response = RequestPermissionResponse {
        outcome: PermissionOutcome::Selected { option_id },
    };
    Ok(serde_json::to_value(&response)?)
}

#[derive(Clone)]
pub struct ApprovalBridge {
    app_handle: AppHandle,
    pending: Arc<Mutex<HashMap<String, oneshot::Sender<ApprovalDecision>>>>,
}

impl ApprovalBridge {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            app_handle,
            pending: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn request_permission(
        &self,
        params: Option<Value>,
        chat_session_id: &str,
    ) -> Result<Value> {
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
        let diffs = diffs(&req.tool_call.content);
        let always_label = req
            .options
            .iter()
            .find(|option| option.kind == "allow_always")
            .map(|option| option.name.clone());

        let (tx, rx) = oneshot::channel();
        {
            let mut pending = self.pending.lock().await;
            pending.insert(tool_call_id.clone(), tx);
        }

        let event = ApprovalEvent {
            session_id: req.session_id,
            chat_session_id: chat_session_id.to_string(),
            tool_call_id: tool_call_id.clone(),
            tool_name,
            args,
            description: None,
            always_label,
            diffs,
        };

        self.app_handle
            .emit("acp_request_permission", event)
            .map_err(|e| AcpError::Protocol(format!("failed to emit approval event: {e}")))?;

        let decision = match timeout(Duration::from_secs(APPROVAL_TIMEOUT_SECONDS), rx).await {
            Ok(Ok(decision)) => decision,
            Ok(Err(_)) => ApprovalDecision::Deny,
            Err(_) => {
                let mut pending = self.pending.lock().await;
                pending.remove(&tool_call_id);
                return Err(AcpError::ApprovalTimeout);
            }
        };

        response_for(&req.options, decision)
    }

    pub async fn respond(&self, tool_call_id: &str, decision: ApprovalDecision) -> Result<()> {
        let sender = {
            let mut pending = self.pending.lock().await;
            pending.remove(tool_call_id)
        };

        match sender {
            Some(tx) => {
                let _ = tx.send(decision);
                Ok(())
            }
            None => Err(AcpError::Protocol(format!(
                "no pending approval for tool_call_id {tool_call_id}"
            ))),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn option(option_id: &str, kind: &str) -> PermissionOption {
        PermissionOption {
            option_id: option_id.to_string(),
            name: option_id.to_string(),
            kind: kind.to_string(),
        }
    }

    fn selected(value: Value) -> String {
        value["outcome"]["optionId"]
            .as_str()
            .unwrap_or_default()
            .to_string()
    }

    #[test]
    fn each_decision_selects_the_option_of_its_kind() {
        let options = vec![
            option("always", "allow_always"),
            option("once", "allow_once"),
            option("no", "reject_once"),
        ];
        let pick = |decision| response_for(&options, decision).map(selected).ok();
        assert_eq!(pick(ApprovalDecision::Allow).as_deref(), Some("once"));
        assert_eq!(
            pick(ApprovalDecision::AllowAlways).as_deref(),
            Some("always")
        );
        assert_eq!(pick(ApprovalDecision::Deny).as_deref(), Some("no"));
    }

    #[test]
    fn always_falls_back_to_once_and_deny_without_option_rejects() {
        let options = vec![option("once", "allow_once")];
        let always = response_for(&options, ApprovalDecision::AllowAlways).map(selected);
        assert_eq!(always.ok().as_deref(), Some("once"));
        assert!(matches!(
            response_for(&options, ApprovalDecision::Deny),
            Err(AcpError::ApprovalRejected)
        ));
    }

    #[test]
    fn agents_without_options_get_the_legacy_approve_id() {
        let allow = response_for(&[], ApprovalDecision::Allow).map(selected);
        assert_eq!(allow.ok().as_deref(), Some(LEGACY_APPROVE_OPTION));
    }

    #[test]
    fn permission_requests_carry_their_diff_and_may_leave_out_content() {
        let edit: RequestPermissionRequest = serde_json::from_value(serde_json::json!({
            "sessionId": "s1",
            "options": [{ "optionId": "allow", "name": "Allow", "kind": "allow_once" }],
            "toolCall": {
                "toolCallId": "t1",
                "title": "Edit a.ts",
                "rawInput": { "file_path": "/repo/a.ts" },
                "content": [{ "type": "diff", "path": "/repo/a.ts", "oldText": "a", "newText": "b" }]
            }
        }))
        .expect("edit request");
        let bare: RequestPermissionRequest = serde_json::from_value(serde_json::json!({
            "sessionId": "s1",
            "options": [],
            "toolCall": { "toolCallId": "t2" }
        }))
        .expect("request without title and content");

        let found = diffs(&edit.tool_call.content);
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].path, "/repo/a.ts");
        assert!(bare.tool_call.content.is_empty());
    }
}
