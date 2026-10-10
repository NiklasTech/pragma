use std::collections::{BTreeSet, HashMap, HashSet};
use std::path::{Component, Path, PathBuf};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use ignore::gitignore::{Gitignore, GitignoreBuilder};
use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

const CHANGE_EVENT: &str = "workspace-fs-changed";
const QUIET_PERIOD: Duration = Duration::from_millis(200);
const MAX_BATCH_DELAY: Duration = Duration::from_secs(1);

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceFsChange {
    root: String,
    paths: Vec<String>,
}

struct WorkspaceWatch {
    root: String,
    _watcher: RecommendedWatcher,
}

/// One workspace watcher per window, keyed by window label.
#[derive(Default)]
pub struct WorkspaceWatchers(Mutex<HashMap<String, WorkspaceWatch>>);

impl WorkspaceWatchers {
    /// Drops the watcher of a closed window; dropping it also ends its debounce thread.
    pub fn remove_window(&self, label: &str) {
        if let Ok(mut watches) = self.0.lock() {
            watches.remove(label);
        }
    }
}

/// Maps watcher paths back to the root the frontend uses and drops ignored paths.
struct PathFilter {
    watched_root: PathBuf,
    display_root: PathBuf,
    gitignore: Gitignore,
}

impl PathFilter {
    fn new(watched_root: PathBuf, display_root: PathBuf) -> Self {
        let gitignore = load_gitignore(&watched_root);
        Self {
            watched_root,
            display_root,
            gitignore,
        }
    }

    fn reload_gitignore(&mut self) {
        self.gitignore = load_gitignore(&self.watched_root);
    }

    fn is_gitignore_file(&self, path: &Path) -> bool {
        path == self.watched_root.join(".gitignore")
    }

    fn display_path(&self, path: &Path) -> Option<String> {
        let relative = path.strip_prefix(&self.watched_root).ok()?;
        if relative.as_os_str().is_empty() {
            return None;
        }
        if matches!(relative.components().next(), Some(Component::Normal(name)) if name == ".git") {
            return None;
        }
        if self
            .gitignore
            .matched_path_or_any_parents(relative, path.is_dir())
            .is_ignore()
        {
            return None;
        }
        Some(
            self.display_root
                .join(relative)
                .to_string_lossy()
                .into_owned(),
        )
    }
}

fn load_gitignore(root: &Path) -> Gitignore {
    let mut builder = GitignoreBuilder::new(root);
    for file in [root.join(".gitignore"), root.join(".git/info/exclude")] {
        if file.is_file() {
            if let Some(err) = builder.add(&file) {
                log::warn!("failed to parse {}: {err}", file.display());
            }
        }
    }
    builder.build().unwrap_or_else(|e| {
        log::warn!("failed to build gitignore matcher: {e}");
        Gitignore::empty()
    })
}

fn validate_root(root: &str) -> Result<PathBuf, String> {
    let path = Path::new(root);
    if !path.is_absolute() {
        return Err("Path must be absolute".to_string());
    }
    if path.components().any(|c| matches!(c, Component::ParentDir)) {
        return Err("Path traversal is not allowed".to_string());
    }
    if !path.is_dir() {
        return Err(format!("Not a directory: {root}"));
    }
    Ok(path.to_path_buf())
}

/// Collects raw paths until the stream stays quiet, then emits one deduplicated batch.
fn debounce_loop(rx: Receiver<PathBuf>, mut filter: PathFilter, app: AppHandle, label: String) {
    let root = filter.display_root.to_string_lossy().into_owned();
    while let Ok(first) = rx.recv() {
        let mut batch = HashSet::from([first]);
        let deadline = Instant::now() + MAX_BATCH_DELAY;
        let mut disconnected = false;
        loop {
            let remaining = deadline.saturating_duration_since(Instant::now());
            if remaining.is_zero() {
                break;
            }
            match rx.recv_timeout(QUIET_PERIOD.min(remaining)) {
                Ok(path) => {
                    batch.insert(path);
                }
                Err(RecvTimeoutError::Timeout) => break,
                Err(RecvTimeoutError::Disconnected) => {
                    disconnected = true;
                    break;
                }
            }
        }

        if batch.iter().any(|path| filter.is_gitignore_file(path)) {
            filter.reload_gitignore();
        }
        let paths: BTreeSet<String> = batch
            .iter()
            .filter_map(|path| filter.display_path(path))
            .collect();
        if !paths.is_empty() {
            let payload = WorkspaceFsChange {
                root: root.clone(),
                paths: paths.into_iter().collect(),
            };
            if let Err(e) = app.emit_to(label.as_str(), CHANGE_EVENT, payload) {
                log::warn!("failed to emit workspace changes: {e}");
            }
        }
        if disconnected {
            return;
        }
    }
}

