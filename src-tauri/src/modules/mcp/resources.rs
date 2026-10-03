//! MCP resources (`@` context in the composer) and prompts (slash commands).

use crate::modules::mcp::client::RequestOptions;
use crate::modules::mcp::connection::McpConnection;
use crate::modules::mcp::error::{McpError, Result};
use crate::modules::mcp::McpManager;
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use std::collections::HashMap;
use tauri::State;

// Guards against servers that keep returning a cursor.
const MAX_PAGES: usize = 20;
const MAX_URI_LEN: usize = 4096;
const MAX_PROMPT_NAME_LEN: usize = 256;
const MAX_ARGUMENT_LEN: usize = 16 * 1024;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpResource {
    pub uri: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mime_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpResourceContent {
    pub uri: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mime_type: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    /// Base64 data of binary contents; the frontend only uses text.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub blob: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpPromptArgument {
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default)]
    pub required: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpPrompt {
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default)]
    pub arguments: Vec<McpPromptArgument>,
}

#[derive(Debug, Clone, Serialize)]
pub struct McpPromptMessage {
    pub role: String,
    pub text: String,
}

/// Collects one list endpoint across its pages.
async fn list_paged<T: for<'de> Deserialize<'de>>(
    client: &McpConnection,
    method: &str,
    field: &str,
) -> Result<Vec<T>> {
    let mut items = Vec::new();
    let mut cursor: Option<String> = None;
    for _ in 0..MAX_PAGES {
        let params = cursor.as_ref().map(|cursor| json!({ "cursor": cursor }));
        let response = client
            .request(method, params, RequestOptions::default())
            .await?;
        let page = response
            .get(field)
            .cloned()
            .unwrap_or(Value::Array(Vec::new()));
        let page: Vec<T> = serde_json::from_value(page)
            .map_err(|e| McpError::Serialization(format!("invalid {method} response: {e}")))?;
        items.extend(page);
        cursor = response
            .get("nextCursor")
            .and_then(Value::as_str)
            .map(str::to_string);
        if cursor.is_none() {
            break;
        }
    }
    Ok(items)
}

pub async fn list_resources(client: &McpConnection) -> Result<Vec<McpResource>> {
    list_paged(client, "resources/list", "resources").await
}

pub async fn read_resource(client: &McpConnection, uri: &str) -> Result<Vec<McpResourceContent>> {
    let response = client
        .request(
            "resources/read",
            Some(json!({ "uri": uri })),
            RequestOptions::default(),
        )
        .await?;
    let contents = response
        .get("contents")
        .cloned()
        .unwrap_or(Value::Array(Vec::new()));
    serde_json::from_value(contents)
        .map_err(|e| McpError::Serialization(format!("invalid resources/read response: {e}")))
}

pub async fn list_prompts(client: &McpConnection) -> Result<Vec<McpPrompt>> {
    list_paged(client, "prompts/list", "prompts").await
}

/// Text of each prompt message; embedded resources contribute their text.
pub fn prompt_messages(response: &Value) -> Vec<McpPromptMessage> {
    let messages = response
        .get("messages")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    messages
        .iter()
        .filter_map(|message| {
            let role = message.get("role").and_then(Value::as_str)?.to_string();
            let content = message.get("content")?;
            let text = match content.get("type").and_then(Value::as_str) {
                Some("text") => content.get("text").and_then(Value::as_str),
                Some("resource") => content
                    .get("resource")
                    .and_then(|resource| resource.get("text"))
                    .and_then(Value::as_str),
                _ => None,
            }?;
            Some(McpPromptMessage {
                role,
                text: text.to_string(),
            })
        })
        .collect()
}

pub async fn get_prompt(
    client: &McpConnection,
    name: &str,
    arguments: &HashMap<String, String>,
) -> Result<Vec<McpPromptMessage>> {
    let arguments: Map<String, Value> = arguments
        .iter()
        .map(|(key, value)| (key.clone(), Value::String(value.clone())))
        .collect();
    let response = client
        .request(
            "prompts/get",
            Some(json!({ "name": name, "arguments": arguments })),
            RequestOptions::default(),
        )
        .await?;
    Ok(prompt_messages(&response))
}

impl McpManager {
    pub async fn list_resources(&self, id: &str) -> Result<Vec<McpResource>> {
        if !self.capabilities(id).await.is_some_and(|c| c.resources) {
            return Ok(Vec::new());
        }
        list_resources(&self.connection(id).await?).await
    }

    pub async fn read_resource(&self, id: &str, uri: &str) -> Result<Vec<McpResourceContent>> {
        read_resource(&self.connection(id).await?, uri).await
    }

    pub async fn list_prompts(&self, id: &str) -> Result<Vec<McpPrompt>> {
        if !self.capabilities(id).await.is_some_and(|c| c.prompts) {
            return Ok(Vec::new());
        }
        list_prompts(&self.connection(id).await?).await
    }

    pub async fn get_prompt(
        &self,
        id: &str,
        name: &str,
        arguments: &HashMap<String, String>,
    ) -> Result<Vec<McpPromptMessage>> {
        get_prompt(&self.connection(id).await?, name, arguments).await
    }
}

#[tauri::command]
pub async fn mcp_list_resources(
    state: State<'_, McpManager>,
    id: String,
) -> std::result::Result<Vec<McpResource>, String> {
    state.list_resources(&id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn mcp_read_resource(
    state: State<'_, McpManager>,
    id: String,
    uri: String,
) -> std::result::Result<Vec<McpResourceContent>, String> {
    if uri.is_empty() || uri.len() > MAX_URI_LEN {
        return Err("uri is invalid".to_string());
    }
    state
        .read_resource(&id, &uri)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn mcp_list_prompts(
    state: State<'_, McpManager>,
    id: String,
) -> std::result::Result<Vec<McpPrompt>, String> {
    state.list_prompts(&id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn mcp_get_prompt(
    state: State<'_, McpManager>,
    id: String,
    name: String,
    arguments: HashMap<String, String>,
) -> std::result::Result<Vec<McpPromptMessage>, String> {
    if name.is_empty() || name.len() > MAX_PROMPT_NAME_LEN {
        return Err("name is invalid".to_string());
    }
    if arguments
        .iter()
        .any(|(key, value)| key.is_empty() || value.len() > MAX_ARGUMENT_LEN)
    {
        return Err("prompt arguments are invalid".to_string());
    }
    state
        .get_prompt(&id, &name, &arguments)
        .await
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prompt_messages_keep_text_and_resource_text() {
        let response = json!({
            "messages": [
                { "role": "user", "content": { "type": "text", "text": "Review this" } },
                { "role": "user", "content": { "type": "resource", "resource": { "uri": "file:///a", "text": "fn main() {}" } } },
                { "role": "assistant", "content": { "type": "image", "data": "..." } }
            ]
        });
        let messages = prompt_messages(&response);
        assert_eq!(messages.len(), 2);
        assert_eq!(messages[0].text, "Review this");
        assert_eq!(messages[1].text, "fn main() {}");
    }

    #[test]
    fn resources_and_prompts_deserialize_with_optional_fields() {
        let resource: McpResource = serde_json::from_value(
            json!({ "uri": "file:///a", "name": "a", "mimeType": "text/plain" }),
        )
        .unwrap();
        assert_eq!(resource.mime_type.as_deref(), Some("text/plain"));
        let prompt: McpPrompt = serde_json::from_value(json!({ "name": "review" })).unwrap();
        assert!(prompt.arguments.is_empty());
    }
}
