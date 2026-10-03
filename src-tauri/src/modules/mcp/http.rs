//! Streamable HTTP transport: every JSON-RPC message is a POST; the server
//! answers with JSON or an event stream, and may push notifications on a GET
//! stream.

use crate::modules::mcp::client::{
    JsonRpcNotification, JsonRpcRequest, JsonRpcResponse, JsonRpcResponseBody, Notification,
    RequestOptions,
};
use crate::modules::mcp::error::{JsonRpcErrorCode, McpError, Result};
use futures_util::StreamExt;
use reqwest::header::{HeaderMap, HeaderName, HeaderValue, ACCEPT, AUTHORIZATION, CONTENT_TYPE};
use reqwest::{Method, StatusCode};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::sync::mpsc;

use super::sse::SseParser;

const JSONRPC_VERSION: &str = "2.0";
const DEFAULT_TIMEOUT_MS: u64 = 30_000;
const CLOSE_TIMEOUT: Duration = Duration::from_secs(3);
const SESSION_HEADER: &str = "mcp-session-id";
const PROTOCOL_HEADER: &str = "mcp-protocol-version";
const EVENT_STREAM: &str = "text/event-stream";
const POST_ACCEPT: &str = "application/json, text/event-stream";
const MAX_STREAM_FAILURES: u32 = 5;
const MAX_ERROR_BODY: usize = 500;

#[derive(Debug, Clone, Default)]
pub struct McpHttpConfig {
    pub url: String,
    pub headers: HashMap<String, String>,
    pub bearer_token: Option<String>,
    pub request_timeout_ms: Option<u64>,
}

/// Remote servers must use http or https with a host.
pub fn validate_url(url: &str) -> Result<reqwest::Url> {
    let parsed = reqwest::Url::parse(url.trim())
        .map_err(|e| McpError::Config(format!("invalid server URL '{url}': {e}")))?;
    if !matches!(parsed.scheme(), "http" | "https") || parsed.host_str().is_none() {
        return Err(McpError::Config(format!(
            "server URL must be http or https: {url}"
        )));
    }
    Ok(parsed)
}

fn header_map(config: &McpHttpConfig) -> Result<HeaderMap> {
    let mut headers = HeaderMap::new();
    for (name, value) in &config.headers {
        let name = HeaderName::from_bytes(name.trim().as_bytes())
            .map_err(|_| McpError::Config(format!("invalid header name: {name}")))?;
        let value = HeaderValue::from_str(value.trim())
            .map_err(|_| McpError::Config(format!("invalid value for header {name}")))?;
        headers.insert(name, value);
    }
    if let Some(token) = &config.bearer_token {
        let value = HeaderValue::from_str(&format!("Bearer {token}"))
            .map_err(|_| McpError::Config("invalid OAuth access token".to_string()))?;
        headers.insert(AUTHORIZATION, value);
    }
    Ok(headers)
}

fn http_error(err: reqwest::Error) -> McpError {
    McpError::Http(err.to_string())
}

async fn check_status(response: reqwest::Response) -> Result<reqwest::Response> {
    let status = response.status();
    if status.is_success() {
        return Ok(response);
    }
    if status == StatusCode::UNAUTHORIZED {
        let challenge = response
            .headers()
            .get(reqwest::header::WWW_AUTHENTICATE)
            .and_then(|value| value.to_str().ok())
            .unwrap_or_default()
            .to_string();
        return Err(McpError::AuthRequired(challenge));
    }
    let body = response.text().await.unwrap_or_default();
    let body: String = body.chars().take(MAX_ERROR_BODY).collect();
    Err(McpError::Http(format!("HTTP {status}: {}", body.trim())))
}

struct HttpInner {
    http: reqwest::Client,
    url: reqwest::Url,
    headers: HeaderMap,
    session_id: Mutex<Option<String>>,
    protocol_version: Mutex<Option<String>>,
    next_id: AtomicU64,
    request_timeout_ms: u64,
    notification_tx: mpsc::UnboundedSender<Notification>,
}

#[derive(Clone)]
pub struct McpHttpClient {
    inner: Arc<HttpInner>,
}

impl McpHttpClient {
    pub fn new(config: McpHttpConfig) -> Result<(Self, mpsc::UnboundedReceiver<Notification>)> {
        let url = validate_url(&config.url)?;
        let headers = header_map(&config)?;
        let http = reqwest::Client::builder()
            .user_agent(concat!("pragma/", env!("CARGO_PKG_VERSION")))
            .build()
            .map_err(http_error)?;
        let (notification_tx, notification_rx) = mpsc::unbounded_channel();
        let client = Self {
            inner: Arc::new(HttpInner {
                http,
                url,
                headers,
                session_id: Mutex::new(None),
                protocol_version: Mutex::new(None),
                next_id: AtomicU64::new(1),
                request_timeout_ms: config.request_timeout_ms.unwrap_or(DEFAULT_TIMEOUT_MS),
                notification_tx,
            }),
        };
        Ok((client, notification_rx))
    }

