use crate::ai::cli::manager::enriched_path;
use crate::modules::dap::types::DapAdapterConfig;
use crate::modules::lsp::manager::resolve_command;
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

const DEFAULT_TIMEOUT_MS: u64 = 30_000;
const MAX_CONCURRENT_REQUESTS: usize = 64;

#[derive(Debug, Clone, Serialize)]
struct DapRequest {
    seq: u64,
    #[serde(rename = "type")]
    msg_type: &'static str,
    command: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    arguments: Option<Value>,
}

#[derive(Debug, Clone, Deserialize)]
struct DapResponse {
    request_seq: u64,
    success: bool,
    #[serde(default)]
    message: Option<String>,
    #[serde(default)]
    body: Option<Value>,
}

#[derive(Debug, Clone, Deserialize)]
struct DapReverseRequest {
    seq: u64,
    command: String,
}

#[derive(Debug, Clone, Serialize)]
struct DapReverseResponse {
    seq: u64,
    #[serde(rename = "type")]
    msg_type: &'static str,
    request_seq: u64,
    success: bool,
    command: String,
    message: String,
}

#[derive(Debug, Clone)]
pub struct DapEventMessage {
    pub event: String,
    pub body: Option<Value>,
}

#[derive(Debug)]
pub enum DapError {
    Spawn(std::io::Error),
    MissingStdio,
    Serialization(String),
    ConnectionClosed,
    Timeout,
    TooManyConcurrentRequests,
    RequestFailed(String),
    InvalidHeader,
    InvalidContentLength,
}

impl std::fmt::Display for DapError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DapError::Spawn(err) => write!(f, "failed to spawn debug adapter: {err}"),
            DapError::MissingStdio => write!(f, "missing stdio pipe"),
            DapError::Serialization(err) => write!(f, "serialization error: {err}"),
            DapError::ConnectionClosed => write!(f, "connection closed"),
            DapError::Timeout => write!(f, "request timed out"),
            DapError::TooManyConcurrentRequests => write!(f, "too many concurrent requests"),
            DapError::RequestFailed(message) => {
                write!(f, "debug adapter request failed: {message}")
            }
            DapError::InvalidHeader => write!(f, "invalid DAP message header"),
            DapError::InvalidContentLength => write!(f, "invalid Content-Length header"),
        }
    }
}

impl std::error::Error for DapError {}

impl From<std::io::Error> for DapError {
    fn from(err: std::io::Error) -> Self {
        DapError::Spawn(err)
    }
}

impl From<serde_json::Error> for DapError {
    fn from(err: serde_json::Error) -> Self {
        DapError::Serialization(err.to_string())
    }
}

impl From<DapError> for String {
    fn from(err: DapError) -> Self {
        err.to_string()
    }
}

pub type Result<T> = std::result::Result<T, DapError>;

struct ClientInner {
    next_seq: AtomicU64,
    pending: Mutex<HashMap<u64, oneshot::Sender<Result<Value>>>>,
    request_timeout_ms: u64,
    outgoing_tx: mpsc::Sender<String>,
}

pub struct DapClient {
    inner: Arc<ClientInner>,
    #[allow(dead_code)]
    reader_handle: Option<tokio::task::JoinHandle<()>>,
    #[allow(dead_code)]
    writer_handle: Option<tokio::task::JoinHandle<()>>,
}

impl Clone for DapClient {
    fn clone(&self) -> Self {
        Self {
            inner: Arc::clone(&self.inner),
            reader_handle: None,
            writer_handle: None,
        }
    }
}

