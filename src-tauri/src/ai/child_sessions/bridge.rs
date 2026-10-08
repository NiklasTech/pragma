use std::io::{BufRead, BufReader, Read, Write};
use std::net::TcpStream;
use std::time::Duration;

use serde_json::{json, Value};

use super::protocol::{
    is_browser_tool, BridgeRequest, SpawnReply, BROWSER_CONSOLE_TOOL_NAME,
    BROWSER_SCREENSHOT_TOOL_NAME, BROWSER_TOOL_NAME, EXTENSION_TOOL_PREFIX, LIST_EXTENSION_TOOLS,
    MAX_REPLY_LINE_BYTES, PORT_ENV, SESSION_ENV, TOKEN_ENV, TOOL_NAME,
};

const DEFAULT_PROTOCOL_VERSION: &str = "2024-11-05";
const CONNECT_TIMEOUT: Duration = Duration::from_secs(5);
const REPLY_TIMEOUT: Duration = Duration::from_secs(16 * 60);

struct BridgeConfig {
    port: u16,
    token: String,
    session_id: String,
}

impl BridgeConfig {
    fn from_env() -> Option<Self> {
        Some(Self {
            port: std::env::var(PORT_ENV).ok()?.parse().ok()?,
            token: std::env::var(TOKEN_ENV).ok()?,
            session_id: std::env::var(SESSION_ENV).ok()?,
        })
    }
}

fn tool_definition() -> Value {
    json!({
        "name": TOOL_NAME,
        "description": "Start a Pragma child session that works on its own task. The child runs separately; this session does not wait for it and is not finished when the child is. The user must approve the start.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "title": { "type": "string", "description": "Short title of the child session, 1 to 80 characters." },
                "prompt": { "type": "string", "description": "The first user message of the child session." },
                "kind": {
                    "type": "string",
                    "enum": ["conversation", "terminal"],
                    "description": "Conversation runs an agent conversation. Terminal runs a coding CLI. Defaults to conversation."
                },
                "environment": {
                    "type": "string",
                    "enum": ["checkout", "worktree"],
                    "description": "Worktree gives the child its own new git worktree. Defaults to worktree for a writing session."
                },
                "cli": { "type": "string", "description": "Id of an installed coding CLI. Required when kind is terminal." }
            },
            "required": ["title", "prompt"]
        }
    })
}

fn browser_tool_definition() -> Value {
    json!({
        "name": BROWSER_TOOL_NAME,
        "description": "Show an http or https URL to the user in Pragma's browser pane, for example the local dev server after starting it. It navigates the open browser pane or opens one. It does not return the page content; fetch the URL to read it.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "url": { "type": "string", "description": "The http or https URL to open, e.g. http://localhost:5173." }
            },
            "required": ["url"]
        }
    })
}

fn browser_screenshot_tool_definition() -> Value {
    json!({
        "name": BROWSER_SCREENSHOT_TOOL_NAME,
        "description": "Take a screenshot of the page in Pragma's browser pane and return it as an image, for example to check a UI change. Open the page with agent_open_browser first.",
        "inputSchema": { "type": "object", "properties": {} }
    })
}

fn browser_console_tool_definition() -> Value {
    json!({
        "name": BROWSER_CONSOLE_TOOL_NAME,
        "description": "Read the recent console messages, uncaught errors and failed requests of the page in Pragma's browser pane. Messages are kept from the last load of the page.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "limit": { "type": "number", "description": "Maximum number of recent entries to return. Defaults to 50." }
            }
        }
    })
}

fn forward(config: &BridgeConfig, tool: &str, arguments: Value) -> Result<SpawnReply, String> {
    let address = std::net::SocketAddr::from(([127, 0, 0, 1], config.port));
    let mut stream = TcpStream::connect_timeout(&address, CONNECT_TIMEOUT)
        .map_err(|e| format!("Pragma is not reachable: {e}"))?;
    stream
        .set_read_timeout(Some(REPLY_TIMEOUT))
        .map_err(|e| format!("failed to configure the connection: {e}"))?;

    let request = BridgeRequest {
        token: config.token.clone(),
        session_id: config.session_id.clone(),
        tool: tool.to_string(),
        arguments,
    };
    let mut payload =
        serde_json::to_string(&request).map_err(|e| format!("failed to encode request: {e}"))?;
    payload.push('\n');
    stream
        .write_all(payload.as_bytes())
        .map_err(|e| format!("failed to send the request: {e}"))?;

    let mut line = String::new();
    BufReader::new(stream.take(MAX_REPLY_LINE_BYTES))
        .read_line(&mut line)
        .map_err(|e| format!("failed to read the reply: {e}"))?;
    serde_json::from_str(line.trim()).map_err(|e| format!("the reply was malformed: {e}"))
}

type ToolSender<'a> = &'a dyn Fn(&str, Value) -> Result<SpawnReply, String>;

