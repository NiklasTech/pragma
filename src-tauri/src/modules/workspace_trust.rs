use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use serde::Serialize;
use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_dialog::{
    DialogExt, MessageDialogButtons, MessageDialogKind, MessageDialogResult,
};
use tauri_plugin_store::Store;

const STORE_NAME: &str = "workspace-trust.json";
const SCRIPT_NAMES: [&str; 2] = ["worktree-setup", "worktree-teardown"];
const TRUST_FOLDER: &str = "Trust Folder";
const TRUST_PARENT: &str = "Trust Parent Folder";
const DONT_TRUST: &str = "Don't Trust";

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
    /// `None` until the user has decided for the folder or one of its parents.
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

/// The decision for the folder itself or, failing that, for its closest decided parent.
fn closest_decision(root: &Path, lookup: impl Fn(&str) -> Option<bool>) -> Option<bool> {
    root.ancestors()
        .find_map(|dir| lookup(dir.to_string_lossy().as_ref()))
}

fn stored_decision<R: Runtime>(app: &AppHandle<R>, root: &Path) -> Result<Option<bool>, String> {
    let store = load_store(app)?;
    Ok(closest_decision(root, |key| {
        store.get(key).and_then(|value| value.as_bool())
    }))
}

/// Stores the decision for `key` and drops the folder's own one so a parent decision applies.
fn store_decision<R: Runtime>(
    app: &AppHandle<R>,
    root: &Path,
    key: &Path,
    trusted: bool,
) -> Result<(), String> {
    let store = load_store(app)?;
    store.delete(root.to_string_lossy());
    store.set(
        key.to_string_lossy().into_owned(),
        serde_json::Value::Bool(trusted),
    );
    store
        .save()
        .map_err(|e| format!("Failed to save workspace trust: {e}"))
}

/// The parent offered for trust; never the file system root or the home folder.
fn trustable_parent(root: &Path, home: Option<&Path>) -> Option<PathBuf> {
    let parent = root.parent()?;
    if parent.parent().is_none() || Some(parent) == home {
        return None;
    }
    Some(parent.to_path_buf())
}

fn prompt_message(root: &Path, content: &TrustContent, parent: Option<&Path>) -> String {
    let mut lines = vec![
        root.display().to_string(),
        "In a trusted folder Pragma runs the folder's own extensions and worktree scripts, and the agent may run the commands its .pragma/settings.json allows without asking. In a folder you don't trust, Pragma opens the files but runs none of this.".to_string(),
    ];
    if !content.extensions.is_empty() {
        lines.push(format!("Extensions: {}", content.extensions.join(", ")));
    }
    if !content.scripts.is_empty() {
        lines.push(format!("Worktree scripts: {}", content.scripts.join(", ")));
    }
    if let Some(parent) = parent {
        lines.push(format!(
            "{TRUST_PARENT} trusts every folder in {}.",
            parent.display()
        ));
    }
    lines.join("\n\n")
}

/// Asks with a native dialog the webview cannot answer and stores the answer.
fn prompt_decision<R: Runtime>(app: &AppHandle<R>, root: &Path) -> Result<bool, String> {
    let home = app.path().home_dir().ok();
    let parent = trustable_parent(root, home.as_deref());
    let buttons = if parent.is_some() {
        MessageDialogButtons::YesNoCancelCustom(
            TRUST_FOLDER.to_string(),
            TRUST_PARENT.to_string(),
            DONT_TRUST.to_string(),
        )
    } else {
        MessageDialogButtons::OkCancelCustom(TRUST_FOLDER.to_string(), DONT_TRUST.to_string())
    };
    let result = app
        .dialog()
        .message(prompt_message(
            root,
            &trust_content(root),
            parent.as_deref(),
        ))
        .title("Do you trust the authors of the files in this folder?")
        .kind(MessageDialogKind::Warning)
        .buttons(buttons)
        .blocking_show_with_result();
    let (key, trusted) = match result {
        MessageDialogResult::Custom(label) if label == TRUST_FOLDER => (root.to_path_buf(), true),
        MessageDialogResult::Custom(label) if label == TRUST_PARENT => {
            (parent.unwrap_or_else(|| root.to_path_buf()), true)
        }
        _ => (root.to_path_buf(), false),
    };
    store_decision(app, root, &key, trusted)?;
    Ok(trusted)
}

/// The stored decision, or the answer to a prompt when the folder has none yet.
fn decide<R: Runtime>(app: &AppHandle<R>, root: &Path) -> Result<bool, String> {
    let _guard = PROMPT_LOCK
        .lock()
        .map_err(|_| "Workspace trust lock poisoned".to_string())?;
    match stored_decision(app, root)? {
        Some(trusted) => Ok(trusted),
        None => prompt_decision(app, root),
    }
}

/// Whether the folder may run its extensions and worktree scripts; asks once with a native
/// dialog the webview cannot answer. Must not run on the main thread.
pub(crate) fn ensure_trusted<R: Runtime>(app: &AppHandle<R>, root: &str) -> Result<bool, String> {
    let root = canonical_root(root)?;
    if trust_content(&root).is_empty() {
        return Ok(true);
    }
    decide(app, &root)
}

/// Marks a folder trusted after the user installed an extension into it.
pub(crate) fn trust_after_install<R: Runtime>(
    app: &AppHandle<R>,
    root: &str,
) -> Result<(), String> {
    let root = canonical_root(root)?;
    if stored_decision(app, &root)?.is_some() {
        return Ok(());
    }
    store_decision(app, &root, &root, true)
}

#[tauri::command(async)]
pub fn workspace_trust_status(app: AppHandle, root_path: String) -> Result<TrustStatus, String> {
    let root = canonical_root(&root_path)?;
    Ok(TrustStatus {
        trusted: stored_decision(&app, &root)?,
        content: trust_content(&root),
    })
}

/// Asks once when a folder opens, like the workspace trust prompt of other editors.
#[tauri::command]
pub async fn workspace_trust_request(app: AppHandle, root_path: String) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || decide(&app, &canonical_root(&root_path)?))
        .await
        .map_err(|e| format!("Workspace trust task failed: {e}"))?
}

/// Asks again even when a decision exists, so changing it always goes through the native dialog.
#[tauri::command]
pub async fn workspace_trust_change(app: AppHandle, root_path: String) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let root = canonical_root(&root_path)?;
        let _guard = PROMPT_LOCK
            .lock()
            .map_err(|_| "Workspace trust lock poisoned".to_string())?;
        prompt_decision(&app, &root)
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
    fn the_closest_decision_wins() {
        let lookup = |key: &str| match key {
            "/work" => Some(true),
            "/work/untrusted" => Some(false),
            _ => None,
        };
        assert_eq!(
            closest_decision(Path::new("/work/app/src"), lookup),
            Some(true)
        );
        assert_eq!(
            closest_decision(Path::new("/work/untrusted/app"), lookup),
            Some(false)
        );
        assert_eq!(closest_decision(Path::new("/elsewhere"), lookup), None);
    }

    #[test]
    fn never_offers_the_root_or_home_as_parent() {
        let home = Path::new("/Users/me");
        assert_eq!(
            trustable_parent(Path::new("/Users/me/dev/app"), Some(home)),
            Some(PathBuf::from("/Users/me/dev"))
        );
        assert_eq!(
            trustable_parent(Path::new("/Users/me/app"), Some(home)),
            None
        );
        assert_eq!(trustable_parent(Path::new("/app"), Some(home)), None);
    }

    #[test]
    fn relative_roots_are_rejected() {
        assert!(canonical_root("relative/folder").is_err());
    }
}
