use crate::modules::mcp::client::{McpClient, RequestOptions};
use crate::modules::mcp::error::{McpError, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpTool {
    pub name: String,
    pub description: String,
    #[serde(rename = "inputSchema", default)]
    pub input_schema: Value,
}

#[derive(Debug, Clone, Deserialize)]
struct ToolListResult {
    tools: Vec<McpTool>,
}

pub async fn list_tools(client: &McpClient) -> Result<Vec<McpTool>> {
    let response = client
        .request("tools/list", None, RequestOptions::default())
        .await?;
    let result: ToolListResult = serde_json::from_value(response)
        .map_err(|e| McpError::Serialization(format!("invalid tools/list response: {e}")))?;
    Ok(result.tools)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpToolCallResult {
    pub content: Value,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_error: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub async fn call_tool(
    client: &McpClient,
    tool_name: &str,
    arguments: Option<Value>,
) -> Result<McpToolCallResult> {
    let params = serde_json::json!({
        "name": tool_name,
        "arguments": arguments.unwrap_or(Value::Object(serde_json::Map::new())),
    });

    let response = client
        .request("tools/call", Some(params), RequestOptions::default())
        .await?;

    let result: McpToolCallResult = serde_json::from_value(response)
        .map_err(|e| McpError::Serialization(format!("invalid tools/call response: {e}")))?;

    Ok(result)
}
