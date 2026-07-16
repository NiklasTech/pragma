use crate::ai::cli::manager::enriched_path;
use crate::modules::lsp::client::{LspClient, Notification};
use crate::modules::lsp::types::{
    ClientCapabilities, DidChangeTextDocumentParams, DidOpenTextDocumentParams,
    DidSaveTextDocumentParams, InitializeParams, LspDiagnosticsEvent, LspServerConfig,
    LspServerStatus, LspStatusEvent, ProjectLanguage, PublishDiagnosticsParams, ServerCapabilities,
    TextDocumentContentChangeEvent, TextDocumentIdentifier, TextDocumentItem,
    VersionedTextDocumentIdentifier,
};
use crate::modules::lsp::uris::{path_to_uri, uri_to_path};
use crate::platform::new_tokio_command;
use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::process::Child;
use tokio::sync::{Mutex, RwLock};

const SUPERVISE_POLL_INTERVAL: Duration = Duration::from_millis(500);
const EXIT_WAIT_TIMEOUT: Duration = Duration::from_secs(1);
const SHUTDOWN_ALL_TIMEOUT: Duration = Duration::from_secs(3);

struct ServerEntry {
    language: &'static str,
    command: &'static str,
    args: &'static [&'static str],
    install_program: Option<&'static str>,
    install_args: &'static [&'static str],
}

const SERVERS: &[ServerEntry] = &[
    ServerEntry {
        language: "typescript",
        command: "typescript-language-server",
        args: &["--stdio"],
        install_program: Some("npm"),
        install_args: &["install", "-g", "typescript-language-server"],
    },
    ServerEntry {
        language: "javascript",
        command: "typescript-language-server",
        args: &["--stdio"],
        install_program: Some("npm"),
        install_args: &["install", "-g", "typescript-language-server"],
    },
    ServerEntry {
        language: "rust",
        command: "rust-analyzer",
        args: &[],
        install_program: Some("rustup"),
        install_args: &["component", "add", "rust-analyzer"],
    },
    ServerEntry {
        language: "python",
        command: "pylsp",
        args: &[],
        install_program: Some("pip"),
        install_args: &["install", "python-lsp-server"],
    },
    ServerEntry {
        language: "go",
        command: "gopls",
        args: &[],
        install_program: Some("go"),
        install_args: &["install", "golang.org/x/tools/gopls@latest"],
    },
    ServerEntry {
        language: "java",
        command: "jdtls",
        args: &[],
        install_program: Some("npm"),
        install_args: &["install", "-g", "jdtls"],
    },
    ServerEntry {
        language: "c",
        command: "clangd",
        args: &[],
        install_program: None,
        install_args: &[],
    },
    ServerEntry {
        language: "cpp",
        command: "clangd",
        args: &[],
        install_program: None,
        install_args: &[],
    },
    ServerEntry {
        language: "html",
        command: "vscode-html-language-server",
        args: &["--stdio"],
        install_program: Some("npm"),
        install_args: &["install", "-g", "@vscode/langserver-html"],
    },
    ServerEntry {
        language: "css",
        command: "vscode-css-language-server",
        args: &["--stdio"],
        install_program: Some("npm"),
        install_args: &["install", "-g", "@vscode/langserver-css"],
    },
];

struct RunningServer {
    client: LspClient,
    #[allow(dead_code)]
    capabilities: ServerCapabilities,
    child: Arc<Mutex<Child>>,
    #[allow(dead_code)]
    status: Arc<Mutex<LspServerStatus>>,
    notification_handle: tokio::task::JoinHandle<()>,
    supervisor_handle: tokio::task::JoinHandle<()>,
    log_handle: tokio::task::JoinHandle<()>,
}

pub struct LspManager {
    app_handle: AppHandle,
    servers: RwLock<HashMap<(String, String), RunningServer>>,
    document_versions: Mutex<HashMap<String, i32>>,
    start_lock: Mutex<()>,
}

