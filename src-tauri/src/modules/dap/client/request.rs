use serde_json::Value;
use std::sync::atomic::Ordering;
use std::time::Duration;
use tokio::sync::oneshot;

use super::connection::{DapClient, MAX_CONCURRENT_REQUESTS};
use super::error::{DapError, Result};
use super::protocol::DapRequest;

impl DapClient {
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
