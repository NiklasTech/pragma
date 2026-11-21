use std::collections::{BTreeSet, HashMap, HashSet};
use std::path::{Component, Path, PathBuf};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use ignore::gitignore::{Gitignore, GitignoreBuilder};
use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

use crate::modules::git::state_paths::GitStateDirs;

const CHANGE_EVENT: &str = "workspace-fs-changed";
const GIT_CHANGE_EVENT: &str = "workspace-git-changed";
const QUIET_PERIOD: Duration = Duration::from_millis(200);
const MAX_BATCH_DELAY: Duration = Duration::from_secs(1);

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceFsChange {
    root: String,
    paths: Vec<String>,
}

#[derive(Clone, Serialize)]
struct WorkspaceGitChange {
    root: String,
}

/// One watcher per window and workspace root, keyed by window label and root.
#[derive(Default)]
pub struct WorkspaceWatchers(Mutex<HashMap<(String, String), RecommendedWatcher>>);

impl WorkspaceWatchers {
    /// Drops the watchers of a closed window; dropping one also ends its debounce thread.
    pub fn remove_window(&self, label: &str) {
        if let Ok(mut watches) = self.0.lock() {
            watches.retain(|(window, _), _| window != label);
        }
    }
}

/// Maps watcher paths back to the root the frontend uses and drops ignored paths.
struct PathFilter {
    watched_root: PathBuf,
    display_root: PathBuf,
    gitignore: Gitignore,
    /// `.gitignore` files of folders below the root, loaded the first time a path passes through.
    nested: HashMap<PathBuf, Option<Gitignore>>,
}

impl PathFilter {
    fn new(watched_root: PathBuf, display_root: PathBuf) -> Self {
        let gitignore = load_gitignore(&watched_root);
        Self {
            watched_root,
            display_root,
            gitignore,
            nested: HashMap::new(),
        }
    }

    /// Picks up the new rules of a `.gitignore` file that changed.
    fn reload_gitignore(&mut self, file: &Path) {
        match file.parent() {
            Some(dir) if dir == self.watched_root => {
                self.gitignore = load_gitignore(&self.watched_root)
            }
            Some(dir) => {
                self.nested.remove(dir);
            }
            None => {}
        }
    }

    fn is_gitignore_file(&self, path: &Path) -> bool {
        path.starts_with(&self.watched_root)
            && path.file_name().is_some_and(|name| name == ".gitignore")
    }

    fn matcher(&mut self, dir: &Path) -> Option<&Gitignore> {
        if dir == self.watched_root {
            return Some(&self.gitignore);
        }
        self.nested
            .entry(dir.to_path_buf())
            .or_insert_with(|| load_dir_gitignore(dir))
            .as_ref()
    }

    /// Whether the `.gitignore` files of `dirs` ignore `path`; the deepest file with a matching
    /// rule decides, as in git.
    fn is_ignored(&mut self, path: &Path, is_dir: bool, dirs: &[PathBuf]) -> bool {
        for dir in dirs.iter().rev() {
            let Some(matcher) = self.matcher(dir) else {
                continue;
            };
            let decision = matcher.matched(path, is_dir);
            if decision.is_ignore() {
                return true;
            }
            if decision.is_whitelist() {
                return false;
            }
        }
        false
    }

