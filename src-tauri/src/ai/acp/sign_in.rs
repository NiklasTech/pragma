use serde::Serialize;
use serde_json::Value;

use super::error::AcpError;
use crate::modules::process_end::end_groups;

/// How long a sign-in may take; the agent waits for the person to finish it in the browser.
pub const SIGN_IN_TIMEOUT_MS: u64 = 5 * 60 * 1000;

/// The JSON-RPC code ACP agents answer with when a session needs a signed-in account.
const AUTH_REQUIRED_CODE: i64 = -32000;

/// A way to sign in that the agent runs itself, e.g. a browser login.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthMethodInfo {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
}

/// The sign-in methods of an `initialize` response that the agent runs on `authenticate`.
/// Methods of another type (a terminal command, an environment variable) are left out.
pub fn auth_methods(init_response: &Value) -> Vec<AuthMethodInfo> {
    let Some(methods) = init_response.get("authMethods").and_then(Value::as_array) else {
        return Vec::new();
    };
    methods
        .iter()
        .filter(|method| {
            matches!(
                method.get("type").and_then(Value::as_str),
                None | Some("agent")
            )
        })
        .filter_map(|method| {
            let id = method.get("id")?.as_str()?.to_string();
            Some(AuthMethodInfo {
                name: method
                    .get("name")
                    .and_then(Value::as_str)
                    .map(str::to_string)
                    .unwrap_or_else(|| id.clone()),
                description: method
                    .get("description")
                    .and_then(Value::as_str)
                    .map(str::to_string),
                id,
            })
        })
        .collect()
}

pub fn is_auth_required(error: &AcpError) -> bool {
    matches!(error, AcpError::JsonRpc { code, .. } if *code == AUTH_REQUIRED_CODE)
}

/// Ends a just started agent unless its session came up, so a failed start leaves no process.
pub struct EndOnError {
    group: Option<u32>,
}

impl EndOnError {
    pub fn new(group: Option<u32>) -> Self {
        Self { group }
    }

    pub fn disarm(&mut self) {
        self.group = None;
    }
}

impl Drop for EndOnError {
    fn drop(&mut self) {
        if let Some(group) = self.group.take() {
            std::thread::spawn(move || end_groups(&[group]));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn keeps_the_methods_the_agent_runs_itself() {
        let methods = auth_methods(&json!({ "authMethods": [
            { "id": "grok.com", "name": "Grok", "description": "Sign in with Grok" },
            { "id": "browser", "type": "agent" },
            { "id": "key", "type": "env_var", "name": "API key" },
            { "id": "tui", "type": "terminal", "name": "Terminal login" },
            { "name": "no id" }
        ]}));

        assert_eq!(
            methods,
            vec![
                AuthMethodInfo {
                    id: "grok.com".to_string(),
                    name: "Grok".to_string(),
                    description: Some("Sign in with Grok".to_string()),
                },
                AuthMethodInfo {
                    id: "browser".to_string(),
                    name: "browser".to_string(),
                    description: None,
                },
            ]
        );
        assert!(auth_methods(&json!({})).is_empty());
    }

    #[test]
    fn recognizes_the_auth_required_error() {
        assert!(is_auth_required(&AcpError::JsonRpc {
            code: -32000,
            message: "Authentication required".to_string(),
        }));
        assert!(!is_auth_required(&AcpError::JsonRpc {
            code: -32603,
            message: "Internal error".to_string(),
        }));
        assert!(!is_auth_required(&AcpError::RequestTimeout));
    }
}