impl LspManager {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            app_handle,
            servers: RwLock::new(HashMap::new()),
            document_versions: Mutex::new(HashMap::new()),
            start_lock: Mutex::new(()),
        }
    }

    pub fn managed(app_handle: AppHandle) -> Self {
        Self::new(app_handle)
    }

    pub async fn start_server(
        &self,
        language: &str,
        project_root: &str,
    ) -> std::result::Result<(), String> {
        let key = (language.to_string(), project_root.to_string());

        {
            let servers = self.servers.read().await;
            if servers.contains_key(&key) {
                return Ok(());
            }
        }

        let _guard = self.start_lock.lock().await;

        {
            let servers = self.servers.read().await;
            if servers.contains_key(&key) {
                return Ok(());
            }
        }

        let config = server_config_for_language(language)
            .ok_or_else(|| format!("No LSP server configured for language '{language}'"))?;

        self.emit_status(language, project_root, LspServerStatus::Starting, None);

        let (client, child, notifications, stderr_lines) =
            LspClient::start(config).await.map_err(|e| e.to_string())?;

        let child = Arc::new(Mutex::new(child));
        let status = Arc::new(Mutex::new(LspServerStatus::Running));

        let notification_handle = tokio::spawn(Self::forward_notifications(
            self.app_handle.clone(),
            language.to_string(),
            notifications,
        ));
        let supervisor_handle = tokio::spawn(Self::supervise(
            self.app_handle.clone(),
            language.to_string(),
            project_root.to_string(),
            Arc::clone(&child),
            Arc::clone(&status),
        ));
        let log_handle = tokio::spawn(Self::forward_logs(
            self.app_handle.clone(),
            language.to_string(),
            stderr_lines,
        ));

        let root_uri = path_to_uri(project_root);
        let params = InitializeParams {
            process_id: Some(std::process::id()),
            root_path: Some(project_root.to_string()),
            root_uri: Some(root_uri),
            capabilities: ClientCapabilities {
                text_document: Some({
                    let mut map = HashMap::new();
                    map.insert(
                        "synchronization".to_string(),
                        serde_json::json!({
                            "dynamicRegistration": false,
                            "willSave": false,
                            "willSaveWaitUntil": false,
                            "didSave": true,
                            "change": 1,
                        }),
                    );
                    map.insert(
                        "publishDiagnostics".to_string(),
                        serde_json::json!({
                            "dynamicRegistration": false,
                            "relatedInformation": true,
                            "tagSupport": { "valueSet": [1, 2] },
                            "versionSupport": true,
                            "codeDescriptionSupport": true,
                            "dataSupport": true,
                        }),
                    );
                    map.insert(
                        "completion".to_string(),
                        serde_json::json!({
                            "dynamicRegistration": false,
                            "completionItem": {
                                "snippetSupport": false,
                                "resolveSupport": { "properties": ["documentation", "detail"] },
                                "documentationFormat": ["markdown", "plaintext"]
                            }
                        }),
                    );
                    map.insert(
                        "definition".to_string(),
                        serde_json::json!({
                            "dynamicRegistration": false,
                            "linkSupport": true
                        }),
                    );
                    map
                }),
                workspace: None,
            },
        };

        let initialize_result = match client.initialize(params).await {
            Ok(result) => result,
            Err(e) => {
                let _ = child.lock().await.kill().await;
                notification_handle.abort();
                supervisor_handle.abort();
                log_handle.abort();
                self.emit_status(
                    language,
                    project_root,
                    LspServerStatus::Error,
                    Some(e.to_string()),
                );
                return Err(e.to_string());
            }
        };

        if let Err(e) = client.initialized().await {
            let _ = child.lock().await.kill().await;
            notification_handle.abort();
            supervisor_handle.abort();
            log_handle.abort();
            self.emit_status(
                language,
                project_root,
                LspServerStatus::Error,
                Some(e.to_string()),
            );
            return Err(e.to_string());
        }

        {
            let mut servers = self.servers.write().await;
            servers.insert(
                key,
                RunningServer {
                    client,
                    capabilities: initialize_result.capabilities,
                    child,
                    status,
                    notification_handle,
                    supervisor_handle,
                    log_handle,
                },
            );
        }

        self.emit_status(language, project_root, LspServerStatus::Running, None);
        Ok(())
    }

    pub async fn check_server_installed(language: &str) -> Result<bool, String> {
        let config = server_config_for_language(language)
            .ok_or_else(|| format!("No LSP server configured for language '{language}'"))?;

        let path = enriched_path();
        let command = resolve_command(&config.command, &path);
        let output = new_tokio_command(&command)
            .arg("--version")
            .env("PATH", &path)
            .output()
            .await;

        match output {
            Ok(out) if out.status.success() => Ok(true),
            _ => Ok(false),
        }
    }

    pub async fn install_server(language: &str) -> Result<String, String> {
        let config = server_config_for_language(language)
            .ok_or_else(|| format!("No LSP server configured for language '{language}'"))?;

        let program = config
            .install_program
            .ok_or_else(|| format!("Automatic installation is not supported for '{language}'"))?;

        if config.install_args.is_empty() {
            return Err(format!("No install arguments configured for '{language}'"));
        }

        let path = enriched_path();
        let program = resolve_command(&program, &path);
        let output = new_tokio_command(&program)
            .args(&config.install_args)
            .env("PATH", &path)
            .output()
            .await
            .map_err(|e| format!("Failed to run installer: {e}"))?;

        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

        if !output.status.success() {
            let message = if stderr.is_empty() { stdout } else { stderr };
            return Err(format!(
                "Installation failed with exit code {}: {message}",
                output.status.code().unwrap_or(-1)
            ));
        }

        // Verify the server is actually discoverable after a reported success.
        if !Self::check_server_installed(language).await? {
            let output = if stdout.is_empty() { stderr } else { stdout };
            return Err(format!(
                "Installation reported success but '{}' is still not in PATH. Output: {output}",
                config.command
            ));
        }

        Ok(if stdout.is_empty() { stderr } else { stdout })
    }

    pub async fn detect_project_languages(
        project_root: &str,
    ) -> Result<Vec<ProjectLanguage>, String> {
        let root = Path::new(project_root);
        if !root.is_dir() {
            return Err(format!("'{project_root}' is not a directory"));
        }

        let mut counts: HashMap<String, usize> = HashMap::new();
        let mut total = 0usize;

        visit_project_files(root, &mut counts, &mut total, 0)
            .await
            .map_err(|e| e.to_string())?;

        if total == 0 {
            return Ok(Vec::new());
        }

        let mut languages: Vec<ProjectLanguage> = counts
            .into_iter()
            .map(|(language, count)| ProjectLanguage {
                language,
                percentage: (count as f64 / total as f64) * 100.0,
            })
            .collect();

        languages.sort_by(|a, b| {
            b.percentage
                .partial_cmp(&a.percentage)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        Ok(languages)
    }

    pub async fn stop_server(
        &self,
        language: &str,
        project_root: &str,
    ) -> std::result::Result<(), String> {
        let key = (language.to_string(), project_root.to_string());
        let server = {
            let mut servers = self.servers.write().await;
            servers.remove(&key)
        };

        if let Some(server) = server {
            Self::stop_running_server(server).await;
            self.emit_status(language, project_root, LspServerStatus::Stopped, None);
            Ok(())
        } else {
            Err(format!(
                "No running server for {language} in {project_root}"
            ))
        }
    }

    pub async fn did_open(
        &self,
        language: &str,
        project_root: &str,
        file_path: &str,
        content: &str,
    ) -> std::result::Result<(), String> {
        self.start_server(language, project_root).await?;

        let client = self.get_client(language, project_root).await?;
        let uri = path_to_uri(file_path);

        {
            let mut versions = self.document_versions.lock().await;
            versions.insert(uri.clone(), 1);
        }

        let params = DidOpenTextDocumentParams {
            text_document: TextDocumentItem {
                uri,
                language_id: language_id_for_path(file_path, language),
                version: 1,
                text: content.to_string(),
            },
        };

        client
            .notify(
                "textDocument/didOpen",
                Some(serde_json::to_value(params).map_err(|e| e.to_string())?),
            )
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn did_change(
        &self,
        language: &str,
        project_root: &str,
        file_path: &str,
        content: &str,
    ) -> std::result::Result<(), String> {
        let client = self.get_client(language, project_root).await?;
        let uri = path_to_uri(file_path);

        let next_version = {
            let mut versions = self.document_versions.lock().await;
            let version = versions.get(&uri).copied().unwrap_or(1) + 1;
            versions.insert(uri.clone(), version);
            version
        };

        let params = DidChangeTextDocumentParams {
            text_document: VersionedTextDocumentIdentifier {
                uri,
                version: next_version,
            },
            content_changes: vec![TextDocumentContentChangeEvent {
                text: content.to_string(),
            }],
        };

        client
            .notify(
                "textDocument/didChange",
                Some(serde_json::to_value(params).map_err(|e| e.to_string())?),
            )
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn did_save(
        &self,
        language: &str,
        project_root: &str,
        file_path: &str,
    ) -> std::result::Result<(), String> {
        let client = self.get_client(language, project_root).await?;
        let uri = path_to_uri(file_path);

        let params = DidSaveTextDocumentParams {
            text_document: TextDocumentIdentifier { uri },
        };

        client
            .notify(
                "textDocument/didSave",
                Some(serde_json::to_value(params).map_err(|e| e.to_string())?),
            )
            .await
            .map_err(|e| e.to_string())
    }

    async fn get_client(
        &self,
        language: &str,
        project_root: &str,
    ) -> std::result::Result<LspClient, String> {
        let servers = self.servers.read().await;
        let key = (language.to_string(), project_root.to_string());
        servers
            .get(&key)
            .map(|s| s.client.clone())
            .ok_or_else(|| format!("LSP server for {language} in {project_root} is not running"))
    }

    async fn stop_running_server(server: RunningServer) {
        let _ = server.client.shutdown().await;
        let _ = server.client.exit().await;

        let exited = tokio::time::timeout(EXIT_WAIT_TIMEOUT, async {
            loop {
                {
                    let mut child = server.child.lock().await;
                    match child.try_wait() {
                        Ok(Some(_)) | Err(_) => return,
                        Ok(None) => {}
                    }
                }
                tokio::time::sleep(Duration::from_millis(50)).await;
            }
        })
        .await;

        if exited.is_err() {
            let mut child = server.child.lock().await;
            let _ = child.kill().await;
        }

        server.notification_handle.abort();
        server.supervisor_handle.abort();
        server.log_handle.abort();
    }

    pub async fn shutdown_all(&self) {
        let servers: Vec<RunningServer> = {
            let mut map = self.servers.write().await;
            map.drain().map(|(_, server)| server).collect()
        };

        let mut handles = Vec::with_capacity(servers.len());
        for server in servers {
            handles.push(tokio::spawn(Self::stop_running_server(server)));
        }

        let _ = tokio::time::timeout(SHUTDOWN_ALL_TIMEOUT, async {
            for handle in handles {
                let _ = handle.await;
            }
        })
        .await;

        self.document_versions.lock().await.clear();
    }

    async fn supervise(
        app_handle: AppHandle,
        language: String,
        project_root: String,
        child: Arc<Mutex<Child>>,
        status: Arc<Mutex<LspServerStatus>>,
    ) {
        let exit = loop {
            {
                let mut guard = child.lock().await;
                match guard.try_wait() {
                    Ok(Some(exit_status)) => break Ok(exit_status),
                    Ok(None) => {}
                    Err(err) => break Err(err),
                }
            }
            tokio::time::sleep(SUPERVISE_POLL_INTERVAL).await;
        };

        let (new_status, error) = match exit {
            Ok(code) if code.success() => (LspServerStatus::Stopped, None),
            Ok(code) => {
                let message = format!("exited with code {}", code.code().unwrap_or(-1));
                (LspServerStatus::Error, Some(message))
            }
            Err(err) => {
                let message = format!("wait failed: {err}");
                (LspServerStatus::Error, Some(message))
            }
        };

        {
            let mut s = status.lock().await;
            *s = new_status;
        }

        let _ = app_handle.emit(
            "lsp_status_changed",
            LspStatusEvent {
                language,
                project_root,
                status: new_status,
                error,
            },
        );
    }

    async fn forward_notifications(
        app_handle: AppHandle,
        language: String,
        mut rx: tokio::sync::mpsc::UnboundedReceiver<Notification>,
    ) {
        while let Some(notification) = rx.recv().await {
            if notification.method == "textDocument/publishDiagnostics" {
                if let Some(params) = notification.params {
                    match serde_json::from_value::<PublishDiagnosticsParams>(params) {
                        Ok(diagnostics) => {
                            let file_path = uri_to_path(&diagnostics.uri);
                            let event = LspDiagnosticsEvent {
                                language: language.clone(),
                                file_path,
                                diagnostics: diagnostics.diagnostics,
                            };
                            let _ = app_handle.emit("lsp_diagnostics", event);
                        }
                        Err(_e) => {}
                    }
                }
            }
        }
    }

    async fn forward_logs(
        app_handle: AppHandle,
        language: String,
        mut rx: tokio::sync::mpsc::UnboundedReceiver<String>,
    ) {
        while let Some(line) = rx.recv().await {
            let _ = app_handle.emit(
                "lsp_log",
                serde_json::json!({
                    "language": language,
                    "line": line,
                }),
            );
        }
    }

    fn emit_status(
        &self,
        language: &str,
        project_root: &str,
        status: LspServerStatus,
        error: Option<String>,
    ) {
        let _ = self.app_handle.emit(
            "lsp_status_changed",
            LspStatusEvent {
                language: language.to_string(),
                project_root: project_root.to_string(),
                status,
                error,
            },
        );
    }
}

/// Resolves a command name to an executable path.
///
/// On Windows, Rust's `Command::new` only searches for `.exe` files by default,
/// but npm global packages install `.cmd` wrappers. This helper searches PATH
/// (with common Windows extensions) and falls back to the original name.
pub fn resolve_command(command: &str, path: &str) -> String {
    if !cfg!(target_os = "windows") || command.contains('.') {
        return command.to_string();
    }

    for dir in std::env::split_paths(path) {
        for ext in ["cmd", "bat", "exe"] {
            let candidate = dir.join(format!("{command}.{ext}"));
            if candidate.is_file() {
                return candidate.to_string_lossy().to_string();
            }
        }
    }

    command.to_string()
}

fn server_config_for_language(language: &str) -> Option<LspServerConfig> {
    SERVERS
        .iter()
        .find(|s| s.language == language)
        .map(|s| LspServerConfig {
            command: s.command.to_string(),
            args: s.args.iter().map(|a| a.to_string()).collect(),
            install_program: s.install_program.map(|p| p.to_string()),
            install_args: s.install_args.iter().map(|a| a.to_string()).collect(),
        })
}

pub fn resolve_project_root(language: &str, file_path: &str) -> Option<String> {
    let path = Path::new(file_path);
    let mut current = path.parent()?;

    let markers: &[&str] = match language {
        "typescript" | "javascript" => &["tsconfig.json", "package.json"],
        "rust" => &["Cargo.toml"],
        "python" => &["pyproject.toml", "setup.py", "requirements.txt"],
        "go" => &["go.mod"],
        "java" => &["pom.xml", "build.gradle", "build.gradle.kts"],
        "c" | "cpp" => &["CMakeLists.txt", "Makefile", "meson.build"],
        "html" | "css" => &["package.json", "index.html"],
        _ => &["package.json"],
    };

    loop {
        if markers.iter().any(|marker| current.join(marker).exists()) {
            return current.to_str().map(|s| s.to_string());
        }

        match current.parent() {
            Some(parent) => current = parent,
            None => break,
        }
    }

    path.parent()
        .and_then(|p| p.to_str())
        .map(|s| s.to_string())
}

fn language_id_for_path(file_path: &str, language: &str) -> String {
    if language != "typescript" && language != "javascript" {
        return language.to_string();
    }

    let lower = file_path.to_lowercase();
    if lower.ends_with(".tsx") {
        return "typescriptreact".to_string();
    }
    if lower.ends_with(".jsx") {
        return "javascriptreact".to_string();
    }
    if lower.ends_with(".mts") {
        return "typescript".to_string();
    }
    if lower.ends_with(".cts") {
        return "typescript".to_string();
    }
    if lower.ends_with(".mjs") {
        return "javascript".to_string();
    }
    if lower.ends_with(".cjs") {
        return "javascript".to_string();
    }

    language.to_string()
}

const MAX_SCAN_DEPTH: usize = 4;
const MAX_SCAN_FILES: usize = 1000;

const SCAN_SKIP_DIRS: &[&str] = &[
    "node_modules",
    ".git",
    "target",
    "dist",
    "build",
    ".venv",
    "venv",
    "vendor",
    ".idea",
    ".vscode",
    "__pycache__",
    ".next",
    ".nuxt",
    "out",
];

fn extension_to_language(ext: &str) -> Option<&'static str> {
    match ext.to_lowercase().as_str() {
        "ts" | "tsx" => Some("typescript"),
        "js" | "jsx" | "mjs" | "cjs" => Some("javascript"),
        "rs" => Some("rust"),
        "py" | "pyi" => Some("python"),
        "go" => Some("go"),
        "java" => Some("java"),
        "c" | "h" => Some("c"),
        "cpp" | "cc" | "cxx" | "hpp" | "hh" => Some("cpp"),
        "html" | "htm" => Some("html"),
        "css" | "scss" | "sass" | "less" => Some("css"),
        _ => None,
    }
}

async fn visit_project_files(
    dir: &Path,
    counts: &mut HashMap<String, usize>,
    total: &mut usize,
    depth: usize,
) -> std::io::Result<()> {
    if depth > MAX_SCAN_DEPTH || *total >= MAX_SCAN_FILES {
        return Ok(());
    }

    let mut entries = tokio::fs::read_dir(dir).await?;
    while let Some(entry) = entries.next_entry().await? {
        let path = entry.path();
        let name = entry.file_name();
        let name_str = name.to_string_lossy();

        if SCAN_SKIP_DIRS.iter().any(|skip| name_str == *skip) {
            continue;
        }

        let file_type = entry.file_type().await?;
        if file_type.is_dir() {
            Box::pin(visit_project_files(&path, counts, total, depth + 1)).await?;
        } else if file_type.is_file() {
            if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                if let Some(language) = extension_to_language(ext) {
                    *counts.entry(language.to_string()).or_insert(0) += 1;
                    *total += 1;
                }
            }
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn resolve_command_prefers_cmd_wrapper_on_windows() {
        if !cfg!(target_os = "windows") {
            return;
        }

        let temp = std::env::temp_dir().join("pragma-resolve-command-test");
        let _ = fs::remove_dir_all(&temp);
        fs::create_dir_all(&temp).unwrap();
        fs::write(temp.join("typescript-language-server.cmd"), "").unwrap();
        fs::write(temp.join("typescript-language-server.exe"), "").unwrap();

        let path = temp.to_string_lossy().to_string();
        let resolved = resolve_command("typescript-language-server", &path);
        assert!(
            resolved.ends_with(".cmd"),
            "expected .cmd wrapper, got {resolved}"
        );

        let _ = fs::remove_dir_all(&temp);
    }

    #[test]
    fn resolve_command_returns_original_on_unix() {
        if cfg!(target_os = "windows") {
            return;
        }

        let resolved = resolve_command("typescript-language-server", "/usr/bin");
        assert_eq!(resolved, "typescript-language-server");
    }
}