    pub fn set_protocol_version(&self, version: &str) {
        if let Ok(mut slot) = self.inner.protocol_version.lock() {
            *slot = Some(version.to_string());
        }
    }

    fn session_id(&self) -> Option<String> {
        self.inner
            .session_id
            .lock()
            .ok()
            .and_then(|slot| slot.clone())
    }

    fn remember_session(&self, response: &reqwest::Response) {
        let id = response
            .headers()
            .get(SESSION_HEADER)
            .and_then(|value| value.to_str().ok());
        if let (Some(id), Ok(mut slot)) = (id, self.inner.session_id.lock()) {
            *slot = Some(id.to_string());
        }
    }

    fn base_request(&self, method: Method) -> reqwest::RequestBuilder {
        let mut request = self
            .inner
            .http
            .request(method, self.inner.url.clone())
            .headers(self.inner.headers.clone());
        if let Some(id) = self.session_id() {
            request = request.header(SESSION_HEADER, id);
        }
        let version = self
            .inner
            .protocol_version
            .lock()
            .ok()
            .and_then(|slot| slot.clone());
        if let Some(version) = version {
            request = request.header(PROTOCOL_HEADER, version);
        }
        request
    }

    pub async fn request(
        &self,
        method: &str,
        params: Option<Value>,
        options: RequestOptions,
    ) -> Result<Value> {
        if method.is_empty() {
            return Err(McpError::Serialization("method is required".to_string()));
        }
        let id = self.inner.next_id.fetch_add(1, Ordering::SeqCst);
        let body = JsonRpcRequest {
            jsonrpc: JSONRPC_VERSION.to_string(),
            id,
            method: method.to_string(),
            params,
        };
        let timeout_ms = options.timeout_ms.unwrap_or(self.inner.request_timeout_ms);
        tokio::time::timeout(
            Duration::from_millis(timeout_ms),
            self.send_request(id, &body),
        )
        .await
        .map_err(|_| McpError::Timeout)?
    }

