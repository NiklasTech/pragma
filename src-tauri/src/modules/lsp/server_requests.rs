use serde_json::{json, Value};

const METHOD_NOT_FOUND: i64 = -32601;

/// Builds the response to a request the server sent to the client, or `None` if
/// `message` is not a request. Some servers block until these are answered.
pub fn server_request_reply(message: &str) -> Option<String> {
    let value: Value = serde_json::from_str(message).ok()?;
    let id = value.get("id")?;
    let method = value.get("method")?.as_str()?;

    let reply = match method {
        "workspace/configuration" => {
            let count = value
                .pointer("/params/items")
                .and_then(Value::as_array)
                .map_or(0, Vec::len);
            json!({ "jsonrpc": "2.0", "id": id, "result": vec![Value::Null; count] })
        }
        "client/registerCapability"
        | "client/unregisterCapability"
        | "window/workDoneProgress/create"
        | "workspace/diagnostic/refresh"
        | "workspace/semanticTokens/refresh"
        | "workspace/inlayHint/refresh"
        | "workspace/codeLens/refresh" => json!({ "jsonrpc": "2.0", "id": id, "result": null }),
        _ => json!({
            "jsonrpc": "2.0",
            "id": id,
            "error": { "code": METHOD_NOT_FOUND, "message": format!("Unsupported request '{method}'") },
        }),
    };

    Some(reply.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn reply(message: Value) -> Option<Value> {
        server_request_reply(&message.to_string()).map(|r| serde_json::from_str(&r).unwrap())
    }

    #[test]
    fn acknowledges_registrations_and_progress() {
        for method in [
            "client/registerCapability",
            "window/workDoneProgress/create",
        ] {
            let response = reply(json!({ "jsonrpc": "2.0", "id": 7, "method": method })).unwrap();
            assert_eq!(response["id"], json!(7));
            assert_eq!(response["result"], Value::Null);
            assert!(response.get("error").is_none());
        }
    }

    #[test]
    fn answers_each_configuration_item() {
        let response = reply(json!({
            "jsonrpc": "2.0",
            "id": "cfg-1",
            "method": "workspace/configuration",
            "params": { "items": [{ "section": "typescript" }, { "section": "javascript" }] }
        }))
        .unwrap();
        assert_eq!(response["id"], json!("cfg-1"));
        assert_eq!(response["result"], json!([null, null]));
    }

    #[test]
    fn rejects_unsupported_requests() {
        let response =
            reply(json!({ "jsonrpc": "2.0", "id": 3, "method": "workspace/applyEdit" })).unwrap();
        assert_eq!(response["error"]["code"], json!(METHOD_NOT_FOUND));
    }

    #[test]
    fn ignores_notifications_and_responses() {
        assert!(reply(json!({ "jsonrpc": "2.0", "method": "window/logMessage" })).is_none());
        assert!(reply(json!({ "jsonrpc": "2.0", "id": 1, "result": null })).is_none());
        assert!(server_request_reply("not json").is_none());
    }
}
