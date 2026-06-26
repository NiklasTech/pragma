use crate::modules::mcp::McpServerConfig;

use super::types::{McpEnvVar, McpServer};

pub fn configs_to_acp_servers(configs: Vec<McpServerConfig>) -> Vec<McpServer> {
    configs
        .into_iter()
        .map(|config| McpServer {
            name: config.name,
            type_: None, // Pragma MCP configs are implicitly stdio.
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
}
