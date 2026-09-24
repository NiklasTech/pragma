use super::connection::ClientInner;
use super::error::DapError;
use super::framing::{read_message, write_message};
use super::protocol::{DapEventMessage, DapResponse, DapReverseRequest, DapReverseResponse};
use serde_json::Value;
use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::time::Duration;
use tokio::io::{AsyncBufReadExt, AsyncRead, AsyncWrite, BufReader};
use tokio::process::ChildStderr;
use tokio::sync::mpsc;

const TCP_CONNECT_TIMEOUT: Duration = Duration::from_secs(5);
const TCP_CONNECT_RETRY: Duration = Duration::from_millis(100);

pub(super) async fn connect_with_retry(
    port: u16,
) -> std::result::Result<tokio::net::TcpStream, DapError> {
    let deadline = std::time::Instant::now() + TCP_CONNECT_TIMEOUT;
    loop {
        match tokio::net::TcpStream::connect(("127.0.0.1", port)).await {
            Ok(stream) => return Ok(stream),
            Err(err) => {
                if std::time::Instant::now() >= deadline {
                    return Err(DapError::Spawn(err));
                }
                tokio::time::sleep(TCP_CONNECT_RETRY).await;
            }
        }
    }
}

pub(super) fn spawn_writer<W>(
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

pub(super) fn spawn_stderr_reader(stderr: ChildStderr) -> mpsc::UnboundedReceiver<String> {
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

pub(super) fn spawn_reader<R>(
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