    fn display_path(&mut self, path: &Path) -> Option<String> {
        let relative = path.strip_prefix(&self.watched_root).ok()?.to_path_buf();
        if relative.as_os_str().is_empty() {
            return None;
        }
        if matches!(relative.components().next(), Some(Component::Normal(name)) if name == ".git") {
            return None;
        }
        // Git reads no rules below an ignored folder, so each parent folder is checked first.
        let mut dirs = vec![self.watched_root.clone()];
        let mut parents = relative.components();
        parents.next_back();
        for component in parents {
            let dir = dirs[dirs.len() - 1].join(component);
            if self.is_ignored(&dir, true, &dirs) {
                return None;
            }
            dirs.push(dir);
        }
        if self.is_ignored(path, path.is_dir(), &dirs) {
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

fn load_dir_gitignore(dir: &Path) -> Option<Gitignore> {
    let file = dir.join(".gitignore");
    if !file.is_file() {
        return None;
    }
    let mut builder = GitignoreBuilder::new(dir);
    if let Some(err) = builder.add(&file) {
        log::warn!("failed to parse {}: {err}", file.display());
    }
    builder
        .build()
        .map_err(|e| log::warn!("failed to build gitignore matcher: {e}"))
        .ok()
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

/// Collects raw paths until the stream stays quiet, then emits one deduplicated batch
/// and, if the batch touches git state, one git change.
fn debounce_loop(
    rx: Receiver<PathBuf>,
    mut filter: PathFilter,
    git_state: Option<GitStateDirs>,
    app: AppHandle,
    label: String,
) {
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

        let changed_rules: Vec<PathBuf> = batch
            .iter()
            .filter(|path| filter.is_gitignore_file(path))
            .cloned()
            .collect();
        for file in &changed_rules {
            filter.reload_gitignore(file);
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
        if git_state
            .as_ref()
            .is_some_and(|state| batch.iter().any(|path| state.is_state_path(path)))
        {
            let payload = WorkspaceGitChange { root: root.clone() };
            if let Err(e) = app.emit_to(label.as_str(), GIT_CHANGE_EVENT, payload) {
                log::warn!("failed to emit git state changes: {e}");
            }
        }
        if disconnected {
            return;
        }
    }
}

/// Watches a workspace root of the calling window and emits debounced
/// `workspace-fs-changed` events for paths that `.gitignore` does not exclude,
/// plus `workspace-git-changed` when HEAD, the index or refs change.
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
    let git_state = GitStateDirs::resolve(&watched_root);
    for (path, recursive) in git_state
        .iter()
        .flat_map(|state| state.extra_watches(&watched_root))
    {
        let mode = if recursive {
            RecursiveMode::Recursive
        } else {
            RecursiveMode::NonRecursive
        };
        if let Err(e) = watcher.watch(&path, mode) {
            log::warn!("failed to watch git dir {}: {e}", path.display());
        }
    }

    let filter = PathFilter::new(watched_root, display_root);
    let thread_app = app.clone();
    let thread_label = label.clone();
    std::thread::Builder::new()
        .name("workspace-watcher".to_string())
        .spawn(move || debounce_loop(rx, filter, git_state, thread_app, thread_label))
        .map_err(|e| format!("Failed to start watcher thread: {e}"))?;

    let watchers = app.state::<WorkspaceWatchers>();
    let mut watches = watchers
        .0
        .lock()
        .map_err(|_| "Workspace watcher state is poisoned".to_string())?;
    watches.insert((label, root), watcher);
    Ok(())
}

/// Stops the calling window's watcher of `root`.
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
    watches.remove(&(window.label().to_string(), root));
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
        let mut filter = filter_for(dir.path());

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
        let mut filter = filter_for(dir.path());

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
        let mut filter = filter_for(dir.path());

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
        filter.reload_gitignore(&dir.path().join(".gitignore"));

        assert_eq!(filter.display_path(&path), None);
    }

    #[test]
    fn respects_gitignore_files_in_subfolders() {
        let dir = tempfile::tempdir().unwrap();
        let crate_dir = dir.path().join("src-tauri");
        fs::create_dir_all(crate_dir.join("target").join("debug")).unwrap();
        fs::write(crate_dir.join(".gitignore"), "/target/\n").unwrap();
        let mut filter = filter_for(dir.path());

        let built = crate_dir.join("target").join("debug").join("app.o");
        assert_eq!(filter.display_path(&built), None);
        assert!(filter
            .display_path(&crate_dir.join("src").join("lib.rs"))
            .is_some());
        assert!(filter
            .display_path(&dir.path().join("target").join("x.o"))
            .is_some());
    }

    #[test]
    fn a_subfolder_gitignore_can_whitelist_a_file() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join(".gitignore"), "*.log\n").unwrap();
        fs::create_dir_all(dir.path().join("logs")).unwrap();
        fs::write(dir.path().join("logs").join(".gitignore"), "!keep.log\n").unwrap();
        let mut filter = filter_for(dir.path());

        assert!(filter
            .display_path(&dir.path().join("logs").join("keep.log"))
            .is_some());
        assert_eq!(
            filter.display_path(&dir.path().join("logs").join("other.log")),
            None
        );
    }

    #[test]
    fn rules_below_an_ignored_folder_do_not_apply() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join(".gitignore"), "vendor/\n").unwrap();
        fs::create_dir_all(dir.path().join("vendor")).unwrap();
        fs::write(dir.path().join("vendor").join(".gitignore"), "!*\n").unwrap();
        let mut filter = filter_for(dir.path());

        assert_eq!(
            filter.display_path(&dir.path().join("vendor").join("lib.js")),
            None
        );
    }

    #[test]
    fn reloads_a_changed_subfolder_gitignore() {
        let dir = tempfile::tempdir().unwrap();
        let sub = dir.path().join("pkg");
        fs::create_dir_all(&sub).unwrap();
        let mut filter = filter_for(dir.path());
        let path = sub.join("dist.js");
        assert!(filter.display_path(&path).is_some());

        let rules = sub.join(".gitignore");
        fs::write(&rules, "dist.js\n").unwrap();
        assert!(filter.is_gitignore_file(&rules));
        filter.reload_gitignore(&rules);

        assert_eq!(filter.display_path(&path), None);
    }

    #[test]
    fn rejects_invalid_roots() {
        assert!(validate_root("relative/path").is_err());
        assert!(validate_root("/tmp/../etc").is_err());
    }
}
