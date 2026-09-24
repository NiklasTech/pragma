use crate::ai::cli::manager::enriched_path;
use crate::modules::dap::types::{DapAdapterConfig, DapTransport};
use crate::modules::lsp::manager::resolve_command;
use crate::platform::new_tokio_command;
use serde_json::Value;
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::atomic::AtomicU64;
use std::sync::Arc;
use tokio::io::{AsyncRead, AsyncWrite};
use tokio::process::Child;
use tokio::sync::{mpsc, oneshot, Mutex};

use super::error::{DapError, Result};
use super::protocol::DapEventMessage;
use super::transport::{connect_with_retry, spawn_reader, spawn_stderr_reader, spawn_writer};

pub(super) const DEFAULT_TIMEOUT_MS: u64 = 30_000;
pub(super) const MAX_CONCURRENT_REQUESTS: usize = 64;

pub(super) struct ClientInner {
    pub(super) next_seq: AtomicU64,
    pub(super) pending: Mutex<HashMap<u64, oneshot::Sender<Result<Value>>>>,
    pub(super) request_timeout_ms: u64,
    pub(super) outgoing_tx: mpsc::Sender<String>,
}

pub struct DapClient {
    pub(super) inner: Arc<ClientInner>,
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
        match config.transport {
            DapTransport::Stdio => Self::start_stdio(config).await,
            DapTransport::Tcp => Self::start_tcp(config).await,
        }
    }

    async fn start_stdio(
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

    /// Spawn a TCP adapter (e.g. CodeLLDB): pick a free local port, substitute
    /// the `{port}` placeholder in the args, then connect once the adapter
    /// listens. The DAP framing is identical to stdio.
    async fn start_tcp(
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

        let port = std::net::TcpListener::bind(("127.0.0.1", 0))
            .and_then(|listener| listener.local_addr())
            .map_err(DapError::Spawn)?
            .port();
        let args: Vec<String> = config
            .args
            .iter()
            .map(|arg| arg.replace("{port}", &port.to_string()))
            .collect();

        let path = enriched_path();
        let command = resolve_command(&config.command, &path);
        let mut cmd = new_tokio_command(&command);
        cmd.args(&args)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::piped())
            .env("PATH", &path);

        let mut child = cmd.spawn()?;
        let stderr = child.stderr.take().ok_or(DapError::MissingStdio)?;

        let stream = connect_with_retry(port).await.inspect_err(|_| {
            let _ = child.start_kill();
        })?;
        let (reader, writer) = stream.into_split();
        let (client, events) = Self::with_io(reader, writer, DEFAULT_TIMEOUT_MS).await?;
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
