use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

const CHANGE_EVENT: &str = "theme-files-changed";
const MAX_THEME_FILE_SIZE: u64 = 1024 * 1024;
const MAX_FILE_NAME_LEN: usize = 128;

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ThemeFileEntry {
    pub file_name: String,
    pub content: String,
}

/// Watches the themes folder once per app; every window listens to the same event.
#[derive(Default)]
pub struct ThemeFilesWatcher(Mutex<Option<RecommendedWatcher>>);

fn themes_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|dir| dir.join("themes"))
        .map_err(|e| format!("Failed to resolve app data dir: {e}"))
}

fn ensure_dir(dir: &Path) -> Result<(), String> {
    fs::create_dir_all(dir).map_err(|e| format!("Failed to create themes folder: {e}"))
}

/// Accepts only plain `.json` file names, so no path can leave the themes folder.
fn validate_file_name(name: &str) -> Result<(), String> {
    let stem = name
        .strip_suffix(".json")
        .ok_or_else(|| "Theme file names must end in .json".to_string())?;
    if stem.is_empty() || name.len() > MAX_FILE_NAME_LEN {
        return Err("Invalid theme file name".to_string());
    }
    if stem.starts_with('.')
        || !stem
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'))
    {
        return Err(
            "Theme file names may only contain letters, digits, '-', '_' and '.'".to_string(),
        );
    }
    Ok(())
}

fn validate_content(content: &str) -> Result<(), String> {
    if content.len() as u64 > MAX_THEME_FILE_SIZE {
        return Err("Theme file is larger than 1 MB".to_string());
    }
    let value: serde_json::Value =
        serde_json::from_str(content).map_err(|e| format!("Theme file is not valid JSON: {e}"))?;
    if !value.is_object() {
        return Err("Theme file must contain a JSON object".to_string());
    }
    Ok(())
}

fn list_in(dir: &Path) -> Result<Vec<ThemeFileEntry>, String> {
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut entries = Vec::new();
    for entry in fs::read_dir(dir).map_err(|e| format!("Failed to read themes folder: {e}"))? {
        let entry = entry.map_err(|e| format!("Failed to read themes folder entry: {e}"))?;
        let Some(file_name) = entry.file_name().to_str().map(str::to_string) else {
            continue;
        };
        if validate_file_name(&file_name).is_err() {
            continue;
        }
        // symlink_metadata keeps links from pointing the loader outside the folder.
        let Ok(meta) = fs::symlink_metadata(entry.path()) else {
            continue;
        };
        if !meta.is_file() || meta.len() > MAX_THEME_FILE_SIZE {
            continue;
        }
        let Ok(content) = fs::read_to_string(entry.path()) else {
            continue;
        };
        entries.push(ThemeFileEntry { file_name, content });
    }
    entries.sort_by(|a, b| a.file_name.cmp(&b.file_name));
    Ok(entries)
}

fn write_in(dir: &Path, file_name: &str, content: &str) -> Result<(), String> {
    validate_file_name(file_name)?;
    validate_content(content)?;
    ensure_dir(dir)?;
    let path = dir.join(file_name);
    if fs::symlink_metadata(&path).is_ok_and(|meta| !meta.is_file()) {
        return Err("Theme file path is not a regular file".to_string());
    }
    fs::write(path, content).map_err(|e| format!("Failed to write theme file: {e}"))
}

fn delete_in(dir: &Path, file_name: &str) -> Result<(), String> {
    validate_file_name(file_name)?;
    let path = dir.join(file_name);
    if !path.exists() {
        return Ok(());
    }
    fs::remove_file(path).map_err(|e| format!("Failed to delete theme file: {e}"))
}

fn is_theme_change(event: &Event) -> bool {
    matches!(
        event.kind,
        EventKind::Create(_) | EventKind::Modify(_) | EventKind::Remove(_)
    ) && event
        .paths
        .iter()
        .any(|path| path.extension().is_some_and(|ext| ext == "json"))
}

#[tauri::command(async)]
pub fn theme_files_list(app: AppHandle) -> Result<Vec<ThemeFileEntry>, String> {
    list_in(&themes_dir(&app)?)
}

#[tauri::command(async)]
pub fn theme_files_write(app: AppHandle, file_name: String, content: String) -> Result<(), String> {
    write_in(&themes_dir(&app)?, &file_name, &content)
}

#[tauri::command(async)]
pub fn theme_files_delete(app: AppHandle, file_name: String) -> Result<(), String> {
    delete_in(&themes_dir(&app)?, &file_name)
}

#[tauri::command(async)]
pub fn theme_files_open_folder(app: AppHandle) -> Result<(), String> {
    let dir = themes_dir(&app)?;
    ensure_dir(&dir)?;
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_path(dir.to_string_lossy().as_ref(), None::<&str>)
        .map_err(|e| e.to_string())
}

