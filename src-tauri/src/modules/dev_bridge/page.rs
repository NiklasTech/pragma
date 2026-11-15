use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::Deserialize;
use serde_json::Value;
use tauri::WebviewWindow;
use tokio::sync::oneshot;
use tokio::time::{sleep, timeout};

use super::protocol::{number_arg, BridgeReply};

/// Actions the page agent (`page_agent.js`) runs inside the webview.
pub const ACTIONS: [&str; 7] = [
    "inspect",
    "click",
    "type",
    "press",
    "wait_for",
    "console_logs",
    "eval",
];

const EVAL_TIMEOUT: Duration = Duration::from_secs(5);
const POLL_INTERVAL: Duration = Duration::from_millis(25);
const DEFAULT_ACTION_TIMEOUT_MS: u64 = 30_000;
const MAX_ACTION_TIMEOUT_MS: u64 = 120_000;
const MISSING_AGENT: &str = "missing";

#[derive(Deserialize)]
struct PageResult {
    ok: bool,
    text: String,
}

/// Starts the action in the page, then polls until the page agent reports its result.
pub async fn run(
    window: &WebviewWindow,
    action: &str,
    args: &Value,
) -> Result<BridgeReply, String> {
    let id = uuid::Uuid::new_v4().simple().to_string();
    let started = evaluate(window, start_script(&id, action, args)?).await?;
    match started.as_deref() {
        Some("started") => {}
        Some(MISSING_AGENT) => {
            return Err(
                "The page agent is not loaded in this window; the page may still be loading"
                    .to_string(),
            )
        }
        _ if action == "eval" => {
            return Err("The script did not start; check it for syntax errors".to_string())
        }
        _ => return Err("The page did not accept the action".to_string()),
    }

    let wait_ms = number_arg(args, "timeout_ms", 0, 0, MAX_ACTION_TIMEOUT_MS)
        + number_arg(args, "wait_ms", 0, 0, MAX_ACTION_TIMEOUT_MS);
    let deadline = Instant::now() + Duration::from_millis(DEFAULT_ACTION_TIMEOUT_MS + wait_ms);
    let take = format!(
        "window.__pragmaDevBridge ? window.__pragmaDevBridge.take({}) : null",
        Value::String(id)
    );
    loop {
        sleep(POLL_INTERVAL).await;
        if let Some(raw) = evaluate(window, take.clone()).await? {
            let result: PageResult = serde_json::from_str(&raw)
                .map_err(|e| format!("The page returned a malformed result: {e}"))?;
            return Ok(BridgeReply {
                ok: result.ok,
                text: result.text,
                image: None,
            });
        }
        if Instant::now() > deadline {
            return Err(format!("The page did not finish {action} in time"));
        }
    }
}

fn start_script(id: &str, action: &str, args: &Value) -> Result<String, String> {
    let id = Value::String(id.to_string());
    let action_json = Value::String(action.to_string());
    let call = if action == "eval" {
        let script = args
            .get("script")
            .and_then(Value::as_str)
            .ok_or("eval needs a script")?;
        format!("bridge.start({id}, {action_json}, null, async () => {{\n{script}\n}})")
    } else {
        format!("bridge.start({id}, {action_json}, {args})")
    };
    Ok(format!(
        "(() => {{ const bridge = window.__pragmaDevBridge; if (!bridge) return \"{MISSING_AGENT}\"; return {call}; }})()"
    ))
}

/// Runs a script and returns its string result; `None` when it returned nothing or threw.
async fn evaluate(window: &WebviewWindow, script: String) -> Result<Option<String>, String> {
    let (tx, rx) = oneshot::channel::<String>();
    let sender = Mutex::new(Some(tx));
    window
        .eval_with_callback(script, move |result| {
            if let Some(tx) = sender.lock().ok().and_then(|mut slot| slot.take()) {
                let _ = tx.send(result);
            }
        })
        .map_err(|e| format!("Failed to run a script in the page: {e}"))?;
    let raw = timeout(EVAL_TIMEOUT, rx)
        .await
        .map_err(|_| "The page did not answer; it may be loading or blocked".to_string())?
        .map_err(|_| "The page dropped the script".to_string())?;
    Ok(decode_result(&raw))
}

/// The webview hands back the result serialized as JSON; only strings are meaningful here.
fn decode_result(raw: &str) -> Option<String> {
    match serde_json::from_str::<Value>(raw) {
        Ok(Value::String(text)) => Some(text),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn decodes_only_string_results() {
        assert_eq!(decode_result(r#""started""#), Some("started".to_string()));
        assert_eq!(decode_result("null"), None);
        assert_eq!(decode_result(""), None);
        assert_eq!(decode_result("42"), None);
    }

    #[test]
    fn eval_wraps_the_script_in_an_async_function() {
        let script = start_script("abc", "eval", &json!({ "script": "return 1" })).unwrap();
        assert!(
            script.contains("bridge.start(\"abc\", \"eval\", null, async () => {\nreturn 1\n})")
        );
    }

    #[test]
    fn actions_pass_their_arguments_as_json() {
        let script = start_script("abc", "click", &json!({ "ref": "e3" })).unwrap();
        assert!(script.contains(r#"bridge.start("abc", "click", {"ref":"e3"})"#));
    }

    #[test]
    fn eval_without_a_script_is_rejected() {
        assert!(start_script("abc", "eval", &json!({})).is_err());
    }
}