/// Watches the workspace root of the calling window and emits debounced
/// `workspace-fs-changed` events for paths that `.gitignore` does not exclude.
#[tauri::command(async)]
pub fn workspace_watch(app: AppHandle, window: tauri::Window, root: String) -> Result<(), String> {
    let display_root = validate_root(&root)?;
    let watched_root = std::fs::canonicalize(&display_root)
        .map_err(|e| format!("Failed to resolve workspace root: {e}"))?;
    let label = window.label().to_string();

    let (tx, rx) = mpsc::channel::<PathBuf>();
    let mut watcher = RecommendedWatcher::new(
        move |res: notify::Result<Event>| {
            let Ok(event) = res else { return };
            if matches!(event.kind, EventKind::Access(_)) {
                return;
            }
            for path in event.paths {
                let _ = tx.send(path);
            }
        },
        Config::default(),
    )
    .map_err(|e| format!("Failed to create file watcher: {e}"))?;
    watcher
        .watch(&watched_root, RecursiveMode::Recursive)
        .map_err(|e| format!("Failed to watch {root}: {e}"))?;

    let filter = PathFilter::new(watched_root, display_root);
    let thread_app = app.clone();
    let thread_label = label.clone();
    std::thread::Builder::new()
        .name("workspace-watcher".to_string())
        .spawn(move || debounce_loop(rx, filter, thread_app, thread_label))
        .map_err(|e| format!("Failed to start watcher thread: {e}"))?;

    let watchers = app.state::<WorkspaceWatchers>();
    let mut watches = watchers
        .0
        .lock()
        .map_err(|_| "Workspace watcher state is poisoned".to_string())?;
    watches.insert(
        label,
        WorkspaceWatch {
            root,
            _watcher: watcher,
        },
    );
    Ok(())
}

/// Stops the calling window's watcher if it still watches `root`.
#[tauri::command(async)]
pub fn workspace_unwatch(
    app: AppHandle,
    window: tauri::Window,
    root: String,
) -> Result<(), String> {
    let watchers = app.state::<WorkspaceWatchers>();
    let mut watches = watchers
        .0
        .lock()
        .map_err(|_| "Workspace watcher state is poisoned".to_string())?;
    if watches
        .get(window.label())
        .is_some_and(|watch| watch.root == root)
    {
        watches.remove(window.label());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn filter_for(dir: &Path) -> PathFilter {
        PathFilter::new(dir.to_path_buf(), PathBuf::from("/display/root"))
    }

    #[test]
    fn maps_paths_to_the_display_root() {
        let dir = tempfile::tempdir().unwrap();
        let filter = filter_for(dir.path());

        let mapped = filter.display_path(&dir.path().join("src").join("main.rs"));

        assert_eq!(
            mapped,
            Some(
                PathBuf::from("/display/root")
                    .join("src")
                    .join("main.rs")
                    .to_string_lossy()
                    .into_owned()
            )
        );
    }

    #[test]
    fn drops_root_git_dir_and_outside_paths() {
        let dir = tempfile::tempdir().unwrap();
        let filter = filter_for(dir.path());

        assert_eq!(filter.display_path(dir.path()), None);
        assert_eq!(
            filter.display_path(&dir.path().join(".git").join("index")),
            None
        );
        assert_eq!(filter.display_path(Path::new("/somewhere/else.txt")), None);
    }

    #[test]
    fn respects_gitignore_including_files_in_ignored_dirs() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(
            dir.path().join(".gitignore"),
            "node_modules/\ntarget/\n*.log\n",
        )
        .unwrap();
        fs::create_dir_all(dir.path().join("node_modules").join("pkg")).unwrap();
        let filter = filter_for(dir.path());

        let ignored = dir.path().join("node_modules").join("pkg").join("index.js");
        assert_eq!(filter.display_path(&ignored), None);
        assert_eq!(filter.display_path(&dir.path().join("debug.log")), None);
        assert!(filter.display_path(&dir.path().join("src.rs")).is_some());
    }

    #[test]
    fn reloads_gitignore_rules() {
        let dir = tempfile::tempdir().unwrap();
        let mut filter = filter_for(dir.path());
        let path = dir.path().join("out.txt");
        assert!(filter.display_path(&path).is_some());

        fs::write(dir.path().join(".gitignore"), "out.txt\n").unwrap();
        assert!(filter.is_gitignore_file(&dir.path().join(".gitignore")));
        filter.reload_gitignore();

        assert_eq!(filter.display_path(&path), None);
    }

    #[test]
    fn rejects_invalid_roots() {
        assert!(validate_root("relative/path").is_err());
        assert!(validate_root("/tmp/../etc").is_err());
    }
}