/// Pragma's own tools plus the tools extensions currently register.
fn list_tools(send: ToolSender) -> Value {
    let mut tools = vec![
        tool_definition(),
        browser_tool_definition(),
        browser_screenshot_tool_definition(),
        browser_console_tool_definition(),
    ];
    if let Ok(reply) = send(LIST_EXTENSION_TOOLS, json!({})) {
        if let Ok(Value::Array(extension_tools)) = serde_json::from_str::<Value>(&reply.text) {
            tools.extend(extension_tools);
        }
    }
    json!({ "tools": tools })
}

fn call_tool(params: &Value, send: ToolSender) -> Value {
    let name = params.get("name").and_then(Value::as_str).unwrap_or("");
    let forwarded =
        name == TOOL_NAME || is_browser_tool(name) || name.starts_with(EXTENSION_TOOL_PREFIX);
    let reply = if forwarded {
        let arguments = params
            .get("arguments")
            .cloned()
            .unwrap_or_else(|| json!({}));
        send(name, arguments).unwrap_or_else(|text| SpawnReply {
            ok: false,
            text,
            images: Vec::new(),
        })
    } else {
        SpawnReply {
            ok: false,
            text: format!("Unknown tool: {name}"),
            images: Vec::new(),
        }
    };
    let mut content = vec![json!({ "type": "text", "text": reply.text })];
    content.extend(
        reply.images.iter().map(
            |image| json!({ "type": "image", "data": image.data, "mimeType": image.media_type }),
        ),
    );
    json!({
        "content": content,
        "isError": !reply.ok,
    })
}

/// Answers one MCP message; notifications get no answer.
fn handle_message(line: &str, send: ToolSender) -> Option<Value> {
    let message: Value = match serde_json::from_str(line) {
        Ok(message) => message,
        Err(e) => {
            return Some(json!({
                "jsonrpc": "2.0",
                "id": Value::Null,
                "error": { "code": -32700, "message": format!("Parse error: {e}") },
            }))
        }
    };
    let id = message.get("id").cloned()?;
    let method = message.get("method").and_then(Value::as_str).unwrap_or("");
    let params = message.get("params").cloned().unwrap_or(Value::Null);

    let result = match method {
        "initialize" => Ok(json!({
            "protocolVersion": params
                .get("protocolVersion")
                .and_then(Value::as_str)
                .unwrap_or(DEFAULT_PROTOCOL_VERSION),
            "capabilities": { "tools": {} },
            "serverInfo": { "name": "pragma", "version": env!("CARGO_PKG_VERSION") },
        })),
        "ping" => Ok(json!({})),
        "tools/list" => Ok(list_tools(send)),
        "tools/call" => Ok(call_tool(&params, send)),
        _ => Err(json!({ "code": -32601, "message": format!("Method not found: {method}") })),
    };

    Some(match result {
        Ok(result) => json!({ "jsonrpc": "2.0", "id": id, "result": result }),
        Err(error) => json!({ "jsonrpc": "2.0", "id": id, "error": error }),
    })
}

/// Runs the stdio MCP server the ACP agent launched; returns the process exit code.
pub fn run() -> i32 {
    let Some(config) = BridgeConfig::from_env() else {
        eprintln!("Pragma child session bridge: missing configuration");
        return 2;
    };
    let send = |tool: &str, arguments: Value| forward(&config, tool, arguments);

    let stdin = std::io::stdin();
    let mut stdout = std::io::stdout();
    for line in stdin.lock().lines() {
        let Ok(line) = line else { break };
        if line.trim().is_empty() {
            continue;
        }
        let Some(response) = handle_message(&line, &send) else {
            continue;
        };
        if writeln!(stdout, "{response}")
            .and_then(|_| stdout.flush())
            .is_err()
        {
            break;
        }
    }
    0
}

#[cfg(test)]
mod tests {
    use super::*;

    fn unused(_: &str, _: Value) -> Result<SpawnReply, String> {
        Err("not called".to_string())
    }

    #[test]
    fn initialize_echoes_the_protocol_version() {
        let response = handle_message(
            r#"{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18"}}"#,
            &unused,
        )
        .unwrap();
        assert_eq!(response["result"]["protocolVersion"], "2025-06-18");
        assert!(response["result"]["capabilities"]["tools"].is_object());
    }

    #[test]
    fn notifications_get_no_answer() {
        let response = handle_message(
            r#"{"jsonrpc":"2.0","method":"notifications/initialized"}"#,
            &unused,
        );
        assert!(response.is_none());
    }

