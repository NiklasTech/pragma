//! Java debugging: java-debug runs as a jdtls bundle. Pragma starts a
//! dedicated jdtls, asks it to open a debug session and connects DAP to the
//! port it answers with.

use crate::modules::dap::types::{DapAdapterConfig, DapTransport};
use crate::modules::lsp::client::LspClient;
use crate::modules::lsp::types::LspServerConfig;
use crate::modules::lsp::uris::path_to_uri;
use serde_json::{json, Value};
use std::time::{Duration, Instant};
use tokio::process::Child;
use tokio::sync::mpsc;

use super::connection::{DapClient, DEFAULT_TIMEOUT_MS};
use super::error::{DapError, Result};
use super::protocol::DapEventMessage;
use super::transport::connect_with_retry;

const INITIALIZE_TIMEOUT_MS: u64 = 120_000;
// jdtls loads bundles after `initialized`, so the command is unknown for a while.
const START_SESSION_TIMEOUT: Duration = Duration::from_secs(90);
const START_SESSION_RETRY: Duration = Duration::from_millis(500);
const START_SESSION_COMMAND: &str = "vscode.java.startDebugSession";

fn lsp_error(err: impl std::fmt::Display) -> DapError {
    DapError::RequestFailed(format!("jdtls: {err}"))
}

/// The DAP port from the `startDebugSession` result (a number, sometimes a string).
pub(super) fn parse_port(value: &Value) -> Option<u16> {
    match value {
        Value::Number(number) => number.as_u64().and_then(|port| u16::try_from(port).ok()),
        Value::String(text) => text.trim().parse().ok(),
        _ => None,
    }
    .filter(|port| *port > 0)
}

async fn request_debug_port(lsp: &LspClient) -> Result<u16> {
    let deadline = Instant::now() + START_SESSION_TIMEOUT;
    loop {
        let result = lsp
            .request(
                "workspace/executeCommand",
                Some(json!({ "command": START_SESSION_COMMAND, "arguments": [] })),
                None,
            )
            .await;
        match result {
            Ok(value) => {
                return parse_port(&value).ok_or_else(|| {
                    DapError::RequestFailed(format!(
                        "jdtls returned no debug port for {START_SESSION_COMMAND}: {value}"
                    ))
                })
            }
            Err(err) if Instant::now() >= deadline => return Err(lsp_error(err)),
            Err(_) => tokio::time::sleep(START_SESSION_RETRY).await,
        }
    }
}

async fn open_session(lsp: &LspClient, bundle: &str, root: &str) -> Result<u16> {
    lsp.request(
        "initialize",
        Some(json!({
            "processId": std::process::id(),
            "rootPath": root,
            "rootUri": path_to_uri(root),
            "capabilities": {},
            "initializationOptions": { "bundles": [bundle] },
        })),
        Some(INITIALIZE_TIMEOUT_MS),
    )
    .await
    .map_err(lsp_error)?;
    lsp.notify("initialized", Some(json!({})))
        .await
        .map_err(lsp_error)?;
    request_debug_port(lsp).await
}

pub(super) async fn start(
    config: DapAdapterConfig,
) -> Result<(
    DapClient,
    Child,
    mpsc::UnboundedReceiver<DapEventMessage>,
    mpsc::UnboundedReceiver<String>,
)> {
    let DapTransport::Jdtls { bundle, root } = &config.transport else {
        return Err(DapError::Serialization(
            "the jdtls transport needs a bundle".to_string(),
        ));
    };

    let (lsp, mut child, _notifications, stderr_lines) = LspClient::start(LspServerConfig {
        command: config.command.clone(),
        args: config.args.clone(),
        install_program: None,
        install_args: Vec::new(),
    })
    .await
    .map_err(lsp_error)?;

    let session = async {
        let port = open_session(&lsp, bundle, root).await?;
        connect_with_retry(port).await
    }
    .await;
    let stream = match session {
        Ok(stream) => stream,
        Err(err) => {
            let _ = child.start_kill();
            return Err(err);
        }
    };

    // The LSP reader and writer tasks keep jdtls' stdio open for the session.
    let (reader, writer) = stream.into_split();
    let (client, events) = DapClient::with_io(reader, writer, DEFAULT_TIMEOUT_MS).await?;
    Ok((client, child, events, stderr_lines))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn port_accepts_numbers_and_numeric_strings() {
        assert_eq!(parse_port(&json!(51234)), Some(51234));
        assert_eq!(parse_port(&json!("40000")), Some(40000));
    }

    #[test]
    fn port_rejects_invalid_values() {
        assert_eq!(parse_port(&json!(0)), None);
        assert_eq!(parse_port(&json!(70000)), None);
        assert_eq!(parse_port(&json!(null)), None);
        assert_eq!(parse_port(&json!("abc")), None);
    }
}
