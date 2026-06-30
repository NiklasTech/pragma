use std::io::{BufRead, Write};

fn send_response(id: u64, result: serde_json::Value) {
    let response = serde_json::json!({
        "jsonrpc": "2.0",
        "id": id,
        "result": result,
    });
    println!("{}", serde_json::to_string(&response).unwrap());
    std::io::stdout().flush().unwrap();
}

fn main() {
    let stdin = std::io::stdin();
    for line in stdin.lock().lines() {
        let line = match line {
            Ok(line) => line,
            Err(_) => break,
        };
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let msg: serde_json::Value = match serde_json::from_str(line) {
            Ok(msg) => msg,
            Err(_) => continue,
        };

        let method = msg.get("method").and_then(|m| m.as_str()).unwrap_or("");
        let id = msg.get("id").and_then(|i| i.as_u64()).unwrap_or(0);

        match method {
            "initialize" => {
                send_response(
                    id,
                    serde_json::json!({
                        "protocolVersion": "2024-11-05",
                        "capabilities": {},
                        "serverInfo": {"name": "echo", "version": "1.0.0"},
                    }),
                );
            }
            "tools/list" => {
                send_response(
                    id,
                    serde_json::json!({
                        "tools": [
                            {
                                "name": "echo",
                                "description": "Echoes the provided message",
                                "inputSchema": {
                                    "type": "object",
                                    "properties": {
                                        "message": {"type": "string"}
                                    },
                                    "required": ["message"],
                                },
                            }
                        ]
                    }),
                );
            }
            "tools/call" => {
                let args = msg
                    .get("params")
                    .and_then(|p| p.get("arguments"))
                    .cloned()
                    .unwrap_or_else(|| serde_json::json!({}));
                let message = args
                    .get("message")
                    .and_then(|m| m.as_str())
                    .unwrap_or("")
                    .to_string();
                send_response(
                    id,
                    serde_json::json!({
                        "content": [
                            {"type": "text", "text": format!("echo: {message}")}
                        ]
                    }),
                );
            }
            _ => {}
        }
    }
}
