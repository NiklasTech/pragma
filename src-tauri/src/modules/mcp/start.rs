//! Opens the transport for one configured server and runs the handshake.

use crate::modules::mcp::client::{McpClient, McpClientConfig, Notification};
use crate::modules::mcp::connection::{initialize, McpConnection, McpServerCapabilities};
use crate::modules::mcp::error::{McpError, Result};
use crate::modules::mcp::http::{McpHttpClient, McpHttpConfig};
use crate::modules::mcp::{oauth, secrets, McpServerConfig, McpTransport};
use tokio::process::Child;
use tokio::sync::mpsc;
use tokio::task::JoinHandle;

pub(super) struct Connected {
    pub(super) connection: McpConnection,
    pub(super) capabilities: McpServerCapabilities,
    pub(super) child: Option<Child>,
    pub(super) notifications: mpsc::UnboundedReceiver<Notification>,
    pub(super) stderr: Option<mpsc::UnboundedReceiver<String>>,
    pub(super) event_stream: Option<JoinHandle<()>>,
}

async fn connect_stdio(config: &McpServerConfig) -> Result<Connected> {
    if config.command.trim().is_empty() {
        return Err(McpError::Config(format!(
            "MCP server {} has no command",
            config.name
        )));
    }
    let (client, mut child, notifications, stderr) = McpClient::start(McpClientConfig {
        command: config.command.clone(),
        args: config.args.clone(),
        env: secrets::resolve_env(config)?,
        request_timeout_ms: None,
    })
    .await?;
    let connection = McpConnection::Stdio(client);
    let capabilities = match initialize(&connection).await {
        Ok(capabilities) => capabilities,
        Err(err) => {
            let _ = child.start_kill();
            return Err(err);
        }
    };
    Ok(Connected {
        connection,
        capabilities,
        child: Some(child),
        notifications,
        stderr: Some(stderr),
        event_stream: None,
    })
}

async fn open_http(
    config: &McpServerConfig,
    url: &str,
    bearer_token: Option<String>,
) -> Result<(
    McpConnection,
    McpServerCapabilities,
    mpsc::UnboundedReceiver<Notification>,
)> {
    let (client, notifications) = McpHttpClient::new(McpHttpConfig {
        url: url.to_string(),
        headers: secrets::resolve_headers(config)?,
        bearer_token,
        request_timeout_ms: None,
    })?;
    let connection = McpConnection::Http(client);
    let capabilities = initialize(&connection).await?;
    Ok((connection, capabilities, notifications))
}

async fn connect_http(config: &McpServerConfig) -> Result<Connected> {
    let url = config
        .url
        .as_deref()
        .filter(|url| !url.trim().is_empty())
        .ok_or_else(|| McpError::Config(format!("MCP server {} has no URL", config.name)))?;

    let token = oauth::access_token(&config.id).await.unwrap_or(None);
    let had_token = token.is_some();
    let opened = match open_http(config, url, token).await {
        // An expired or revoked token gets one refresh before the user must sign in again.
        Err(McpError::AuthRequired(challenge)) if had_token => {
            match oauth::refresh(&config.id).await {
                Ok(Some(token)) => open_http(config, url, Some(token)).await,
                _ => Err(McpError::AuthRequired(challenge)),
            }
        }
        other => other,
    };
    let (connection, capabilities, notifications) = opened?;
    let event_stream = match &connection {
        McpConnection::Http(client) => Some(client.spawn_event_stream()),
        McpConnection::Stdio(_) => None,
    };
    Ok(Connected {
        connection,
        capabilities,
        child: None,
        notifications,
        stderr: None,
        event_stream,
    })
}

pub(super) async fn connect(config: &McpServerConfig) -> Result<Connected> {
    match config.transport {
        McpTransport::Stdio => connect_stdio(config).await,
        McpTransport::Http => connect_http(config).await,
    }
}
