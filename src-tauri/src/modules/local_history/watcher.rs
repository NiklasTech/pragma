use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use std::collections::HashMap;
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time::Instant;
use tauri::Manager;

use super::config::RetentionPolicy;
use super::storage::save_snapshot;

const DEBOUNCE_MS: u64 = 500;

pub struct LocalHistoryWatcher {
    watcher: RecommendedWatcher,
    last_event: Arc<Mutex<HashMap<String, Instant>>>,
    app_data_dir: std::path::PathBuf,
    repo_path: String,
    policy: RetentionPolicy,
}

impl LocalHistoryWatcher {
    pub fn new(
        app_handle: &tauri::AppHandle,
        repo_path: String,
        policy: RetentionPolicy,
    ) -> Result<Self, String> {
        let app_data_dir = app_handle
            .path()
            .app_data_dir()
            .map_err(|e| format!("Failed to resolve app data dir: {e}"))?;

        let last_event = Arc::new(Mutex::new(HashMap::<String, Instant>::new()));
        let last_event_clone = last_event.clone();
        let app_data_dir_clone = app_data_dir.clone();
        let repo_path_clone = repo_path.clone();
        let policy_clone = policy;

        let watcher = RecommendedWatcher::new(
            move |res: Result<Event, notify::Error>| {
                if let Ok(event) = res {
                    if event.kind.is_modify() || event.kind.is_create() {
                        for path in event.paths {
                            if let Some(path_str) = path.to_str() {
                                let file_path = path_str.to_string();
                                let mut map = last_event_clone.lock().unwrap();
                                let now = Instant::now();

                                if let Some(last) = map.get(&file_path) {
                                    if now.duration_since(*last).as_millis() < DEBOUNCE_MS as u128 {
                                        continue;
                                    }
                                }
                                map.insert(file_path.clone(), now);
                                drop(map);

                                let content = match std::fs::read_to_string(&path) {
                                    Ok(c) => c,
                                    Err(_) => continue,
                                };

                                let _ = save_snapshot(
                                    &app_data_dir_clone,
                                    &repo_path_clone,
                                    &file_path,
                                    &content,
                                    policy_clone,
                                );
                            }
                        }
                    }
                }
            },
            Config::default(),
        )
        .map_err(|e| format!("Failed to create watcher: {e}"))?;

        Ok(Self {
            watcher,
            last_event,
            app_data_dir,
            repo_path,
            policy,
        })
    }

    pub fn watch(&mut self, path: &Path) -> Result<(), String> {
        self.watcher
            .watch(path, RecursiveMode::Recursive)
            .map_err(|e| format!("Failed to watch path: {e}"))
    }

    pub fn unwatch(&mut self, path: &Path) -> Result<(), String> {
        self.watcher
            .unwatch(path)
            .map_err(|e| format!("Failed to unwatch path: {e}"))
    }

    pub fn app_data_dir(&self) -> &std::path::PathBuf {
        &self.app_data_dir
    }

    pub fn repo_path(&self) -> &str {
        &self.repo_path
    }

    pub fn policy(&self) -> RetentionPolicy {
        self.policy
    }
}