    async fn send_request(&self, id: u64, body: &JsonRpcRequest) -> Result<Value> {
        let response = self
            .base_request(Method::POST)
            .header(ACCEPT, POST_ACCEPT)
            .header(CONTENT_TYPE, "application/json")
            .body(serde_json::to_string(body)?)
            .send()
            .await
            .map_err(http_error)?;
        let response = check_status(response).await?;
        self.remember_session(&response);

        let is_stream = response
            .headers()
            .get(CONTENT_TYPE)
            .and_then(|value| value.to_str().ok())
            .is_some_and(|value| value.starts_with(EVENT_STREAM));
        if !is_stream {
            let text = response.text().await.map_err(http_error)?;
            return self.dispatch(&text, Some(id)).unwrap_or_else(|| {
                Err(McpError::Serialization(format!(
                    "no response to request {id}"
                )))
            });
        }

        let mut stream = response.bytes_stream();
        let mut parser = SseParser::default();
        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(http_error)?;
            for data in parser.push(&chunk) {
                if let Some(result) = self.dispatch(&data, Some(id)) {
                    return result;
                }
            }
        }
        Err(McpError::ConnectionClosed)
    }

    /// Forwards notifications in `payload` and returns the response to `expected`.
    fn dispatch(&self, payload: &str, expected: Option<u64>) -> Option<Result<Value>> {
        let value: Value = serde_json::from_str(payload.trim()).ok()?;
        let messages = match value {
            Value::Array(items) => items,
            other => vec![other],
        };
        let mut found = None;
        for message in messages {
            if message.get("method").is_some() {
                // Pragma declares no client capabilities, so server requests are not expected.
                if message.get("id").is_none() {
                    if let Ok(notification) = serde_json::from_value::<JsonRpcNotification>(message)
                    {
                        let _ = self.inner.notification_tx.send(Notification {
                            method: notification.method,
                            params: notification.params,
                        });
                    }
                }
                continue;
            }
            let Ok(response) = serde_json::from_value::<JsonRpcResponse>(message) else {
                continue;
            };
            if Some(response.id) == expected {
                found = Some(match response.body {
                    JsonRpcResponseBody::Result(value) => Ok(value),
                    JsonRpcResponseBody::Error(err) => Err(McpError::Rpc {
                        code: JsonRpcErrorCode::from(err.code),
                        message: err.message,
                        data: err.data,
                    }),
                });
            }
        }
        found
    }

    pub async fn notify(&self, method: &str, params: Option<Value>) -> Result<()> {
        let body = JsonRpcNotification {
            jsonrpc: JSONRPC_VERSION.to_string(),
            method: method.to_string(),
            params,
        };
        let response = self
            .base_request(Method::POST)
            .header(ACCEPT, POST_ACCEPT)
            .header(CONTENT_TYPE, "application/json")
            .body(serde_json::to_string(&body)?)
            .timeout(Duration::from_millis(self.inner.request_timeout_ms))
            .send()
            .await
            .map_err(http_error)?;
        check_status(response).await.map(|_| ())
    }

    /// Reads server-initiated messages from the optional GET stream until it is unsupported.
    pub fn spawn_event_stream(&self) -> tokio::task::JoinHandle<()> {
        let client = self.clone();
        tokio::spawn(async move {
            let mut failures = 0u32;
            loop {
                let response = client
                    .base_request(Method::GET)
                    .header(ACCEPT, EVENT_STREAM)
                    .send()
                    .await;
                match response {
                    Ok(response) if response.status() == StatusCode::METHOD_NOT_ALLOWED => return,
                    Ok(response) if response.status().is_success() => {
                        failures = 0;
                        let mut stream = response.bytes_stream();
                        let mut parser = SseParser::default();
                        while let Some(Ok(chunk)) = stream.next().await {
                            for data in parser.push(&chunk) {
                                let _ = client.dispatch(&data, None);
                            }
                        }
                    }
                    _ => failures += 1,
                }
                if failures >= MAX_STREAM_FAILURES {
                    return;
                }
                tokio::time::sleep(Duration::from_secs(u64::from(failures) + 1)).await;
            }
        })
    }

    /// Ends the server session; servers without session support may refuse.
    pub async fn close(&self) {
        if self.session_id().is_none() {
            return;
        }
        let _ = self
            .base_request(Method::DELETE)
            .timeout(CLOSE_TIMEOUT)
            .send()
            .await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn client() -> (McpHttpClient, mpsc::UnboundedReceiver<Notification>) {
        McpHttpClient::new(McpHttpConfig {
            url: "https://mcp.example.com/mcp".to_string(),
            ..Default::default()
        })
        .unwrap()
    }

    #[test]
    fn validates_server_urls() {
        assert!(validate_url("https://mcp.example.com/mcp").is_ok());
        assert!(validate_url("http://localhost:3000/mcp").is_ok());
        assert!(validate_url("ftp://example.com").is_err());
        assert!(validate_url("not a url").is_err());
    }

    #[test]
    fn rejects_invalid_headers() {
        let mut headers = HashMap::new();
        headers.insert("Bad Header".to_string(), "x".to_string());
        let result = McpHttpClient::new(McpHttpConfig {
            url: "https://mcp.example.com".to_string(),
            headers,
            ..Default::default()
        });
        assert!(result.is_err());
    }

    #[test]
    fn bearer_token_becomes_the_authorization_header() {
        let headers = header_map(&McpHttpConfig {
            bearer_token: Some("abc".to_string()),
            ..Default::default()
        })
        .unwrap();
        assert_eq!(headers.get(AUTHORIZATION).unwrap(), "Bearer abc");
    }

    #[test]
    fn dispatch_returns_the_matching_response() {
        let (client, _rx) = client();
        let result = client
            .dispatch(r#"{"jsonrpc":"2.0","id":3,"result":{"ok":true}}"#, Some(3))
            .unwrap()
            .unwrap();
        assert_eq!(result["ok"], true);
        assert!(client
            .dispatch(r#"{"jsonrpc":"2.0","id":4,"result":{}}"#, Some(3))
            .is_none());
    }

    #[test]
    fn dispatch_maps_errors_and_forwards_notifications() {
        let (client, mut rx) = client();
        let payload = r#"[{"jsonrpc":"2.0","method":"notifications/tools/list_changed"},{"jsonrpc":"2.0","id":1,"error":{"code":-32601,"message":"nope"}}]"#;
        let result = client.dispatch(payload, Some(1)).unwrap();
        assert!(matches!(result, Err(McpError::Rpc { .. })));
        assert_eq!(
            rx.try_recv().unwrap().method,
            "notifications/tools/list_changed"
        );
    }

    #[test]
    fn dispatch_ignores_server_requests() {
        let (client, mut rx) = client();
        let payload = r#"{"jsonrpc":"2.0","id":9,"method":"sampling/createMessage"}"#;
        assert!(client.dispatch(payload, Some(9)).is_none());
        assert!(rx.try_recv().is_err());
    }
}
