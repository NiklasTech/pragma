use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize)]
pub(super) struct DapRequest {
    pub(super) seq: u64,
    #[serde(rename = "type")]
    pub(super) msg_type: &'static str,
    pub(super) command: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) arguments: Option<Value>,
}

#[derive(Debug, Clone, Deserialize)]
pub(super) struct DapResponse {
    pub(super) request_seq: u64,
    pub(super) success: bool,
    #[serde(default)]
    pub(super) message: Option<String>,
    #[serde(default)]
    pub(super) body: Option<Value>,
}

#[derive(Debug, Clone, Deserialize)]
pub(super) struct DapReverseRequest {
    pub(super) seq: u64,
    pub(super) command: String,
}

#[derive(Debug, Clone, Serialize)]
pub(super) struct DapReverseResponse {
    pub(super) seq: u64,
    #[serde(rename = "type")]
    pub(super) msg_type: &'static str,
    pub(super) request_seq: u64,
    pub(super) success: bool,
    pub(super) command: String,
    pub(super) message: String,
}

#[derive(Debug, Clone)]
pub struct DapEventMessage {
    pub event: String,
    pub body: Option<Value>,
}
