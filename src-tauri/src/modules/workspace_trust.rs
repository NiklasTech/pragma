use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use serde::Serialize;
use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
use tauri_plugin_store::Store;

const STORE_NAME: &str = "workspace-trust.json";
const SCRIPT_NAMES: [&str; 2] = ["worktree-setup", "worktree-teardown"];

/// Serializes trust prompts so a second caller reads the first answer instead of asking again.
static PROMPT_LOCK: Mutex<()> = Mutex::new(());

/// What a folder would run on its own once trusted.
#[derive(Debug, Default, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TrustContent {
    pub extensions: Vec<String>,
    pub scripts: Vec<String>,
}

impl TrustContent {
    fn is_empty(&self) -> bool {
        self.extensions.is_empty() && self.scripts.is_empty()
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrustStatus {
    /// `None` until the user has decided; folders without extensions or scripts never ask.
    pub trusted: Option<bool>,
    pub content: TrustContent,
}

fn canonical_root(root: &str) -> Result<PathBuf, String> {
    let path = Path::new(root);
    if !path.is_absolute() {
        return Err("Workspace root must be absolute".to_string());
    }
    path.canonicalize()
        .map_err(|e| format!("Failed to resolve workspace root: {e}"))
}

pub(crate) fn trust_content(root: &Path) -> TrustContent {
    let pragma = root.join(".pragma");
    let mut extensions: Vec<String> = std::fs::read_dir(pragma.join("extensions"))
        .map(|entries| {
            entries
                .flatten()
                .filter(|entry| entry.file_type().is_ok_and(|t| t.is_dir()))
                .map(|entry| entry.file_name().to_string_lossy().into_owned())
                .collect()
        })
        .unwrap_or_default();
    extensions.sort();
    let scripts = SCRIPT_NAMES
        .iter()
        .filter(|name| pragma.join(name).is_file())
        .map(|name| format!(".pragma/{name}"))
        .collect();
    TrustContent {
        extensions,
        scripts,
    }
}

fn load_store<R: Runtime>(app: &AppHandle<R>) -> Result<Arc<Store<R>>, String> {
    let path = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Failed to resolve app config dir: {e}"))?
        .join(STORE_NAME);
    tauri_plugin_store::StoreBuilder::new(app, path)
        .build()
        .map_err(|e| format!("Failed to load workspace trust: {e}"))
}

fn stored_decision<R: Runtime>(app: &AppHandle<R>, key: &str) -> Result<Option<bool>, String> {
    Ok(load_store(app)?.get(key).and_then(|value| value.as_bool()))
}

fn store_decision<R: Runtime>(app: &AppHandle<R>, key: &str, trusted: bool) -> Result<(), String> {
    let store = load_store(app)?;
    store.set(key.to_string(), serde_json::Value::Bool(trusted));
    store
        .save()
        .map_err(|e| format!("Failed to save workspace trust: {e}"))
}

fn prompt_message(root: &Path, content: &TrustContent) -> String {
    let mut lines = vec![format!(
        "{} contains code that Pragma runs on its own:",
        root.display()
    )];
    if !content.extensions.is_empty() {
        lines.push(format!("Extensions: {}", content.extensions.join(", ")));
    }
    if !content.scripts.is_empty() {
        lines.push(format!("Worktree scripts: {}", content.scripts.join(", ")));
    }
    lines.push(
        "Only trust folders from sources you know. Untrusted folders open without running this code."
            .to_string(),
    );
    lines.join("\n\n")
}

/// Whether the folder may run its extensions and worktree scripts; asks once with a native
/// dialog the webview cannot answer. Must not run on the main thread.
pub(crate) fn ensure_trusted<R: Runtime>(app: &AppHandle<R>, root: &str) -> Result<bool, String> {
    let root = canonical_root(root)?;
    let content = trust_content(&root);
    if content.is_empty() {
        return Ok(true);
    }
    let key = root.to_string_lossy().into_owned();
    let _guard = PROMPT_LOCK
        .lock()
        .map_err(|_| "Workspace trust lock poisoned".to_string())?;
    if let Some(trusted) = stored_decision(app, &key)? {
        return Ok(trusted);
    }
    let trusted = app
        .dialog()
        .message(prompt_message(&root, &content))
        .title("Trust this folder?")
        .kind(MessageDialogKind::Warning)
        .buttons(MessageDialogButtons::OkCancelCustom(
            "Trust Folder".to_string(),
            "Don't Trust".to_string(),
        ))
        .blocking_show();
    store_decision(app, &key, trusted)?;
    Ok(trusted)
}

/// Marks a folder trusted after the user installed an extension into it.
pub(crate) fn trust_after_install<R: Runtime>(
    app: &AppHandle<R>,
    root: &str,
) -> Result<(), String> {
    let key = canonical_root(root)?.to_string_lossy().into_owned();
    if stored_decision(app, &key)? == Some(false) {
        return Ok(());
    }
    store_decision(app, &key, true)
}

#[tauri::command(async)]
pub fn workspace_trust_status(app: AppHandle, root_path: String) -> Result<TrustStatus, String> {
    let root = canonical_root(&root_path)?;
    let key = root.to_string_lossy().into_owned();
    Ok(TrustStatus {
        trusted: stored_decision(&app, &key)?,
        content: trust_content(&root),
    })
}

/// Forgets the decision and asks again, so changing it always goes through the native dialog.
#[tauri::command]
pub async fn workspace_trust_change(app: AppHandle, root_path: String) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let key = canonical_root(&root_path)?.to_string_lossy().into_owned();
        let store = load_store(&app)?;
        store.delete(&key);
        store
            .save()
            .map_err(|e| format!("Failed to save workspace trust: {e}"))?;
        ensure_trusted(&app, &root_path)
    })
    .await
    .map_err(|e| format!("Workspace trust task failed: {e}"))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lists_extensions_and_worktree_scripts() {
        let dir = tempfile::tempdir().unwrap();
        let pragma = dir.path().join(".pragma");
        std::fs::create_dir_all(pragma.join("extensions").join("lint")).unwrap();
        std::fs::write(pragma.join("extensions").join("notes.txt"), "").unwrap();
        std::fs::write(pragma.join("worktree-setup"), "#!/bin/sh\n").unwrap();

        assert_eq!(
            trust_content(dir.path()),
            TrustContent {
                extensions: vec!["lint".to_string()],
                scripts: vec![".pragma/worktree-setup".to_string()],
            }
        );
    }

    #[test]
    fn folders_without_code_need_no_trust() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(dir.path().join(".pragma")).unwrap();
        std::fs::write(dir.path().join(".pragma").join("settings.json"), "{}").unwrap();
        assert!(trust_content(dir.path()).is_empty());
    }

    #[test]
    fn relative_roots_are_rejected() {
        assert!(canonical_root("relative/folder").is_err());
    }
}
