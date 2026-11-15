use serde::{Deserialize, Serialize};
use serde_json::Value;

pub const MAX_REQUEST_BYTES: u64 = 1024 * 1024;

/// One request of the MCP server: an action, the target window and the action's arguments.
#[derive(Debug, Deserialize)]
pub struct BridgeRequest {
    pub token: String,
    pub action: String,
    #[serde(default)]
    pub window: Option<String>,
    #[serde(default)]
    pub args: Value,
}

/// The answer to one request; `image` is a base64 PNG.
#[derive(Debug, Serialize, PartialEq)]
pub struct BridgeReply {
    pub ok: bool,
    pub text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image: Option<String>,
}

impl BridgeReply {
    pub fn text(text: impl Into<String>) -> Self {
        Self {
            ok: true,
            text: text.into(),
            image: None,
        }
    }

    pub fn error(text: impl Into<String>) -> Self {
        Self {
            ok: false,
            text: text.into(),
            image: None,
        }
    }
}

/// A numeric argument clamped to `min..=max`, or `default` when it is missing.
pub fn number_arg(args: &Value, key: &str, default: u64, min: u64, max: u64) -> u64 {
    args.get(key)
        .and_then(Value::as_f64)
        .map(|value| value.max(0.0) as u64)
        .unwrap_or(default)
        .clamp(min, max)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn number_arg_clamps_and_defaults() {
        let args = json!({ "lines": 5000, "limit": 3.7, "neg": -4 });
        assert_eq!(number_arg(&args, "lines", 100, 1, 2000), 2000);
        assert_eq!(number_arg(&args, "limit", 50, 1, 500), 3);
        assert_eq!(number_arg(&args, "neg", 50, 1, 500), 1);
        assert_eq!(number_arg(&args, "missing", 50, 1, 500), 50);
    }

    #[test]
    fn requests_default_the_window_and_args() {
        let request: BridgeRequest =
            serde_json::from_str(r#"{"token":"t","action":"status"}"#).unwrap();
        assert_eq!(request.action, "status");
        assert!(request.window.is_none());
        assert!(request.args.is_null());
    }
}
