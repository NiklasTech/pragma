use serde_json::Value;
use std::process::Stdio;
use tokio::process::Command;

use super::error::{AcpError, Result};
use super::types::ToolCallRequest;

pub async fn handle_tool_call(params: Option<Value>, cwd: &str) -> Result<Value> {
    let req: ToolCallRequest = serde_json::from_value(params.unwrap_or(Value::Null))
        .map_err(|e| AcpError::Protocol(format!("failed to parse tools/call request: {e}")))?;

    match req.name.as_str() {
        "Bash" => execute_bash(req.arguments, cwd).await,
        other => Err(AcpError::Protocol(format!(
            "unsupported reverse-RPC tool: {other}"
        ))),
    }
}

async fn execute_bash(arguments: Value, cwd: &str) -> Result<Value> {
    let command = extract_command(&arguments).ok_or_else(|| {
        AcpError::Protocol("missing or invalid command argument for Bash".to_string())
    })?;

    log::info!("acp: executing Bash tool in {cwd}: {command}");

    let output = Command::new("/bin/sh")
        .arg("-c")
        .arg(&command)
        .current_dir(cwd)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await
        .map_err(|e| AcpError::Protocol(format!("failed to execute Bash tool: {e}")))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let exit_code = output.status.code().unwrap_or(-1);

    log::info!(
        "acp: Bash tool finished exit_code={exit_code} stdout_len={} stderr_len={}",
        stdout.len(),
        stderr.len()
    );

    Ok(serde_json::json!({
        "stdout": stdout,
        "stderr": stderr,
        "exitCode": exit_code,
    }))
}

fn extract_command(arguments: &Value) -> Option<String> {
    if let Some(obj) = arguments.as_object() {
        if let Some(cmd) = obj.get("command").and_then(|v| v.as_str()) {
            return Some(cmd.to_string());
        }
    }
    if let Some(cmd) = arguments.as_str() {
        return Some(cmd.to_string());
    }
    None
}