#[tauri::command(async)]
pub fn theme_files_watch(
    app: AppHandle,
    state: tauri::State<'_, ThemeFilesWatcher>,
) -> Result<(), String> {
    let mut slot = state
        .0
        .lock()
        .map_err(|_| "Theme watcher lock poisoned".to_string())?;
    if slot.is_some() {
        return Ok(());
    }
    let dir = themes_dir(&app)?;
    ensure_dir(&dir)?;
    let handle = app.clone();
    let mut watcher = RecommendedWatcher::new(
        move |res: notify::Result<Event>| {
            if res.is_ok_and(|event| is_theme_change(&event)) {
                let _ = handle.emit(CHANGE_EVENT, ());
            }
        },
        Config::default(),
    )
    .map_err(|e| format!("Failed to watch themes folder: {e}"))?;
    watcher
        .watch(&dir, RecursiveMode::NonRecursive)
        .map_err(|e| format!("Failed to watch themes folder: {e}"))?;
    *slot = Some(watcher);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_plain_json_file_names() {
        assert!(validate_file_name("my-theme.json").is_ok());
        assert!(validate_file_name("Nord_Copy.v2.json").is_ok());
    }

    #[test]
    fn rejects_paths_and_other_names() {
        for name in [
            "../evil.json",
            "sub/theme.json",
            "sub\\theme.json",
            ".hidden.json",
            ".json",
            "theme.txt",
            "theme",
            "the me.json",
        ] {
            assert!(validate_file_name(name).is_err(), "{name} was accepted");
        }
        assert!(validate_file_name(&format!("{}.json", "a".repeat(130))).is_err());
    }

    #[test]
    fn rejects_content_that_is_not_a_json_object() {
        assert!(validate_content("{\"format\":\"pragma-theme-v1\"}").is_ok());
        assert!(validate_content("[1, 2]").is_err());
        assert!(validate_content("{ nope").is_err());
    }

    #[test]
    fn writes_lists_and_deletes_theme_files() {
        let dir = tempfile::tempdir().unwrap();
        let themes = dir.path().join("themes");

        write_in(&themes, "b.json", "{\"b\":1}").unwrap();
        write_in(&themes, "a.json", "{\"a\":1}").unwrap();
        fs::write(themes.join("notes.txt"), "ignored").unwrap();

        let listed = list_in(&themes).unwrap();
        let names: Vec<&str> = listed.iter().map(|e| e.file_name.as_str()).collect();
        assert_eq!(names, ["a.json", "b.json"]);
        assert_eq!(listed[0].content, "{\"a\":1}");

        delete_in(&themes, "a.json").unwrap();
        delete_in(&themes, "missing.json").unwrap();
        assert_eq!(list_in(&themes).unwrap().len(), 1);
    }

    #[test]
    fn refuses_to_write_outside_the_folder() {
        let dir = tempfile::tempdir().unwrap();
        let themes = dir.path().join("themes");
        assert!(write_in(&themes, "../escape.json", "{}").is_err());
        assert!(!dir.path().join("escape.json").exists());
        assert!(delete_in(&themes, "../escape.json").is_err());
    }

    #[test]
    fn reacts_only_to_json_file_changes() {
        use notify::event::{CreateKind, ModifyKind};
        let event = |kind, path: &str| Event::new(kind).add_path(PathBuf::from(path));
        assert!(is_theme_change(&event(
            EventKind::Modify(ModifyKind::Any),
            "/t/a.json"
        )));
        assert!(is_theme_change(&event(
            EventKind::Create(CreateKind::File),
            "/t/b.json"
        )));
        assert!(!is_theme_change(&event(
            EventKind::Modify(ModifyKind::Any),
            "/t/a.json.swp"
        )));
        assert!(!is_theme_change(&event(
            EventKind::Access(notify::event::AccessKind::Any),
            "/t/a.json"
        )));
    }

    #[test]
    fn lists_nothing_for_a_missing_folder() {
        let dir = tempfile::tempdir().unwrap();
        assert!(list_in(&dir.path().join("themes")).unwrap().is_empty());
    }

    #[cfg(unix)]
    #[test]
    fn skips_symlinks() {
        let dir = tempfile::tempdir().unwrap();
        let themes = dir.path().join("themes");
        fs::create_dir_all(&themes).unwrap();
        let outside = dir.path().join("secret.json");
        fs::write(&outside, "{}").unwrap();
        std::os::unix::fs::symlink(&outside, themes.join("link.json")).unwrap();
        assert!(list_in(&themes).unwrap().is_empty());
        assert!(write_in(&themes, "link.json", "{\"x\":1}").is_err());
        assert_eq!(fs::read_to_string(&outside).unwrap(), "{}");
    }
}
