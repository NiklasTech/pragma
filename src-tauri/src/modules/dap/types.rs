use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum DapTransport {
    #[default]
    Stdio,
    /// DAP over TCP; the adapter is spawned with `--port` (see client.rs).
    Tcp,
}

#[derive(Debug, Clone, Default)]
pub struct DapAdapterConfig {
    pub command: String,
    pub args: Vec<String>,
    pub transport: DapTransport,
}

#[derive(Debug, Clone, Serialize)]
pub struct DapAdapterInfo {
    pub id: String,
    pub label: String,
    pub available: bool,
    pub install_hint: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DapEnsureResult {
    pub adapter_id: String,
    pub installed: bool,
    pub available: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DapInstallResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum DapSessionStatus {
    Starting,
    Running,
    Stopped,
    Error,
}

#[derive(Debug, Clone, Serialize)]
pub struct DapStatusEvent {
    pub status: DapSessionStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub adapter: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DapEvent {
    pub event: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DapStartRequest {
    pub workspace_root: String,
    pub adapter: String,
    pub command: String,
    #[serde(default)]
    pub cwd: Option<String>,
    #[serde(default)]
    pub env: HashMap<String, String>,
    #[serde(default)]
    pub request: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub breakpoints: Vec<DapFileBreakpoints>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct DapFileBreakpoints {
    pub path: String,
    #[serde(default)]
    pub lines: Vec<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DapSource {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DapSourceBreakpoint {
    pub line: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DapBreakpoint {
    pub verified: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub line: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DapStackFrame {
    pub id: u64,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<DapSource>,
    pub line: u32,
    pub column: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DapScope {
    pub name: String,
    pub variables_reference: u64,
    #[serde(default)]
    pub expensive: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DapVariable {
    pub name: String,
    pub value: String,
    #[serde(skip_serializing_if = "Option::is_none", rename = "type")]
    pub var_type: Option<String>,
    pub variables_reference: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DapEvaluateResult {
    pub result: String,
    #[serde(skip_serializing_if = "Option::is_none", rename = "type")]
    pub var_type: Option<String>,
    pub variables_reference: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DapInitializeArguments {
    pub client_id: String,
    pub client_name: String,
    pub adapter_id: String,
    pub path_format: String,
    pub lines_start_at1: bool,
    pub columns_start_at1: bool,
    pub supports_variable_type: bool,
    pub supports_invalidated_event: bool,
    pub supports_memory_references: bool,
}

impl DapInitializeArguments {
    pub fn new(adapter_id: &str) -> Self {
        Self {
            client_id: "pragma".to_string(),
            client_name: "Pragma IDE".to_string(),
            adapter_id: adapter_id.to_string(),
            path_format: "path".to_string(),
            lines_start_at1: true,
            columns_start_at1: true,
            supports_variable_type: true,
            supports_invalidated_event: false,
            supports_memory_references: false,
        }
    }
}

/// Builds the adapter-specific `launch`/`attach` arguments from a run config
/// command that was already split into program + args.
pub fn build_launch_arguments(
    adapter_id: &str,
    request: &str,
    name: &str,
    program: &str,
    args: &[String],
    cwd: &str,
    env: &HashMap<String, String>,
) -> Result<serde_json::Value, String> {
    match adapter_id {
        "node" => Ok(build_node_arguments(request, name, program, args, cwd, env)),
        "python" => build_python_arguments(request, name, args, cwd, env),
        "lldb" => build_lldb_arguments(request, name, program, args, cwd, env),
        _ => Err(format!("No debug adapter registered for '{adapter_id}'")),
    }
}

/// CodeLLDB launches a compiled binary: the run config command is the binary
/// path, its remaining tokens are the program arguments.
fn build_lldb_arguments(
    request: &str,
    name: &str,
    program: &str,
    args: &[String],
    cwd: &str,
    env: &HashMap<String, String>,
) -> Result<serde_json::Value, String> {
    if request != "launch" {
        return Err("The lldb adapter supports launch only".to_string());
    }
    if program.is_empty() {
        return Err(
            "lldb debug requires a compiled binary (e.g. 'target/debug/myapp')".to_string(),
        );
    }

    Ok(serde_json::json!({
        "type": "lldb",
        "request": "launch",
        "name": name,
        "program": program,
        "args": args,
        "cwd": cwd,
        "env": env,
        "stopOnEntry": false,
    }))
}

fn build_node_arguments(
    request: &str,
    name: &str,
    program: &str,
    args: &[String],
    cwd: &str,
    env: &HashMap<String, String>,
) -> serde_json::Value {
    if request == "attach" {
        return serde_json::json!({
            "type": "pwa-node",
            "request": "attach",
            "name": name,
            "address": "localhost",
            "port": 9229,
            "cwd": cwd,
        });
    }

    serde_json::json!({
        "type": "pwa-node",
        "request": "launch",
        "name": name,
        "runtimeExecutable": program,
        "runtimeArgs": args,
        "cwd": cwd,
        "env": env,
        "console": "internalConsole",
        "outputCapture": "std",
    })
}

fn build_python_arguments(
    request: &str,
    name: &str,
    args: &[String],
    cwd: &str,
    env: &HashMap<String, String>,
) -> Result<serde_json::Value, String> {
    if request == "attach" {
        return Ok(serde_json::json!({
            "request": "attach",
            "name": name,
            "connect": { "host": "localhost", "port": 5678 },
            "justMyCode": true,
        }));
    }

    let first = args.first().ok_or_else(|| {
        "Python debug requires a script argument (e.g. 'python main.py')".to_string()
    })?;

    let mut value = if first == "-m" {
        let module = args
            .get(1)
            .ok_or_else(|| "Python debug with '-m' requires a module name".to_string())?;
        serde_json::json!({
            "request": "launch",
            "name": name,
            "module": module,
            "args": &args[2..],
        })
    } else {
        serde_json::json!({
            "request": "launch",
            "name": name,
            "program": first,
            "args": &args[1..],
        })
    };

    if let Some(obj) = value.as_object_mut() {
        obj.insert("cwd".to_string(), serde_json::json!(cwd));
        obj.insert("env".to_string(), serde_json::json!(env));
        obj.insert("console".to_string(), serde_json::json!("internalConsole"));
        obj.insert("justMyCode".to_string(), serde_json::json!(true));
        obj.insert("stopOnEntry".to_string(), serde_json::json!(false));
    }

    Ok(value)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn node_launch_uses_runtime_executable() {
        let value = build_launch_arguments(
            "node",
            "launch",
            "dev",
            "npm",
            &["run".to_string(), "dev".to_string()],
            "/workspace",
            &HashMap::new(),
        )
        .unwrap();
        assert_eq!(value["type"], "pwa-node");
        assert_eq!(value["runtimeExecutable"], "npm");
        assert_eq!(value["runtimeArgs"][0], "run");
        assert_eq!(value["console"], "internalConsole");
    }

    #[test]
    fn python_launch_splits_script_and_args() {
        let value = build_launch_arguments(
            "python",
            "launch",
            "script",
            "python",
            &["manage.py".to_string(), "runserver".to_string()],
            "/workspace",
            &HashMap::new(),
        )
        .unwrap();
        assert_eq!(value["program"], "manage.py");
        assert_eq!(value["args"][0], "runserver");
        assert_eq!(value["justMyCode"], true);
    }

    #[test]
    fn python_launch_supports_module_flag() {
        let value = build_launch_arguments(
            "python",
            "launch",
            "module",
            "python",
            &["-m".to_string(), "http.server".to_string()],
            "/workspace",
            &HashMap::new(),
        )
        .unwrap();
        assert_eq!(value["module"], "http.server");
        assert!(value.get("program").is_none());
    }

    #[test]
    fn python_launch_without_script_is_error() {
        let result = build_launch_arguments(
            "python",
            "launch",
            "x",
            "python",
            &[],
            "/ws",
            &HashMap::new(),
        );
        assert!(result.is_err());
    }

    #[test]
    fn lldb_launch_uses_program_and_args() {
        let value = build_launch_arguments(
            "lldb",
            "launch",
            "myapp",
            "target/debug/myapp.exe",
            &["--verbose".to_string()],
            "C:/ws",
            &HashMap::new(),
        )
        .unwrap();
        assert_eq!(value["type"], "lldb");
        assert_eq!(value["program"], "target/debug/myapp.exe");
        assert_eq!(value["args"][0], "--verbose");
        assert_eq!(value["cwd"], "C:/ws");
    }

    #[test]
    fn lldb_attach_is_not_supported() {
        let result =
            build_launch_arguments("lldb", "attach", "x", "app", &[], "/ws", &HashMap::new());
        assert!(result.is_err());
    }

    #[test]
    fn lldb_launch_without_program_is_error() {
        let result = build_launch_arguments("lldb", "launch", "x", "", &[], "/ws", &HashMap::new());
        assert!(result.is_err());
    }

    #[test]
    fn unknown_adapter_is_error() {
        let result =
            build_launch_arguments("ruby", "launch", "x", "ruby", &[], "/ws", &HashMap::new());
        assert!(result.is_err());
    }
}
