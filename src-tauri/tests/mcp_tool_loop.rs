use std::collections::HashMap;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;

use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::time::timeout;

use app_lib::ai::{
    config::ProviderConfig,
    provider::{
        AIProvider, CompletionChunk, CompletionRequest, FunctionDefinition, Message, Role,
        ToolDefinition,
    },
    providers::{anthropic::AnthropicProvider, openai::OpenAIProvider},
};
use app_lib::modules::mcp::client::{McpClient, McpClientConfig};
use app_lib::modules::mcp::tools::{call_tool, list_tools};

fn echo_tool() -> ToolDefinition {
    ToolDefinition {
        r#type: "function".to_string(),
        function: FunctionDefinition {
            name: "echo".to_string(),
            description: "Echoes the provided message".to_string(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "message": {"type": "string"}
                },
                "required": ["message"]
            }),
        },
    }
}

fn chat_request() -> CompletionRequest {
    CompletionRequest {
        messages: vec![Message {
            role: Role::User,
            content: "Call the echo tool with message hi".to_string(),
            tool_calls: None,
            tool_call_id: None,
        }],
        temperature: None,
        max_tokens: None,
        stream: true,
        tools: Some(vec![echo_tool()]),
    }
}

fn provider_config(base_url: String) -> ProviderConfig {
    ProviderConfig {
        base_url,
        model: "mock-model".to_string(),
        timeout_seconds: 30,
        api_key: Some("test-key".to_string()),
        extra_headers: None,
    }
}

async fn collect_chunks(
    mut rx: tokio::sync::mpsc::Receiver<Result<CompletionChunk, app_lib::ai::error::AIError>>,
) -> Vec<CompletionChunk> {
    let mut chunks = Vec::new();
    while let Some(result) = timeout(Duration::from_secs(5), rx.recv()).await.unwrap() {
        chunks.push(result.unwrap());
    }
    chunks
}

fn find_subseq(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    haystack
        .windows(needle.len())
        .position(|window| window == needle)
}

async fn read_request_and_respond(mut socket: TcpStream, response_body: &str) {
    let mut buf = vec![0u8; 8192];
    let mut total = 0;
    let mut headers_end = None;

    while total < buf.len() {
        let n = socket.read(&mut buf[total..]).await.unwrap();
        if n == 0 {
            break;
        }
        total += n;
        if let Some(pos) = find_subseq(&buf[..total], b"\r\n\r\n") {
            headers_end = Some(pos);
            break;
        }
    }

    let headers_end = headers_end.expect("did not receive complete HTTP headers");
    let headers = String::from_utf8_lossy(&buf[..headers_end]);
    let content_length: usize = headers
        .lines()
        .find_map(|line| {
            let line = line.to_ascii_lowercase();
            if line.starts_with("content-length:") {
                line.split(':').nth(1)?.trim().parse::<usize>().ok()
            } else {
                None
            }
        })
        .unwrap_or(0);

    let body_start = headers_end + 4;
    let need = content_length.saturating_sub(total - body_start);
    if need > 0 {
        let mut remaining = need;
        while remaining > 0 {
            let to_read = remaining.min(buf.len());
            let n = socket.read(&mut buf[..to_read]).await.unwrap();
            if n == 0 {
                break;
            }
            remaining -= n;
        }
    }

    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nCache-Control: no-cache\r\nConnection: close\r\n\r\n{response_body}"
    );
    socket.write_all(response.as_bytes()).await.unwrap();
    socket.flush().await.unwrap();
}

async fn spawn_mock_openai_server() -> SocketAddr {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();

    tokio::spawn(async move {
        let (socket, _) = listener.accept().await.unwrap();
        let events = [
            r#"data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":1,"model":"gpt-4o","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}"#,
            r#"data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":1,"model":"gpt-4o","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"echo","arguments":""}}]},"finish_reason":null}]}"#,
            r#"data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":1,"model":"gpt-4o","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\"message\": \"hi\"}"}}]},"finish_reason":null}]}"#,
            r#"data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":1,"model":"gpt-4o","choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}]}"#,
        ]
        .join("\n\n");
        read_request_and_respond(socket, &events).await;
    });

    addr
}

