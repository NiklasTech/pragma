mod capabilities;
mod config;
mod lifecycle;
mod notifications;
mod project;
mod sync;

pub use config::resolve_command;
pub use project::resolve_project_root;

use crate::modules::lsp::client::LspClient;
use crate::modules::lsp::types::{LspServerStatus, LspStatusEvent, ServerCapabilities};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::process::Child;
use tokio::sync::{Mutex, RwLock};

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
        install_args: &["install", "-g", "vscode-langservers-extracted"],
    },
    ServerEntry {
        language: "css",
        command: "vscode-css-language-server",
        args: &["--stdio"],
        install_program: Some("npm"),
        install_args: &["install", "-g", "vscode-langservers-extracted"],
    },
];

pub(crate) struct RunningServer {
    pub(crate) client: LspClient,
    pub(crate) capabilities: ServerCapabilities,
    child: Arc<Mutex<Child>>,
    #[allow(dead_code)]
    status: Arc<Mutex<LspServerStatus>>,
    notification_handle: tokio::task::JoinHandle<()>,
    supervisor_handle: tokio::task::JoinHandle<()>,
    log_handle: tokio::task::JoinHandle<()>,
}

pub struct LspManager {
    app_handle: AppHandle,
    pub(crate) servers: RwLock<HashMap<(String, String), RunningServer>>,
    pub(crate) document_versions: Mutex<HashMap<String, i32>>,
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

    fn emit_status(
        &self,
        language: &str,
        project_root: &str,
        status: LspServerStatus,
        error: Option<String>,
        expected: Option<bool>,
    ) {
        let _ = self.app_handle.emit(
            "lsp_status_changed",
            LspStatusEvent {
                language: language.to_string(),
                project_root: project_root.to_string(),
                status,
                error,
                expected,
            },
        );
    }
}
