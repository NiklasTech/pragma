use crate::modules::mcp::error::{JsonRpcErrorCode, McpError, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::io::{AsyncBufReadExt, AsyncRead, AsyncWrite, AsyncWriteExt, BufReader};
use tokio::process::Command;
use tokio::sync::{mpsc, oneshot, Mutex};

const JSONRPC_VERSION: &str = "2.0";
const DEFAULT_TIMEOUT_MS: u64 = 30_000;
const MAX_CONCURRENT_REQUESTS: usize = 64;

#[derive(Debug, Clone, Default)]
pub struct McpClientConfig {
    pub command: String,
    pub args: Vec<String>,
    pub env: HashMap<String, String>,
    pub request_timeout_ms: Option<u64>,
}

#[derive(Debug, Clone, Default)]
pub struct RequestOptions {
    pub timeout_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcRequest {
    pub jsonrpc: String,
    pub id: u64,
    pub method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub params: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcResponse {
    pub jsonrpc: String,
    pub id: u64,
    #[serde(flatten)]
    pub body: JsonRpcResponseBody,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum JsonRpcResponseBody {
    Result(Value),
    Error(JsonRpcErrorObject),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcErrorObject {
    pub code: i64,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcNotification {
    pub jsonrpc: String,
    pub method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub params: Option<Value>,
}

#[derive(Debug, Clone)]
pub struct Notification {
    pub method: String,
    pub params: Option<Value>,
}

struct ClientInner {
    next_id: AtomicU64,
    pending: Mutex<HashMap<u64, oneshot::Sender<Result<Value>>>>,
    request_timeout_ms: u64,
    outgoing_tx: mpsc::Sender<String>,
}

pub struct McpClient {
    inner: Arc<ClientInner>,
    _reader_handle: tokio::task::JoinHandle<()>,
    _writer_handle: tokio::task::JoinHandle<()>,
}

impl McpClient {
    pub async fn start(
        config: McpClientConfig,
    ) -> Result<(Self, mpsc::UnboundedReceiver<Notification>)> {
        if config.command.is_empty() {
            return Err(McpError::Serialization("command is required".to_string()));
        }

        let timeout = config.request_timeout_ms.unwrap_or(DEFAULT_TIMEOUT_MS);
        let mut cmd = Command::new(&config.command);
        cmd.args(&config.args)
            .envs(&config.env)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null());

        let mut child = cmd.spawn()?;
        let stdin = child.stdin.take().ok_or(McpError::MissingStdio)?;
        let stdout = child.stdout.take().ok_or(McpError::MissingStdio)?;

        Self::with_io(stdout, stdin, timeout).await
    }

    async fn with_io<R, W>(
        reader: R,
        writer: W,
        request_timeout_ms: u64,
    ) -> Result<(Self, mpsc::UnboundedReceiver<Notification>)>
    where
        R: AsyncRead + Unpin + Send + 'static,
        W: AsyncWrite + Unpin + Send + 'static,
    {
        let (outgoing_tx, outgoing_rx) = mpsc::channel::<String>(MAX_CONCURRENT_REQUESTS);
        let (notification_tx, notification_rx) = mpsc::unbounded_channel::<Notification>();

        let inner = Arc::new(ClientInner {
            next_id: AtomicU64::new(1),
            pending: Mutex::new(HashMap::with_capacity(MAX_CONCURRENT_REQUESTS)),
            request_timeout_ms,
            outgoing_tx,
        });

        let writer_handle = spawn_writer(writer, outgoing_rx);
        let reader_handle = spawn_reader(reader, Arc::clone(&inner), notification_tx);

        let client = McpClient {
            inner,
            _reader_handle: reader_handle,
            _writer_handle: writer_handle,
        };

        Ok((client, notification_rx))
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
        let (tx, rx) = oneshot::channel();

        {
            let mut pending = self.inner.pending.lock().await;
            if pending.len() >= MAX_CONCURRENT_REQUESTS {
                return Err(McpError::TooManyConcurrentRequests);
            }
            pending.insert(id, tx);
        }

        let request = JsonRpcRequest {
            jsonrpc: JSONRPC_VERSION.to_string(),
            id,
            method: method.to_string(),
            params,
        };
        let message = serde_json::to_string(&request)?;
        self.inner
            .outgoing_tx
            .send(message)
            .await
            .map_err(|_| McpError::ConnectionClosed)?;

        let timeout_ms = options.timeout_ms.unwrap_or(self.inner.request_timeout_ms);
        match tokio::time::timeout(Duration::from_millis(timeout_ms), rx).await {
            Ok(Ok(result)) => result,
            Ok(Err(_)) => Err(McpError::ConnectionClosed),
            Err(_) => {
                let mut pending = self.inner.pending.lock().await;
                pending.remove(&id);
                Err(McpError::Timeout)
            }
        }
    }

    pub async fn notify(&self, method: &str, params: Option<Value>) -> Result<()> {
        if method.is_empty() {
            return Err(McpError::Serialization("method is required".to_string()));
        }

        let notification = JsonRpcNotification {
            jsonrpc: JSONRPC_VERSION.to_string(),
            method: method.to_string(),
            params,
        };
        let message = serde_json::to_string(&notification)?;
        self.inner
            .outgoing_tx
            .send(message)
            .await
            .map_err(|_| McpError::ConnectionClosed)?;

        Ok(())
    }
}

fn spawn_writer<W>(
    mut writer: W,
    mut outgoing_rx: mpsc::Receiver<String>,
) -> tokio::task::JoinHandle<()>
where
    W: AsyncWrite + Unpin + Send + 'static,
{
    tokio::spawn(async move {
        while let Some(message) = outgoing_rx.recv().await {
            if write_message(&mut writer, &message).await.is_err() {
                break;
            }
        }
    })
}

async fn write_message<W>(writer: &mut W, message: &str) -> std::io::Result<()>
where
    W: AsyncWrite + Unpin + Send,
{
    writer.write_all(message.as_bytes()).await?;
    writer.write_all(b"\n").await?;
    writer.flush().await
}

fn spawn_reader<R>(
    reader: R,
    inner: Arc<ClientInner>,
    notification_tx: mpsc::UnboundedSender<Notification>,
) -> tokio::task::JoinHandle<()>
where
    R: AsyncRead + Unpin + Send + 'static,
{
    tokio::spawn(async move {
        let mut lines = BufReader::new(reader).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            process_incoming_line(&inner, &notification_tx, &line).await;
        }

        let mut pending = inner.pending.lock().await;
        for (_, sender) in pending.drain() {
            let _ = sender.send(Err(McpError::ConnectionClosed));
        }
    })
}

async fn process_incoming_line(
    inner: &ClientInner,
    notification_tx: &mpsc::UnboundedSender<Notification>,
    line: &str,
) {
    if let Ok(response) = serde_json::from_str::<JsonRpcResponse>(line) {
        let result = match response.body {
            JsonRpcResponseBody::Result(value) => Ok(value),
            JsonRpcResponseBody::Error(err) => Err(McpError::Rpc {
                code: JsonRpcErrorCode::from(err.code),
                message: err.message,
                data: err.data,
            }),
        };

        let mut pending = inner.pending.lock().await;
        if let Some(sender) = pending.remove(&response.id) {
            let _ = sender.send(result);
        }
        return;
    }

    if let Ok(notification) = serde_json::from_str::<JsonRpcNotification>(line) {
        let _ = notification_tx.send(Notification {
            method: notification.method,
            params: notification.params,
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::{duplex, split, AsyncWriteExt};

    type ServerRead = tokio::io::ReadHalf<tokio::io::DuplexStream>;
    type ServerWrite = tokio::io::WriteHalf<tokio::io::DuplexStream>;

    async fn setup() -> (
        McpClient,
        mpsc::UnboundedReceiver<Notification>,
        ServerWrite,
        ServerRead,
    ) {
        let (client_stream, server_stream) = duplex(1024);
        let (client_read, client_write) = split(client_stream);
        let (server_read, server_write) = split(server_stream);

        let (client, notifications) =
            McpClient::with_io(client_read, client_write, DEFAULT_TIMEOUT_MS)
                .await
                .unwrap();

        (client, notifications, server_write, server_read)
    }

    #[test]
    fn json_rpc_error_code_mapping() {
        assert_eq!(JsonRpcErrorCode::from(-32700), JsonRpcErrorCode::ParseError);
        assert_eq!(
            JsonRpcErrorCode::from(-32600),
            JsonRpcErrorCode::InvalidRequest
        );
        assert_eq!(
            JsonRpcErrorCode::from(-32601),
            JsonRpcErrorCode::MethodNotFound
        );
        assert_eq!(
            JsonRpcErrorCode::from(-32602),
            JsonRpcErrorCode::InvalidParams
        );
        assert_eq!(
            JsonRpcErrorCode::from(-32603),
            JsonRpcErrorCode::InternalError
        );
        assert_eq!(
            JsonRpcErrorCode::from(-32000),
            JsonRpcErrorCode::ServerError(-32000)
        );
        assert_eq!(
            JsonRpcErrorCode::from(-32100),
            JsonRpcErrorCode::Other(-32100)
        );
    }

    #[test]
    fn request_serializes_without_params() {
        let request = JsonRpcRequest {
            jsonrpc: JSONRPC_VERSION.to_string(),
            id: 1,
            method: "foo".to_string(),
            params: None,
        };
        let json = serde_json::to_string(&request).unwrap();
        assert_eq!(json, r#"{"jsonrpc":"2.0","id":1,"method":"foo"}"#);
    }

    #[test]
    fn notification_serializes_without_id() {
        let notification = JsonRpcNotification {
            jsonrpc: JSONRPC_VERSION.to_string(),
            method: "bar".to_string(),
            params: Some(Value::from("baz")),
        };
        let json = serde_json::to_string(&notification).unwrap();
        assert_eq!(json, r#"{"jsonrpc":"2.0","method":"bar","params":"baz"}"#);
    }

    #[tokio::test]
    async fn request_response_roundtrip() {
        let (client, _notifications, mut server_write, server_read) = setup().await;
        let method = "test/method";

        tokio::spawn(async move {
            let mut lines = BufReader::new(server_read).lines();
            let line = lines.next_line().await.unwrap().unwrap();
            let request: JsonRpcRequest = serde_json::from_str(&line).unwrap();
            assert_eq!(request.method, method);

            let response = JsonRpcResponse {
                jsonrpc: JSONRPC_VERSION.to_string(),
                id: request.id,
                body: JsonRpcResponseBody::Result(Value::from(42)),
            };
            let json = serde_json::to_string(&response).unwrap();
            server_write.write_all(json.as_bytes()).await.unwrap();
            server_write.write_all(b"\n").await.unwrap();
            server_write.flush().await.unwrap();
        });

        let result = client
            .request(method, None, RequestOptions::default())
            .await
            .unwrap();
        assert_eq!(result, Value::from(42));
    }

    #[tokio::test]
    async fn request_maps_json_rpc_error() {
        let (client, _notifications, mut server_write, server_read) = setup().await;

        tokio::spawn(async move {
            let mut lines = BufReader::new(server_read).lines();
            let line = lines.next_line().await.unwrap().unwrap();
            let request: JsonRpcRequest = serde_json::from_str(&line).unwrap();

            let response = JsonRpcResponse {
                jsonrpc: JSONRPC_VERSION.to_string(),
                id: request.id,
                body: JsonRpcResponseBody::Error(JsonRpcErrorObject {
                    code: -32601,
                    message: "Unknown method".to_string(),
                    data: None,
                }),
            };
            let json = serde_json::to_string(&response).unwrap();
            server_write.write_all(json.as_bytes()).await.unwrap();
            server_write.write_all(b"\n").await.unwrap();
            server_write.flush().await.unwrap();
        });

        let result = client
            .request("unknown", None, RequestOptions::default())
            .await;

        match result {
            Err(McpError::Rpc {
                code: JsonRpcErrorCode::MethodNotFound,
                message,
                ..
            }) => assert_eq!(message, "Unknown method"),
            other => panic!("expected MethodNotFound RPC error, got {other:?}"),
        }
    }

    #[tokio::test]
    async fn request_times_out() {
        let (client, _notifications, _server_write, server_read) = setup().await;

        tokio::spawn(async move {
            let mut lines = BufReader::new(server_read).lines();
            let _ = lines.next_line().await;
        });

        let result = client
            .request(
                "test",
                None,
                RequestOptions {
                    timeout_ms: Some(1),
                },
            )
            .await;

        assert!(matches!(result, Err(McpError::Timeout)));
    }

    #[tokio::test]
    async fn notification_received_without_response() {
        let (client, mut notifications, mut server_write, _server_read) = setup().await;

        let notification = JsonRpcNotification {
            jsonrpc: JSONRPC_VERSION.to_string(),
            method: "test/notify".to_string(),
            params: Some(Value::from("hello")),
        };
        let json = serde_json::to_string(&notification).unwrap();
        server_write.write_all(json.as_bytes()).await.unwrap();
        server_write.write_all(b"\n").await.unwrap();
        server_write.flush().await.unwrap();

        let received = notifications.recv().await.unwrap();
        assert_eq!(received.method, "test/notify");
        assert_eq!(received.params, Some(Value::from("hello")));

        drop(client);
    }

    #[tokio::test]
    async fn concurrent_requests_mapped_by_id() {
        let (client, _notifications, mut server_write, server_read) = setup().await;

        tokio::spawn(async move {
            let mut lines = BufReader::new(server_read).lines();
            let line1 = lines.next_line().await.unwrap().unwrap();
            let line2 = lines.next_line().await.unwrap().unwrap();
            let request1: JsonRpcRequest = serde_json::from_str(&line1).unwrap();
            let request2: JsonRpcRequest = serde_json::from_str(&line2).unwrap();

            let responses = vec![
                JsonRpcResponse {
                    jsonrpc: JSONRPC_VERSION.to_string(),
                    id: request2.id,
                    body: JsonRpcResponseBody::Result(Value::from(2)),
                },
                JsonRpcResponse {
                    jsonrpc: JSONRPC_VERSION.to_string(),
                    id: request1.id,
                    body: JsonRpcResponseBody::Result(Value::from(1)),
                },
            ];

            for response in responses {
                let json = serde_json::to_string(&response).unwrap();
                server_write.write_all(json.as_bytes()).await.unwrap();
                server_write.write_all(b"\n").await.unwrap();
            }
            server_write.flush().await.unwrap();
        });

        let first = client.request("a", None, RequestOptions::default());
        let second = client.request("b", None, RequestOptions::default());
        let (result1, result2) = tokio::join!(first, second);

        assert_eq!(result1.unwrap(), Value::from(1));
        assert_eq!(result2.unwrap(), Value::from(2));
    }
}