async fn spawn_mock_anthropic_server() -> SocketAddr {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();

    tokio::spawn(async move {
        let (socket, _) = listener.accept().await.unwrap();
        let events = [
            r#"data: {"type":"content_block_start","content_block":{"type":"tool_use","id":"tu_1","name":"echo"}}"#,
            r#"data: {"type":"content_block_delta","delta":{"type":"input_json_delta","partial_json":"{\"message\": \"hi\"}"}}"#,
            r#"data: {"type":"content_block_stop"}"#,
            r#"data: {"type":"message_stop"}"#,
        ]
        .join("\n\n");
        read_request_and_respond(socket, &events).await;
    });

    addr
}

async fn start_echo_mcp_server() -> (McpClient, tokio::process::Child, Arc<Mutex<Vec<String>>>) {
    let binary = PathBuf::from(env!("CARGO_BIN_EXE_echo-mcp-server"));

    let config = McpClientConfig {
        command: binary.to_string_lossy().to_string(),
        args: Vec::new(),
        env: HashMap::new(),
        request_timeout_ms: Some(10_000),
    };

    let (client, child, _, stderr) = McpClient::start(config).await.unwrap();
    let stderr_log = Arc::new(Mutex::new(Vec::new()));
    let log = Arc::clone(&stderr_log);
    tokio::spawn(async move {
        let mut lines = stderr;
        while let Some(line) = lines.recv().await {
            log.lock().await.push(line);
        }
    });

    (client, child, stderr_log)
}

async fn stderr_lines(log: &Arc<Mutex<Vec<String>>>) -> Vec<String> {
    log.lock().await.clone()
}

#[tokio::test]
async fn openai_streaming_tool_call_and_mcp_echo() {
    let addr = spawn_mock_openai_server().await;
    let provider = OpenAIProvider::new(provider_config(format!("http://{addr}"))).unwrap();

    let rx = provider.stream_chunks(chat_request()).await.unwrap();
    let chunks = collect_chunks(rx).await;

    let tool_chunk = chunks
        .iter()
        .find(|c| c.tool_calls.is_some())
        .expect("expected a tool-call chunk");
    let calls = tool_chunk.tool_calls.as_ref().unwrap();
    assert_eq!(calls.len(), 1);
    assert_eq!(calls[0].function.name, "echo");
    assert_eq!(calls[0].function.arguments, r#"{"message": "hi"}"#);

    let (client, _child, stderr_log) = start_echo_mcp_server().await;
    let tools = match list_tools(&client).await {
        Ok(tools) => tools,
        Err(e) => {
            panic!(
                "list_tools failed with {e:?}. stderr: {:?}",
                stderr_lines(&stderr_log).await
            );
        }
    };
    assert!(tools.iter().any(|t| t.name == "echo"));

    let result = match call_tool(&client, "echo", Some(serde_json::json!({"message": "hi"}))).await
    {
        Ok(result) => result,
        Err(e) => {
            panic!(
                "call_tool failed with {e:?}. stderr: {:?}",
                stderr_lines(&stderr_log).await
            );
        }
    };
    assert_eq!(
        result.content,
        serde_json::json!([{"type": "text", "text": "echo: hi"}])
    );
}

#[tokio::test]
async fn anthropic_streaming_tool_call_and_mcp_echo() {
    let addr = spawn_mock_anthropic_server().await;
    let provider = AnthropicProvider::new(provider_config(format!("http://{addr}"))).unwrap();

    let rx = provider.stream_chunks(chat_request()).await.unwrap();
    let chunks = collect_chunks(rx).await;

    let tool_chunk = chunks
        .iter()
        .find(|c| c.tool_calls.is_some())
        .expect("expected a tool-call chunk");
    let calls = tool_chunk.tool_calls.as_ref().unwrap();
    assert_eq!(calls.len(), 1);
    assert_eq!(calls[0].function.name, "echo");
    assert_eq!(calls[0].function.arguments, r#"{"message": "hi"}"#);

    let (client, _child, stderr_log) = start_echo_mcp_server().await;
    let tools = match list_tools(&client).await {
        Ok(tools) => tools,
        Err(e) => {
            panic!(
                "list_tools failed with {e:?}. stderr: {:?}",
                stderr_lines(&stderr_log).await
            );
        }
    };
    assert!(tools.iter().any(|t| t.name == "echo"));

    let result = match call_tool(&client, "echo", Some(serde_json::json!({"message": "hi"}))).await
    {
        Ok(result) => result,
        Err(e) => {
            panic!(
                "call_tool failed with {e:?}. stderr: {:?}",
                stderr_lines(&stderr_log).await
            );
        }
    };
    assert_eq!(
        result.content,
        serde_json::json!([{"type": "text", "text": "echo: hi"}])
    );
}