    #[test]
    fn lists_the_spawn_and_browser_tools() {
        let response =
            handle_message(r#"{"jsonrpc":"2.0","id":2,"method":"tools/list"}"#, &unused).unwrap();
        assert_eq!(response["result"]["tools"][0]["name"], TOOL_NAME);
        assert_eq!(response["result"]["tools"][1]["name"], BROWSER_TOOL_NAME);
        assert_eq!(
            response["result"]["tools"][2]["name"],
            BROWSER_SCREENSHOT_TOOL_NAME
        );
        assert_eq!(
            response["result"]["tools"][3]["name"],
            BROWSER_CONSOLE_TOOL_NAME
        );
        assert_eq!(response["result"]["tools"].as_array().unwrap().len(), 4);
    }

    #[test]
    fn lists_extension_tools_from_the_app() {
        let send = |tool: &str, _: Value| {
            assert_eq!(tool, LIST_EXTENSION_TOOLS);
            Ok(SpawnReply {
                ok: true,
                text: r#"[{"name":"ext__word-count__count","description":"Count","inputSchema":{"type":"object"}}]"#.to_string(),
                images: Vec::new(),
            })
        };
        let response =
            handle_message(r#"{"jsonrpc":"2.0","id":2,"method":"tools/list"}"#, &send).unwrap();
        assert_eq!(
            response["result"]["tools"][4]["name"],
            "ext__word-count__count"
        );
    }

    #[test]
    fn forwards_extension_tool_calls() {
        let send = |tool: &str, arguments: Value| {
            assert_eq!(tool, "ext__word-count__count");
            assert_eq!(arguments["text"], "a b");
            Ok(SpawnReply {
                ok: true,
                text: "2".to_string(),
                images: Vec::new(),
            })
        };
        let response = handle_message(
            r#"{"jsonrpc":"2.0","id":8,"method":"tools/call","params":{"name":"ext__word-count__count","arguments":{"text":"a b"}}}"#,
            &send,
        )
        .unwrap();
        assert_eq!(response["result"]["content"][0]["text"], "2");
    }

    #[test]
    fn forwards_a_spawn_call_and_reports_its_reply() {
        let send = |tool: &str, arguments: Value| {
            assert_eq!(tool, TOOL_NAME);
            assert_eq!(arguments["title"], "Fix tests");
            Ok(SpawnReply {
                ok: true,
                text: "started".to_string(),
                images: Vec::new(),
            })
        };
        let response = handle_message(
            r#"{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"agent_spawn_session","arguments":{"title":"Fix tests","prompt":"Run them"}}}"#,
            &send,
        )
        .unwrap();
        assert_eq!(response["result"]["content"][0]["text"], "started");
        assert_eq!(response["result"]["isError"], false);
    }

    #[test]
    fn reports_a_failed_forward_as_a_tool_error() {
        let send = |_: &str, _: Value| Err("Pragma is not reachable".to_string());
        let response = handle_message(
            r#"{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"agent_spawn_session","arguments":{}}}"#,
            &send,
        )
        .unwrap();
        assert_eq!(response["result"]["isError"], true);
    }

    #[test]
    fn forwards_a_browser_call_with_its_tool_name() {
        let send = |tool: &str, arguments: Value| {
            assert_eq!(tool, BROWSER_TOOL_NAME);
            assert_eq!(arguments["url"], "http://localhost:5173");
            Ok(SpawnReply {
                ok: true,
                text: "opened".to_string(),
                images: Vec::new(),
            })
        };
        let response = handle_message(
            r#"{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"agent_open_browser","arguments":{"url":"http://localhost:5173"}}}"#,
            &send,
        )
        .unwrap();
        assert_eq!(response["result"]["content"][0]["text"], "opened");
    }

    #[test]
    fn returns_screenshot_images_as_image_content() {
        let send = |tool: &str, _: Value| {
            assert_eq!(tool, BROWSER_SCREENSHOT_TOOL_NAME);
            Ok(SpawnReply {
                ok: true,
                text: "Screenshot".to_string(),
                images: vec![crate::ai::image::ImageContent {
                    media_type: "image/png".to_string(),
                    data: "aGk=".to_string(),
                }],
            })
        };
        let response = handle_message(
            r#"{"jsonrpc":"2.0","id":9,"method":"tools/call","params":{"name":"agent_browser_screenshot","arguments":{}}}"#,
            &send,
        )
        .unwrap();
        assert_eq!(response["result"]["content"][0]["text"], "Screenshot");
        assert_eq!(
            response["result"]["content"][1],
            json!({ "type": "image", "data": "aGk=", "mimeType": "image/png" })
        );
    }

    #[test]
    fn rejects_unknown_tools_without_forwarding() {
        let response = handle_message(
            r#"{"jsonrpc":"2.0","id":7,"method":"tools/call","params":{"name":"other","arguments":{}}}"#,
            &unused,
        )
        .unwrap();
        assert_eq!(response["result"]["isError"], true);
    }

    #[test]
    fn rejects_unknown_methods() {
        let response = handle_message(
            r#"{"jsonrpc":"2.0","id":5,"method":"resources/list"}"#,
            &unused,
        )
        .unwrap();
        assert_eq!(response["error"]["code"], -32601);
    }
}
