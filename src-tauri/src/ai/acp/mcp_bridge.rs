use crate::modules::mcp::{McpServerConfig, McpTransport};

use super::types::{McpEnvVar, McpHeader, McpServer};

/// Maps resolved configs (secret env and header values filled in) to ACP servers.
pub fn configs_to_acp_servers(configs: Vec<McpServerConfig>) -> Vec<McpServer> {
    configs
        .into_iter()
        .map(|config| match config.transport {
            McpTransport::Stdio => McpServer {
                name: config.name,
                type_: None, // `None` means stdio per the ACP schema.
                command: Some(config.command),
                args: Some(config.args),
                url: None,
                headers: None,
                env: Some(
                    config
                        .env
                        .into_iter()
                        .map(|(name, value)| McpEnvVar { name, value })
                        .collect(),
                ),
            },
            McpTransport::Http => McpServer {
                name: config.name,
                type_: Some("http".to_string()),
                command: None,
                args: None,
                url: config.url,
                headers: Some(
                    config
                        .headers
                        .into_iter()
                        .map(|(name, value)| McpHeader { name, value })
                        .collect(),
                ),
                env: None,
            },
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[test]
    fn maps_stdio_config() {
        let mut env = HashMap::new();
        env.insert("KEY".to_string(), "value".to_string());

        let config = McpServerConfig {
            id: "server-1".to_string(),
            name: "Test Server".to_string(),
            command: "node".to_string(),
            args: vec!["index.js".to_string()],
            env,
            autostart: true,
            ..Default::default()
        };

        let servers = configs_to_acp_servers(vec![config]);
        assert_eq!(servers.len(), 1);

        let server = &servers[0];
        assert_eq!(server.name, "Test Server");
        assert!(server.type_.is_none());
        assert_eq!(server.command, Some("node".to_string()));
        assert_eq!(server.args, Some(vec!["index.js".to_string()]));
        assert!(server.url.is_none());
        assert!(server.headers.is_none());
        assert_eq!(
            server.env.as_ref().unwrap()[0],
            McpEnvVar {
                name: "KEY".to_string(),
                value: "value".to_string(),
            }
        );
    }

    #[test]
    fn maps_http_config_with_headers() {
        let mut headers = HashMap::new();
        headers.insert("Authorization".to_string(), "Bearer t".to_string());
        let config = McpServerConfig {
            id: "remote".to_string(),
            name: "Remote".to_string(),
            transport: McpTransport::Http,
            url: Some("https://mcp.example.com/mcp".to_string()),
            headers,
            ..Default::default()
        };

        let server = &configs_to_acp_servers(vec![config])[0];
        assert_eq!(server.type_.as_deref(), Some("http"));
        assert!(server.command.is_none());
        assert_eq!(server.url.as_deref(), Some("https://mcp.example.com/mcp"));
        assert_eq!(server.headers.as_ref().unwrap()[0].value, "Bearer t");
    }
}
