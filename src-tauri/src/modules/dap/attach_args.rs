//! `attach` arguments for adapters that connect to an already running process.

use super::launch_args::jdwp_port;
use serde_json::{json, Value};

const DEFAULT_HOST: &str = "localhost";
const DEFAULT_NODE_PORT: u16 = 9229;
const DEFAULT_DEBUGPY_PORT: u16 = 5678;
const DEFAULT_JDWP_PORT: u16 = 5005;
const JAVA_ATTACH_TIMEOUT_MS: u64 = 30_000;
const MAX_HOST_LEN: usize = 253;

/// Where an attach request connects: host and port for node, debugpy and
/// java-debug, a process id for CodeLLDB.
#[derive(Debug, Clone, Default)]
pub struct AttachTarget {
    pub host: Option<String>,
    pub port: Option<u16>,
    pub process_id: Option<u32>,
}

pub(super) fn validate_attach_target(target: &AttachTarget) -> Result<(), String> {
    if let Some(host) = target.host.as_deref() {
        let valid_chars = host
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_' | ':' | '[' | ']'));
        if host.is_empty() || host.len() > MAX_HOST_LEN || !valid_chars {
            return Err(format!("Invalid debug host '{host}'"));
        }
    }
    if target.port == Some(0) {
        return Err("Debug port must be between 1 and 65535".to_string());
    }
    if target.process_id == Some(0) {
        return Err("Process id must be greater than 0".to_string());
    }
    Ok(())
}

pub(super) fn build_attach_arguments(
    adapter_id: &str,
    name: &str,
    args: &[String],
    cwd: &str,
    target: &AttachTarget,
) -> Result<Value, String> {
    let host = target.host.as_deref().unwrap_or(DEFAULT_HOST);
    match adapter_id {
        "node" => Ok(json!({
            "type": "pwa-node",
            "request": "attach",
            "name": name,
            "address": host,
            "port": target.port.unwrap_or(DEFAULT_NODE_PORT),
            "cwd": cwd,
        })),
        "python" => Ok(json!({
            "request": "attach",
            "name": name,
            "connect": { "host": host, "port": target.port.unwrap_or(DEFAULT_DEBUGPY_PORT) },
            "justMyCode": true,
        })),
        "lldb" => {
            let pid = target
                .process_id
                .ok_or("Attaching with lldb requires a process id")?;
            Ok(json!({
                "type": "lldb",
                "request": "attach",
                "name": name,
                "pid": pid,
                "stopOnEntry": false,
            }))
        }
        "java" => Ok(json!({
            "type": "java",
            "request": "attach",
            "name": name,
            "hostName": host,
            "port": target.port.or_else(|| jdwp_port(args)).unwrap_or(DEFAULT_JDWP_PORT),
            "timeout": JAVA_ATTACH_TIMEOUT_MS,
        })),
        "go" => Err("The go adapter supports launch only".to_string()),
        _ => Err(format!("No debug adapter registered for '{adapter_id}'")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn attach(adapter: &str, target: AttachTarget) -> Result<Value, String> {
        build_attach_arguments(adapter, "app", &[], "/ws", &target)
    }

    #[test]
    fn node_attach_uses_the_target_or_the_inspector_default() {
        let value = attach(
            "node",
            AttachTarget {
                host: Some("127.0.0.1".to_string()),
                port: Some(9230),
                process_id: None,
            },
        )
        .unwrap();
        assert_eq!(value["address"], "127.0.0.1");
        assert_eq!(value["port"], 9230);
        let value = attach("node", AttachTarget::default()).unwrap();
        assert_eq!(value["address"], "localhost");
        assert_eq!(value["port"], 9229);
    }

    #[test]
    fn python_attach_connects_to_debugpy() {
        let value = attach(
            "python",
            AttachTarget {
                port: Some(5679),
                ..AttachTarget::default()
            },
        )
        .unwrap();
        assert_eq!(value["connect"]["host"], "localhost");
        assert_eq!(value["connect"]["port"], 5679);
    }

    #[test]
    fn lldb_attach_requires_a_process_id() {
        assert!(attach("lldb", AttachTarget::default()).is_err());
        let value = attach(
            "lldb",
            AttachTarget {
                process_id: Some(4242),
                ..AttachTarget::default()
            },
        )
        .unwrap();
        assert_eq!(value["pid"], 4242);
    }

    #[test]
    fn java_attach_prefers_the_target_port_over_the_jdwp_flag() {
        let args = vec!["-agentlib:jdwp=transport=dt_socket,address=*:8000".to_string()];
        let value =
            build_attach_arguments("java", "app", &args, "/ws", &AttachTarget::default()).unwrap();
        assert_eq!(value["port"], 8000);
        let target = AttachTarget {
            port: Some(9000),
            ..AttachTarget::default()
        };
        let value = build_attach_arguments("java", "app", &args, "/ws", &target).unwrap();
        assert_eq!(value["port"], 9000);
        let value = attach("java", AttachTarget::default()).unwrap();
        assert_eq!(value["port"], 5005);
    }

    #[test]
    fn go_and_unknown_adapters_cannot_attach() {
        assert!(attach("go", AttachTarget::default()).is_err());
        assert!(attach("ruby", AttachTarget::default()).is_err());
    }

    #[test]
    fn validation_rejects_bad_hosts_ports_and_pids() {
        let host = |h: &str| AttachTarget {
            host: Some(h.to_string()),
            ..AttachTarget::default()
        };
        assert!(validate_attach_target(&host("localhost")).is_ok());
        assert!(validate_attach_target(&host("[::1]")).is_ok());
        assert!(validate_attach_target(&host("")).is_err());
        assert!(validate_attach_target(&host("bad host")).is_err());
        assert!(validate_attach_target(&AttachTarget {
            port: Some(0),
            ..AttachTarget::default()
        })
        .is_err());
        assert!(validate_attach_target(&AttachTarget {
            process_id: Some(0),
            ..AttachTarget::default()
        })
        .is_err());
    }
}
