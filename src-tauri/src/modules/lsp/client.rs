use crate::ai::cli::manager::enriched_path;
use crate::modules::lsp::manager::resolve_command;
use crate::modules::lsp::types::{
    InitializeParams, InitializeResult, InitializedParams, LspServerConfig,
};
use crate::platform::new_tokio_command;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::io::{AsyncBufReadExt, AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStderr};
use tokio::sync::{mpsc, oneshot, Mutex};

const JSONRPC_VERSION: &str = "2.0";
const DEFAULT_TIMEOUT_MS: u64 = 30_000;
const SHUTDOWN_TIMEOUT_MS: u64 = 2_000;
const MAX_CONCURRENT_REQUESTS: usize = 64;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct JsonRpcRequest {
    jsonrpc: String,
    id: u64,
    method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    params: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct JsonRpcResponse {
    jsonrpc: String,
    id: u64,
    #[serde(flatten)]
    body: JsonRpcResponseBody,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
enum JsonRpcResponseBody {
    Result(Value),
    Error(JsonRpcErrorObject),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct JsonRpcErrorObject {
    code: i64,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    data: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct JsonRpcNotification {
    jsonrpc: String,
    method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    params: Option<Value>,
}

#[derive(Debug, Clone)]
pub struct Notification {
    pub method: String,
    pub params: Option<Value>,
}

#[derive(Debug)]
pub enum LspError {
    Spawn(std::io::Error),
    MissingStdio,
    Serialization(String),
    ConnectionClosed,
    Timeout,
    TooManyConcurrentRequests,
    Rpc { code: i64, message: String },
    InvalidHeader,
    InvalidContentLength,
}

impl std::fmt::Display for LspError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            LspError::Spawn(err) => write!(f, "failed to spawn language server: {err}"),
            LspError::MissingStdio => write!(f, "missing stdio pipe"),
            LspError::Serialization(err) => write!(f, "serialization error: {err}"),
            LspError::ConnectionClosed => write!(f, "connection closed"),
            LspError::Timeout => write!(f, "request timed out"),
            LspError::TooManyConcurrentRequests => write!(f, "too many concurrent requests"),
            LspError::Rpc { code, message } => write!(f, "JSON-RPC error {code}: {message}"),
            LspError::InvalidHeader => write!(f, "invalid LSP message header"),
            LspError::InvalidContentLength => write!(f, "invalid Content-Length header"),
        }
    }
}

impl std::error::Error for LspError {}

impl From<std::io::Error> for LspError {
    fn from(err: std::io::Error) -> Self {
        LspError::Spawn(err)
    }
}

impl From<serde_json::Error> for LspError {
    fn from(err: serde_json::Error) -> Self {
        LspError::Serialization(err.to_string())
    }
}

impl From<LspError> for String {
    fn from(err: LspError) -> Self {
        err.to_string()
    }
}

pub type Result<T> = std::result::Result<T, LspError>;

struct ClientInner {
    next_id: AtomicU64,
    pending: Mutex<HashMap<u64, oneshot::Sender<Result<Value>>>>,
    request_timeout_ms: u64,
    outgoing_tx: mpsc::Sender<String>,
}

pub struct LspClient {
    inner: Arc<ClientInner>,
    #[allow(dead_code)]
    reader_handle: Option<tokio::task::JoinHandle<()>>,
    #[allow(dead_code)]
    writer_handle: Option<tokio::task::JoinHandle<()>>,
}

impl Clone for LspClient {
    fn clone(&self) -> Self {
        Self {
            inner: Arc::clone(&self.inner),
            reader_handle: None,
            writer_handle: None,
        }
    }
}

impl LspClient {
    pub async fn start(
        config: LspServerConfig,
    ) -> Result<(
        Self,
        Child,
        mpsc::UnboundedReceiver<Notification>,
        mpsc::UnboundedReceiver<String>,
    )> {
        if config.command.is_empty() {
            return Err(LspError::Serialization("command is required".to_string()));
        }

        let timeout = DEFAULT_TIMEOUT_MS;
        let path = enriched_path();
        let command = resolve_command(&config.command, &path);
        let mut cmd = new_tokio_command(&command);
        cmd.args(&config.args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .env("PATH", &path);

        let mut child = cmd.spawn()?;
        let stdin = child.stdin.take().ok_or(LspError::MissingStdio)?;
        let stdout = child.stdout.take().ok_or(LspError::MissingStdio)?;
        let stderr = child.stderr.take().ok_or(LspError::MissingStdio)?;

        let (client, notifications) = Self::with_io(stdout, stdin, timeout).await?;
        let stderr_lines = spawn_stderr_reader(stderr);

        Ok((client, child, notifications, stderr_lines))
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

        Ok((
            LspClient {
                inner,
                reader_handle: Some(reader_handle),
                writer_handle: Some(writer_handle),
            },
            notification_rx,
        ))
    }

    pub async fn initialize(&self, params: InitializeParams) -> Result<InitializeResult> {
        let value = self
            .request("initialize", Some(serde_json::to_value(params)?), None)
            .await?;
        serde_json::from_value(value).map_err(|e| LspError::Serialization(e.to_string()))
    }

    pub async fn initialized(&self) -> Result<()> {
        self.notify(
            "initialized",
            Some(serde_json::to_value(InitializedParams {})?),
        )
        .await
    }

    pub async fn shutdown(&self) -> Result<Value> {
        self.request("shutdown", None, Some(SHUTDOWN_TIMEOUT_MS))
            .await
    }

    pub async fn exit(&self) -> Result<()> {
        self.notify("exit", None).await
    }

    pub async fn request(
        &self,
        method: &str,
        params: Option<Value>,
        timeout_ms: Option<u64>,
    ) -> Result<Value> {
        if method.is_empty() {
            return Err(LspError::Serialization("method is required".to_string()));
        }

        let id = self.inner.next_id.fetch_add(1, Ordering::SeqCst);
        let (tx, rx) = oneshot::channel();

        {
            let mut pending = self.inner.pending.lock().await;
            if pending.len() >= MAX_CONCURRENT_REQUESTS {
                return Err(LspError::TooManyConcurrentRequests);
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
            .map_err(|_| LspError::ConnectionClosed)?;

        let timeout_ms = timeout_ms.unwrap_or(self.inner.request_timeout_ms);
        match tokio::time::timeout(Duration::from_millis(timeout_ms), rx).await {
            Ok(Ok(result)) => result,
            Ok(Err(_)) => Err(LspError::ConnectionClosed),
            Err(_) => {
                let mut pending = self.inner.pending.lock().await;
                pending.remove(&id);
                Err(LspError::Timeout)
            }
        }
    }

    pub async fn notify(&self, method: &str, params: Option<Value>) -> Result<()> {
        if method.is_empty() {
            return Err(LspError::Serialization("method is required".to_string()));
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
            .map_err(|_| LspError::ConnectionClosed)?;

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
    let header = format!("Content-Length: {}\r\n\r\n", message.len());
    writer.write_all(header.as_bytes()).await?;
    writer.write_all(message.as_bytes()).await?;
    writer.flush().await
}

fn spawn_stderr_reader(stderr: ChildStderr) -> mpsc::UnboundedReceiver<String> {
    let (tx, rx) = mpsc::unbounded_channel::<String>();

    tokio::spawn(async move {
        let mut lines = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            if tx.send(line).is_err() {
                break;
            }
        }
    });

    rx
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
        let mut reader = BufReader::new(reader);
        loop {
            match read_message(&mut reader).await {
                Ok(Some(message)) => {
                    process_incoming_message(&inner, &notification_tx, &message).await
                }
                Ok(None) => break,
                Err(_) => break,
            }
        }

        let mut pending = inner.pending.lock().await;
        for (_, sender) in pending.drain() {
            let _ = sender.send(Err(LspError::ConnectionClosed));
        }
    })
}

async fn read_message<R>(reader: &mut BufReader<R>) -> Result<Option<String>>
where
    R: AsyncRead + Unpin + Send,
{
    let mut content_length: Option<usize> = None;
    let mut header_line = String::new();

    loop {
        header_line.clear();
        let bytes_read = reader
            .read_line(&mut header_line)
            .await
            .map_err(LspError::Spawn)?;
        if bytes_read == 0 {
            return Ok(None);
        }

        let trimmed = header_line.trim();
        if trimmed.is_empty() {
            break;
        }

        if let Some(value) = trimmed.strip_prefix("Content-Length:") {
            let value = value.trim();
            content_length = Some(
                value
                    .parse::<usize>()
                    .map_err(|_| LspError::InvalidContentLength)?,
            );
        }
    }

    let length = content_length.ok_or(LspError::InvalidHeader)?;
    let mut body = vec![0u8; length];
    reader
        .read_exact(&mut body)
        .await
        .map_err(LspError::Spawn)?;

    String::from_utf8(body)
        .map(Some)
        .map_err(|e| LspError::Serialization(e.to_string()))
}

async fn process_incoming_message(
    inner: &ClientInner,
    notification_tx: &mpsc::UnboundedSender<Notification>,
    message: &str,
) {
    if let Ok(response) = serde_json::from_str::<JsonRpcResponse>(message) {
        let result = match response.body {
            JsonRpcResponseBody::Result(value) => Ok(value),
            JsonRpcResponseBody::Error(err) => Err(LspError::Rpc {
                code: err.code,
                message: err.message,
            }),
        };

        let mut pending = inner.pending.lock().await;
        if let Some(sender) = pending.remove(&response.id) {
            let _ = sender.send(result);
        }
        return;
    }

    if let Ok(notification) = serde_json::from_str::<JsonRpcNotification>(message) {
        let _ = notification_tx.send(Notification {
            method: notification.method,
            params: notification.params,
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use tokio::io::{duplex, AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};

    async fn read_frame<R>(reader: &mut BufReader<R>) -> serde_json::Value
    where
        R: AsyncRead + Unpin,
    {
        let mut content_length = 0usize;
        let mut line = String::new();
        loop {
            line.clear();
            reader.read_line(&mut line).await.unwrap();
            if line.trim().is_empty() {
                break;
            }
            if let Some(value) = line.trim().strip_prefix("Content-Length: ") {
                content_length = value.parse().unwrap();
            }
        }
        let mut body = vec![0u8; content_length];
        reader.read_exact(&mut body).await.unwrap();
        serde_json::from_slice(&body).unwrap()
    }

    async fn write_frame<W>(writer: &mut W, value: serde_json::Value)
    where
        W: AsyncWrite + Unpin,
    {
        let body = serde_json::to_string(&value).unwrap();
        let message = format!("Content-Length: {}\r\n\r\n{}", body.len(), body);
        writer.write_all(message.as_bytes()).await.unwrap();
        writer.flush().await.unwrap();
    }

    #[tokio::test]
    async fn shutdown_sends_request_then_exit_sends_notification() {
        let (client_end, server_end) = duplex(8192);
        let (client_reader, client_writer) = tokio::io::split(client_end);
        let (client, _notifications) = LspClient::with_io(client_reader, client_writer, 5_000)
            .await
            .unwrap();

        let server = tokio::spawn(async move {
            let (server_reader, mut server_writer) = tokio::io::split(server_end);
            let mut server_reader = BufReader::new(server_reader);

            let request = read_frame(&mut server_reader).await;
            assert_eq!(request["method"], json!("shutdown"));
            write_frame(
                &mut server_writer,
                json!({ "jsonrpc": "2.0", "id": request["id"], "result": null }),
            )
            .await;

            let notification = read_frame(&mut server_reader).await;
            assert_eq!(notification["method"], json!("exit"));
        });

        client.shutdown().await.unwrap();
        client.exit().await.unwrap();
        server.await.unwrap();
    }
}
