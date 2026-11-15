use std::io::Write;
use std::path::PathBuf;
use std::time::Duration;

use serde_json::json;
use tauri::{AppHandle, Manager};
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::net::{TcpListener, TcpStream};
use tokio::time::timeout;

use super::actions;
use super::protocol::{BridgeReply, BridgeRequest, MAX_REQUEST_BYTES};

/// Port and token for the MCP server, in the app data dir of Pragma Dev.
const DISCOVERY_FILE: &str = "dev-bridge.json";
const READ_TIMEOUT: Duration = Duration::from_secs(10);

pub fn start(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        if let Err(e) = serve(app).await {
            log::error!("dev bridge stopped: {e}");
        }
    });
}

pub fn remove_discovery_file(app: &AppHandle) {
    if let Ok(path) = discovery_path(app) {
        let _ = std::fs::remove_file(path);
    }
}

fn discovery_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|dir| dir.join(DISCOVERY_FILE))
        .map_err(|e| format!("no app data dir: {e}"))
}

fn write_discovery_file(app: &AppHandle, port: u16, token: &str) -> Result<(), String> {
    let path = discovery_path(app)?;
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| format!("failed to create {dir:?}: {e}"))?;
    }
    let content = json!({ "port": port, "token": token, "pid": std::process::id() }).to_string();
    let mut options = std::fs::OpenOptions::new();
    options.write(true).create(true).truncate(true);
    #[cfg(unix)]
    std::os::unix::fs::OpenOptionsExt::mode(&mut options, 0o600);
    options
        .open(&path)
        .and_then(|mut file| file.write_all(content.as_bytes()))
        .map_err(|e| format!("failed to write {path:?}: {e}"))
}

async fn serve(app: AppHandle) -> Result<(), String> {
    let listener = TcpListener::bind(("127.0.0.1", 0))
        .await
        .map_err(|e| format!("failed to bind: {e}"))?;
    let port = listener
        .local_addr()
        .map_err(|e| format!("no local address: {e}"))?
        .port();
    let token = uuid::Uuid::new_v4().simple().to_string();
    write_discovery_file(&app, port, &token)?;
    log::info!("dev bridge listening on 127.0.0.1:{port}");

    loop {
        let stream = match listener.accept().await {
            Ok((stream, _)) => stream,
            Err(e) => {
                log::warn!("dev bridge accept failed: {e}");
                continue;
            }
        };
        let app = app.clone();
        let token = token.clone();
        tauri::async_runtime::spawn(async move {
            if let Err(e) = handle_connection(app, &token, stream).await {
                log::warn!("dev bridge request failed: {e}");
            }
        });
    }
}

async fn handle_connection(app: AppHandle, token: &str, stream: TcpStream) -> Result<(), String> {
    let (read, mut write) = stream.into_split();
    let mut reader = BufReader::new(read.take(MAX_REQUEST_BYTES));
    let mut line = String::new();
    timeout(READ_TIMEOUT, reader.read_line(&mut line))
        .await
        .map_err(|_| "timed out reading the request".to_string())?
        .map_err(|e| format!("failed to read the request: {e}"))?;

    let reply = match serde_json::from_str::<BridgeRequest>(line.trim()) {
        Ok(request) if request.token != token => BridgeReply::error("The token is invalid"),
        Ok(request) => actions::run(&app, request).await,
        Err(e) => BridgeReply::error(format!("The request was malformed: {e}")),
    };

    let mut payload =
        serde_json::to_string(&reply).map_err(|e| format!("failed to encode the reply: {e}"))?;
    payload.push('\n');
    write
        .write_all(payload.as_bytes())
        .await
        .map_err(|e| format!("failed to write the reply: {e}"))
}
