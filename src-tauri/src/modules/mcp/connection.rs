//! One MCP session over stdio or Streamable HTTP, plus the initialize handshake.

use crate::modules::mcp::client::{McpClient, RequestOptions};
use crate::modules::mcp::error::Result;
use crate::modules::mcp::http::McpHttpClient;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

pub const PROTOCOL_VERSION: &str = "2025-06-18";
const INITIALIZE_TIMEOUT_MS: u64 = 60_000;

#[derive(Clone)]
pub enum McpConnection {
    Stdio(McpClient),
    Http(McpHttpClient),
}

impl McpConnection {
    pub async fn request(
        &self,
        method: &str,
        params: Option<Value>,
        options: RequestOptions,
    ) -> Result<Value> {
        match self {
            McpConnection::Stdio(client) => client.request(method, params, options).await,
            McpConnection::Http(client) => client.request(method, params, options).await,
        }
    }

    pub async fn notify(&self, method: &str, params: Option<Value>) -> Result<()> {
        match self {
            McpConnection::Stdio(client) => client.notify(method, params).await,
            McpConnection::Http(client) => client.notify(method, params).await,
        }
    }
}

/// What the server offers, from its `initialize` result.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpServerCapabilities {
    pub tools: bool,
    pub resources: bool,
    pub prompts: bool,
}

pub fn parse_capabilities(result: &Value) -> McpServerCapabilities {
    let capabilities = result.get("capabilities").unwrap_or(&Value::Null);
    McpServerCapabilities {
        tools: capabilities.get("tools").is_some(),
        resources: capabilities.get("resources").is_some(),
        prompts: capabilities.get("prompts").is_some(),
    }
}

fn initialize_params() -> Value {
    json!({
        "protocolVersion": PROTOCOL_VERSION,
        "capabilities": {},
        "clientInfo": { "name": "pragma", "version": env!("CARGO_PKG_VERSION") },
    })
}

/// Runs `initialize` and `notifications/initialized`; HTTP sessions then send
/// the negotiated protocol version on every request.
pub async fn initialize(connection: &McpConnection) -> Result<McpServerCapabilities> {
    let result = connection
        .request(
            "initialize",
            Some(initialize_params()),
            RequestOptions {
                timeout_ms: Some(INITIALIZE_TIMEOUT_MS),
            },
        )
        .await?;
    if let McpConnection::Http(client) = connection {
        let version = result
            .get("protocolVersion")
            .and_then(Value::as_str)
            .unwrap_or(PROTOCOL_VERSION);
        client.set_protocol_version(version);
    }
    connection.notify("notifications/initialized", None).await?;
    Ok(parse_capabilities(&result))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn capabilities_follow_the_initialize_result() {
        let result = json!({
            "protocolVersion": "2025-06-18",
            "capabilities": { "tools": { "listChanged": true }, "prompts": {} },
        });
        assert_eq!(
            parse_capabilities(&result),
            McpServerCapabilities {
                tools: true,
                resources: false,
                prompts: true,
            }
        );
        assert_eq!(
            parse_capabilities(&json!({})),
            McpServerCapabilities::default()
        );
    }

    #[test]
    fn initialize_announces_the_client() {
        let params = initialize_params();
        assert_eq!(params["protocolVersion"], PROTOCOL_VERSION);
        assert_eq!(params["clientInfo"]["name"], "pragma");
    }
}