impl DapClient {
    pub async fn start(
        config: DapAdapterConfig,
    ) -> Result<(
        Self,
        Child,
        mpsc::UnboundedReceiver<DapEventMessage>,
        mpsc::UnboundedReceiver<String>,
    )> {
        if config.command.is_empty() {
            return Err(DapError::Serialization("command is required".to_string()));
        }

        let path = enriched_path();
        let command = resolve_command(&config.command, &path);
        let mut cmd = new_tokio_command(&command);
        cmd.args(&config.args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .env("PATH", &path);

        let mut child = cmd.spawn()?;
        let stdin = child.stdin.take().ok_or(DapError::MissingStdio)?;
        let stdout = child.stdout.take().ok_or(DapError::MissingStdio)?;
        let stderr = child.stderr.take().ok_or(DapError::MissingStdio)?;

        let (client, events) = Self::with_io(stdout, stdin, DEFAULT_TIMEOUT_MS).await?;
        let stderr_lines = spawn_stderr_reader(stderr);

        Ok((client, child, events, stderr_lines))
    }

    async fn with_io<R, W>(
        reader: R,
        writer: W,
        request_timeout_ms: u64,
    ) -> Result<(Self, mpsc::UnboundedReceiver<DapEventMessage>)>
    where
        R: AsyncRead + Unpin + Send + 'static,
        W: AsyncWrite + Unpin + Send + 'static,
    {
        let (outgoing_tx, outgoing_rx) = mpsc::channel::<String>(MAX_CONCURRENT_REQUESTS);
        let (event_tx, event_rx) = mpsc::unbounded_channel::<DapEventMessage>();

        let inner = Arc::new(ClientInner {
            next_seq: AtomicU64::new(1),
            pending: Mutex::new(HashMap::with_capacity(MAX_CONCURRENT_REQUESTS)),
            request_timeout_ms,
            outgoing_tx,
        });

        let writer_handle = spawn_writer(writer, outgoing_rx);
        let reader_handle = spawn_reader(reader, Arc::clone(&inner), event_tx);

        Ok((
            DapClient {
                inner,
                reader_handle: Some(reader_handle),
                writer_handle: Some(writer_handle),
            },
            event_rx,
        ))
    }

    pub async fn request(
        &self,
        command: &str,
        arguments: Option<Value>,
        timeout_ms: Option<u64>,
    ) -> Result<Value> {
        if command.is_empty() {
            return Err(DapError::Serialization("command is required".to_string()));
        }

        let seq = self.inner.next_seq.fetch_add(1, Ordering::SeqCst);
        let (tx, rx) = oneshot::channel();

        {
            let mut pending = self.inner.pending.lock().await;
            if pending.len() >= MAX_CONCURRENT_REQUESTS {
                return Err(DapError::TooManyConcurrentRequests);
            }
            pending.insert(seq, tx);
        }

        let request = DapRequest {
            seq,
            msg_type: "request",
            command: command.to_string(),
            arguments,
        };
        let message = serde_json::to_string(&request)?;
        self.inner
            .outgoing_tx
            .send(message)
            .await
            .map_err(|_| DapError::ConnectionClosed)?;

        let timeout_ms = timeout_ms.unwrap_or(self.inner.request_timeout_ms);
        match tokio::time::timeout(Duration::from_millis(timeout_ms), rx).await {
            Ok(Ok(result)) => result,
            Ok(Err(_)) => Err(DapError::ConnectionClosed),
            Err(_) => {
                let mut pending = self.inner.pending.lock().await;
                pending.remove(&seq);
                Err(DapError::Timeout)
            }
        }
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
    event_tx: mpsc::UnboundedSender<DapEventMessage>,
) -> tokio::task::JoinHandle<()>
where
    R: AsyncRead + Unpin + Send + 'static,
{
    tokio::spawn(async move {
        let mut reader = BufReader::new(reader);
        loop {
            match read_message(&mut reader).await {
                Ok(Some(message)) => process_incoming_message(&inner, &event_tx, &message).await,
                Ok(None) => break,
                Err(_) => break,
            }
        }

        let mut pending = inner.pending.lock().await;
        for (_, sender) in pending.drain() {
            let _ = sender.send(Err(DapError::ConnectionClosed));
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
            .map_err(DapError::Spawn)?;
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
                    .map_err(|_| DapError::InvalidContentLength)?,
            );
        }
    }

    let length = content_length.ok_or(DapError::InvalidHeader)?;
    let mut body = vec![0u8; length];
    reader
        .read_exact(&mut body)
        .await
        .map_err(DapError::Spawn)?;

    String::from_utf8(body)
        .map(Some)
        .map_err(|e| DapError::Serialization(e.to_string()))
}

async fn process_incoming_message(
    inner: &ClientInner,
    event_tx: &mpsc::UnboundedSender<DapEventMessage>,
    message: &str,
) {
    let envelope: Value = match serde_json::from_str(message) {
        Ok(value) => value,
        Err(_) => return,
    };

    match envelope.get("type").and_then(Value::as_str) {
        Some("response") => {
            if let Ok(response) = serde_json::from_value::<DapResponse>(envelope) {
                let result = if response.success {
                    Ok(response.body.unwrap_or(Value::Null))
                } else {
                    Err(DapError::RequestFailed(
                        response
                            .message
                            .unwrap_or_else(|| "unknown error".to_string()),
                    ))
                };

                let mut pending = inner.pending.lock().await;
                if let Some(sender) = pending.remove(&response.request_seq) {
                    let _ = sender.send(result);
                }
            }
        }
        Some("event") => {
            let event = envelope
                .get("event")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string();
            if event.is_empty() {
                return;
            }
            let _ = event_tx.send(DapEventMessage {
                event,
                body: envelope.get("body").cloned(),
            });
        }
        Some("request") => {
            // Adapters may send reverse requests (e.g. `runInTerminal`). We
            // launch debuggees with `internalConsole`, so these are answered
            // with a minimal error response instead of being handled.
            if let Ok(request) = serde_json::from_value::<DapReverseRequest>(envelope) {
                let seq = inner.next_seq.fetch_add(1, Ordering::SeqCst);
                let response = DapReverseResponse {
                    seq,
                    msg_type: "response",
                    request_seq: request.seq,
                    success: false,
                    message: format!("reverse request '{}' is not supported", request.command),
                    command: request.command,
                };
                if let Ok(message) = serde_json::to_string(&response) {
                    let _ = inner.outgoing_tx.try_send(message);
                }
            }
        }
        _ => {}
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
    async fn request_resolves_with_response_body() {
        let (client_end, server_end) = duplex(8192);
        let (client_reader, client_writer) = tokio::io::split(client_end);
        let (client, _events) = DapClient::with_io(client_reader, client_writer, 5_000)
            .await
            .unwrap();

        let server = tokio::spawn(async move {
            let (server_reader, mut server_writer) = tokio::io::split(server_end);
            let mut server_reader = BufReader::new(server_reader);

            let request = read_frame(&mut server_reader).await;
            assert_eq!(request["type"], json!("request"));
            assert_eq!(request["command"], json!("initialize"));
            write_frame(
                &mut server_writer,
                json!({
                    "seq": 1,
                    "type": "response",
                    "request_seq": request["seq"],
                    "success": true,
                    "command": "initialize",
                    "body": { "supportsConfigurationDoneRequest": true }
                }),
            )
            .await;
        });

        let body = client
            .request("initialize", Some(json!({ "adapterID": "pwa-node" })), None)
            .await
            .unwrap();
        assert_eq!(body["supportsConfigurationDoneRequest"], json!(true));
        server.await.unwrap();
    }

    #[tokio::test]
    async fn failed_response_becomes_request_failed_error() {
        let (client_end, server_end) = duplex(8192);
        let (client_reader, client_writer) = tokio::io::split(client_end);
        let (client, _events) = DapClient::with_io(client_reader, client_writer, 5_000)
            .await
            .unwrap();

        let server = tokio::spawn(async move {
            let (server_reader, mut server_writer) = tokio::io::split(server_end);
            let mut server_reader = BufReader::new(server_reader);

            let request = read_frame(&mut server_reader).await;
            write_frame(
                &mut server_writer,
                json!({
                    "seq": 1,
                    "type": "response",
                    "request_seq": request["seq"],
                    "success": false,
                    "command": "launch",
                    "message": "unable to launch"
                }),
            )
            .await;
        });

        let err = client.request("launch", None, None).await.unwrap_err();
        assert!(matches!(err, DapError::RequestFailed(_)));
        assert!(err.to_string().contains("unable to launch"));
        server.await.unwrap();
    }

    #[tokio::test]
    async fn events_are_forwarded_to_channel() {
        let (client_end, server_end) = duplex(8192);
        let (client_reader, client_writer) = tokio::io::split(client_end);
        let (client, mut events) = DapClient::with_io(client_reader, client_writer, 5_000)
            .await
            .unwrap();

        let server = tokio::spawn(async move {
            let (_server_reader, mut server_writer) = tokio::io::split(server_end);
            write_frame(
                &mut server_writer,
                json!({
                    "seq": 1,
                    "type": "event",
                    "event": "stopped",
                    "body": { "reason": "breakpoint", "threadId": 7 }
                }),
            )
            .await;
        });

        let event = events.recv().await.unwrap();
        assert_eq!(event.event, "stopped");
        assert_eq!(event.body.unwrap()["threadId"], json!(7));
        drop(client);
        server.await.unwrap();
    }

    #[tokio::test]
    async fn reverse_requests_get_an_error_response() {
        let (client_end, server_end) = duplex(8192);
        let (client_reader, client_writer) = tokio::io::split(client_end);
        let (_client, _events) = DapClient::with_io(client_reader, client_writer, 5_000)
            .await
            .unwrap();

        let (server_reader, mut server_writer) = tokio::io::split(server_end);
        let mut server_reader = BufReader::new(server_reader);

        write_frame(
            &mut server_writer,
            json!({
                "seq": 9,
                "type": "request",
                "command": "runInTerminal",
                "arguments": { "kind": "integrated", "title": "debug", "cwd": "/", "args": [] }
            }),
        )
        .await;

        let response = read_frame(&mut server_reader).await;
        assert_eq!(response["type"], json!("response"));
        assert_eq!(response["request_seq"], json!(9));
        assert_eq!(response["success"], json!(false));
        assert_eq!(response["command"], json!("runInTerminal"));
    }
}
