use std::collections::HashMap;
use std::process::Stdio;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;

use serde_json::Value;
use tokio::io::{AsyncBufReadExt, AsyncRead, AsyncWrite, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::{mpsc, oneshot, Mutex};
use tokio::time::timeout;

use super::error::{AcpError, Result};
use super::types::{JsonRpcErrorObject, JsonRpcRequest, JsonRpcResponse, JsonRpcResponseBody};

const JSONRPC_VERSION: &str = "2.0";
const DEFAULT_TIMEOUT_MS: u64 = 30_000;
const MAX_CONCURRENT_REQUESTS: usize = 64;

#[derive(Debug, Clone)]
pub struct AcpClientConfig {
    pub command: String,
    pub args: Vec<String>,
    pub env: std::collections::HashMap<String, String>,
    pub request_timeout_ms: Option<u64>,
}

#[derive(Debug, Clone, Default)]
pub struct RequestOptions {
    pub timeout_ms: Option<u64>,
}

#[derive(Debug, Clone)]
pub struct Notification {
    pub method: String,
    pub params: Option<Value>,
}

#[derive(Debug)]
pub struct ReverseRpcRequest {
    pub method: String,
    pub params: Option<Value>,
    pub response_tx: oneshot::Sender<Result<Value>>,
}

struct ClientInner {
    next_id: AtomicU64,
    pending: Mutex<HashMap<u64, oneshot::Sender<Result<Value>>>>,
    request_timeout_ms: u64,
    outgoing_tx: mpsc::Sender<String>,
}

pub struct AcpClient {
    inner: Arc<ClientInner>,
    _reader_handle: Option<tokio::task::JoinHandle<()>>,
    _writer_handle: Option<tokio::task::JoinHandle<()>>,
    // Held to keep the reverse-RPC channel open for the lifetime of the client.
    #[allow(dead_code)]
    reverse_rpc_tx: mpsc::Sender<ReverseRpcRequest>,
}

impl Clone for AcpClient {
    fn clone(&self) -> Self {
        Self {
            inner: Arc::clone(&self.inner),
            _reader_handle: None,
            _writer_handle: None,
            reverse_rpc_tx: self.reverse_rpc_tx.clone(),
        }
    }
}

impl AcpClient {
    pub async fn start(
        config: AcpClientConfig,
    ) -> Result<(Self, Child, mpsc::UnboundedReceiver<Notification>, mpsc::Receiver<ReverseRpcRequest>)>
    {
        if config.command.is_empty() {
            return Err(AcpError::Serialization("command is required".to_string()));
        }

        let request_timeout_ms = config.request_timeout_ms.unwrap_or(DEFAULT_TIMEOUT_MS);
        let mut cmd = Command::new(&config.command);
        cmd.args(&config.args)
            .envs(&config.env)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let mut child = cmd
            .spawn()
            .map_err(|e| AcpError::Spawn(format!("{e}")))?;

        let stdin = child.stdin.take().ok_or(AcpError::MissingStdio)?;
        let stdout = child.stdout.take().ok_or(AcpError::MissingStdio)?;

        let (client, notifications, reverse_requests) =
            Self::with_io(stdout, stdin, request_timeout_ms).await?;

        Ok((client, child, notifications, reverse_requests))
    }

    pub async fn with_io<R, W>(
        reader: R,
        writer: W,
        request_timeout_ms: u64,
    ) -> Result<(
        Self,
        mpsc::UnboundedReceiver<Notification>,
        mpsc::Receiver<ReverseRpcRequest>,
    )>
    where
        R: AsyncRead + Unpin + Send + 'static,
        W: AsyncWrite + Unpin + Send + 'static,
    {
        let (outgoing_tx, outgoing_rx) = mpsc::channel::<String>(MAX_CONCURRENT_REQUESTS);
        let (notification_tx, notification_rx) = mpsc::unbounded_channel::<Notification>();
        let (reverse_rpc_tx, reverse_rpc_rx) = mpsc::channel::<ReverseRpcRequest>(MAX_CONCURRENT_REQUESTS);

        let inner = Arc::new(ClientInner {
            next_id: AtomicU64::new(1),
            pending: Mutex::new(HashMap::with_capacity(MAX_CONCURRENT_REQUESTS)),
            request_timeout_ms,
            outgoing_tx,
        });

        let writer_handle = spawn_writer(writer, outgoing_rx);
        let reader_handle = spawn_reader(
            reader,
            Arc::clone(&inner),
            notification_tx,
            reverse_rpc_tx.clone(),
        );

        let client = AcpClient {
            inner,
            _reader_handle: Some(reader_handle),
            _writer_handle: Some(writer_handle),
            reverse_rpc_tx,
        };

        Ok((client, notification_rx, reverse_rpc_rx))
    }

    pub async fn request(
        &self,
        method: &str,
        params: Option<Value>,
        options: RequestOptions,
    ) -> Result<Value> {
        if method.is_empty() {
            return Err(AcpError::Serialization("method is required".to_string()));
        }

        let id = self.inner.next_id.fetch_add(1, Ordering::SeqCst);
        let (tx, rx) = oneshot::channel();

        {
            let mut pending = self.inner.pending.lock().await;
            if pending.len() >= MAX_CONCURRENT_REQUESTS {
                return Err(AcpError::TooManyConcurrentRequests);
            }
            pending.insert(id, tx);
        }

        let request = JsonRpcRequest {
            jsonrpc: JSONRPC_VERSION.to_string(),
            id: Some(Value::from(id)),
            method: method.to_string(),
            params,
        };
        let message = serde_json::to_string(&request)?;
        self.inner
            .outgoing_tx
            .send(message)
            .await
            .map_err(|_| AcpError::ConnectionClosed)?;

        let timeout_ms = options.timeout_ms.unwrap_or(self.inner.request_timeout_ms);
        match timeout(Duration::from_millis(timeout_ms), rx).await {
            Ok(Ok(result)) => result,
            Ok(Err(_)) => Err(AcpError::ConnectionClosed),
            Err(_) => {
                let mut pending = self.inner.pending.lock().await;
                pending.remove(&id);
                Err(AcpError::RequestTimeout)
            }
        }
    }

    pub async fn notify(&self, method: &str, params: Option<Value>) -> Result<()> {
        if method.is_empty() {
            return Err(AcpError::Serialization("method is required".to_string()));
        }

        let notification = JsonRpcRequest {
            jsonrpc: JSONRPC_VERSION.to_string(),
            id: None,
            method: method.to_string(),
            params,
        };
        let message = serde_json::to_string(&notification)?;
        self.inner
            .outgoing_tx
            .send(message)
            .await
            .map_err(|_| AcpError::ConnectionClosed)?;

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
            if writer
                .write_all(format!("{message}\n").as_bytes())
                .await
                .is_err()
            {
                break;
            }
            if writer.flush().await.is_err() {
                break;
            }
        }
    })
}

fn spawn_reader<R>(
    reader: R,
    inner: Arc<ClientInner>,
    notification_tx: mpsc::UnboundedSender<Notification>,
    reverse_rpc_tx: mpsc::Sender<ReverseRpcRequest>,
) -> tokio::task::JoinHandle<()>
where
    R: AsyncRead + Unpin + Send + 'static,
{
    tokio::spawn(async move {
        let mut lines = BufReader::new(reader).lines();

        while let Ok(Some(line)) = lines.next_line().await {
            if line.trim().is_empty() {
                continue;
            }

            let value: Value = match serde_json::from_str(&line) {
                Ok(v) => v,
                Err(e) => {
                    log::warn!("acp: failed to parse JSON-RPC line: {e}");
                    continue;
                }
            };

            // Incoming request (reverse-RPC) has method + id.
            if value.get("method").is_some() && value.get("id").is_some() {
                let id = value["id"].clone();
                let method = value["method"].as_str().unwrap_or("").to_string();
                let params = value.get("params").cloned();

                let (response_tx, response_rx) = oneshot::channel();
                let request = ReverseRpcRequest {
                    method,
                    params,
                    response_tx,
                };

                if reverse_rpc_tx.send(request).await.is_err() {
                    let _ = send_error_response(&inner, id, AcpError::ConnectionClosed).await;
                    continue;
                }

                let response = match timeout(
                    Duration::from_millis(inner.request_timeout_ms),
                    response_rx,
                )
                .await
                {
                    Ok(Ok(Ok(value))) => JsonRpcResponse {
                        jsonrpc: JSONRPC_VERSION.to_string(),
                        id: Some(id),
                        body: JsonRpcResponseBody::Result(value),
                    },
                    Ok(Ok(Err(err))) => JsonRpcResponse {
                        jsonrpc: JSONRPC_VERSION.to_string(),
                        id: Some(id),
                        body: JsonRpcResponseBody::Error(JsonRpcErrorObject {
                            code: -32000,
                            message: err.to_string(),
                            data: None,
                        }),
                    },
                    _ => JsonRpcResponse {
                        jsonrpc: JSONRPC_VERSION.to_string(),
                        id: Some(id),
                        body: JsonRpcResponseBody::Error(JsonRpcErrorObject {
                            code: -32000,
                            message: "Reverse-RPC handler timeout".to_string(),
                            data: None,
                        }),
                    },
                };

                let message = match serde_json::to_string(&response) {
                    Ok(m) => m,
                    Err(e) => {
                        log::warn!("acp: failed to serialize reverse-RPC response: {e}");
                        continue;
                    }
                };

                let _ = inner.outgoing_tx.send(message).await;
                continue;
            }

            // Response has id + result/error.
            if value.get("id").is_some()
                && (value.get("result").is_some() || value.get("error").is_some())
            {
                let response: JsonRpcResponse = match serde_json::from_value(value) {
                    Ok(r) => r,
                    Err(e) => {
                        log::warn!("acp: failed to parse JSON-RPC response: {e}");
                        continue;
                    }
                };

                let id = match response.id.as_ref().and_then(|v| v.as_u64()) {
                    Some(id) => id,
                    None => {
                        log::warn!("acp: response with non-numeric id");
                        continue;
                    }
                };

                let sender = {
                    let mut pending = inner.pending.lock().await;
                    pending.remove(&id)
                };

                if let Some(sender) = sender {
                    let result = match response.body {
                        JsonRpcResponseBody::Result(value) => Ok(value),
                        JsonRpcResponseBody::Error(err) => Err(AcpError::JsonRpc {
                            code: err.code,
                            message: err.message,
                        }),
                    };
                    let _ = sender.send(result);
                }
                continue;
            }

            // Notification has method but no id.
            if value.get("method").is_some() {
                let notification: JsonRpcRequest = match serde_json::from_value(value) {
                    Ok(n) => n,
                    Err(e) => {
                        log::warn!("acp: failed to parse JSON-RPC notification: {e}");
                        continue;
                    }
                };

                let _ = notification_tx.send(Notification {
                    method: notification.method,
                    params: notification.params,
                });
                continue;
            }

            log::warn!("acp: unrecognized JSON-RPC message");
        }
    })
}

async fn send_error_response(inner: &ClientInner, id: Value, error: AcpError) -> Result<()> {
    let response = JsonRpcResponse {
        jsonrpc: JSONRPC_VERSION.to_string(),
        id: Some(id),
        body: JsonRpcResponseBody::Error(JsonRpcErrorObject {
            code: -32000,
            message: error.to_string(),
            data: None,
        }),
    };
    let message = serde_json::to_string(&response)?;
    inner
        .outgoing_tx
        .send(message)
        .await
        .map_err(|_| AcpError::ConnectionClosed)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn request_response_roundtrip() {
        let (client_read, mut server_write) = tokio::io::duplex(1024);
        let (mut server_read, client_write) = tokio::io::duplex(1024);

        let (client, _notifications, _reverse_requests) =
            AcpClient::with_io(client_read, client_write, 1000)
                .await
                .unwrap();

        let request_task = tokio::spawn(async move {
            client
                .request("initialize", Some(Value::String("params".to_string())), Default::default())
                .await
        });

        let server_task = tokio::spawn(async move {
            let mut line = String::new();
            let mut buf = BufReader::new(&mut server_read);
            buf.read_line(&mut line).await.unwrap();
            let req: JsonRpcRequest = serde_json::from_str(&line).unwrap();
            let id = req.id.unwrap().as_u64().unwrap();

            let response = JsonRpcResponse {
                jsonrpc: JSONRPC_VERSION.to_string(),
                id: Some(Value::from(id)),
                body: JsonRpcResponseBody::Result(Value::String("ok".to_string())),
            };
            server_write
                .write_all(format!("{}\n", serde_json::to_string(&response).unwrap()).as_bytes())
                .await
                .unwrap();
            server_write.flush().await.unwrap();
        });

        let (result, _) = tokio::join!(request_task, server_task);
        let value = result.unwrap().unwrap();
        assert_eq!(value, Value::String("ok".to_string()));
    }

    #[tokio::test]
    async fn reverse_rpc_request_received() {
        let (client_read, mut server_write) = tokio::io::duplex(1024);
        let (mut server_read, client_write) = tokio::io::duplex(1024);

        let (_client, _notifications, mut reverse_requests) =
            AcpClient::with_io(client_read, client_write, 1000)
                .await
                .unwrap();

        let request = JsonRpcRequest {
            jsonrpc: JSONRPC_VERSION.to_string(),
            id: Some(Value::from(42u64)),
            method: "fs/read_text_file".to_string(),
            params: Some(Value::Object(serde_json::Map::new())),
        };
        server_write
            .write_all(format!("{}\n", serde_json::to_string(&request).unwrap()).as_bytes())
            .await
            .unwrap();
        server_write.flush().await.unwrap();

        let received = reverse_requests.recv().await.unwrap();
        assert_eq!(received.method, "fs/read_text_file");

        let _ = received.response_tx.send(Ok(Value::String("content".to_string())));

        let mut line = String::new();
        let mut buf = BufReader::new(&mut server_read);
        buf.read_line(&mut line).await.unwrap();
        let response: JsonRpcResponse = serde_json::from_str(&line).unwrap();
        assert_eq!(response.id, Some(Value::from(42u64)));
        match response.body {
            JsonRpcResponseBody::Result(v) => {
                assert_eq!(v, Value::String("content".to_string()));
            }
            _ => panic!("expected result"),
        }
    }
}
