use std::path::{Component, Path, PathBuf};

use tauri::{Emitter, Manager};

#[derive(Default)]
pub struct CliArgs {
    pub project_path: Option<String>,
}

#[tauri::command]
pub fn get_cli_project_path(
    window: tauri::Window,
    cli_args: tauri::State<CliArgs>,
) -> Result<Option<String>, String> {
    if window.label() != "main" {
        return Ok(None);
    }
    Ok(cli_args.project_path.clone())
}

pub fn extract_project_path(matches: &tauri_plugin_cli::Matches) -> Option<String> {
    matches
        .args
        .get("path")
        .and_then(|arg| arg.value.as_str())
        .map(normalize_project_path)
}

fn normalize_project_path(path: &str) -> String {
    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    normalize_project_path_with_cwd(path, &cwd.to_string_lossy())
}

fn normalize_project_path_with_cwd(path: &str, cwd: &str) -> String {
    let path = Path::new(path);
    let absolute = if path.is_absolute() {
        path.to_path_buf()
    } else {
        Path::new(cwd).join(path)
    };
    normalize_path(&absolute).to_string_lossy().to_string()
}

/// Extracts the project path from a second instance's raw argv, resolving
/// relative paths against the second instance's working directory.
pub fn resolve_second_instance_path(argv: &[String], cwd: &str) -> Option<String> {
    argv.iter()
        .skip(1)
        .find(|arg| !arg.starts_with('-'))
        .map(|path| normalize_project_path_with_cwd(path, cwd))
}

fn normalize_path(path: &Path) -> PathBuf {
    let mut result = PathBuf::new();
    for component in path.components() {
        match component {
            Component::CurDir => {}
            Component::ParentDir => {
                if !result.pop() {
                    result.push(component);
                }
            }
            _ => result.push(component),
        }
    }
    result
}

/// Handles args forwarded by the single-instance plugin: opens the given
/// folder in a new workspace window, or focuses the main window.
pub fn handle_second_instance(app: &tauri::AppHandle, argv: &[String], cwd: &str) {
    let Some(path) = resolve_second_instance_path(argv, cwd) else {
        focus_main_window(app);
        return;
    };

    if !std::path::Path::new(&path).is_dir() {
        log::warn!("ignoring non-directory path from second instance: {path}");
        if let Err(err) = app.emit_to(
            "main",
            "pragma:cli:invalid-path",
            serde_json::json!({ "path": path }),
        ) {
            log::warn!("failed to emit invalid-path event: {err}");
        }
        focus_main_window(app);
        return;
    }

    if let Err(err) = crate::window::create_workspace_window(app, &path) {
        log::error!("failed to create workspace window: {err}");
        focus_main_window(app);
    }
}

fn focus_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extract_project_path_reads_positional_alongside_flags() {
        let absolute = if cfg!(target_os = "windows") {
            "C:\\projects\\pragma"
        } else {
            "/home/user/projects/pragma"
        };
        let mut path_arg = tauri_plugin_cli::ArgData::default();
        path_arg.value = serde_json::Value::String(absolute.to_string());
        path_arg.occurrences = 1;
        let mut flag_arg = tauri_plugin_cli::ArgData::default();
        flag_arg.value = serde_json::Value::Bool(true);
        let mut matches = tauri_plugin_cli::Matches::default();
        matches.args.insert("path".to_string(), path_arg);
        matches.args.insert("some-flag".to_string(), flag_arg);
        assert_eq!(extract_project_path(&matches), Some(absolute.to_string()));
    }

    #[test]
    fn extract_project_path_returns_none_without_positional() {
        let matches = tauri_plugin_cli::Matches::default();
        assert_eq!(extract_project_path(&matches), None);
    }

    #[test]
    fn normalize_project_path_keeps_absolute_path() {
        let path = if cfg!(target_os = "windows") {
            "C:\\projects\\pragma"
        } else {
            "/home/user/projects/pragma"
        };
        assert_eq!(normalize_project_path(path), path);
    }

    #[test]
    fn normalize_project_path_resolves_dot_to_current_dir() {
        let cwd = std::env::current_dir().unwrap();
        assert_eq!(normalize_project_path("."), cwd.to_string_lossy());
    }

    #[test]
    fn normalize_project_path_resolves_relative_path() {
        let cwd = std::env::current_dir().unwrap();
        let expected = cwd.join("src").to_string_lossy().to_string();
        assert_eq!(normalize_project_path("src"), expected);
    }

    #[test]
    fn normalize_project_path_resolves_parent_dir() {
        let cwd = std::env::current_dir().unwrap();
        let expected = cwd.parent().unwrap_or(&cwd).to_string_lossy().to_string();
        assert_eq!(normalize_project_path(".."), expected);
    }

    #[test]
    fn normalize_path_removes_current_dir_components() {
        let input = Path::new("/foo/./bar");
        assert_eq!(normalize_path(input), Path::new("/foo/bar"));
    }

    #[test]
    fn normalize_path_resolves_parent_dir_components() {
        let input = Path::new("/foo/bar/../baz");
        assert_eq!(normalize_path(input), Path::new("/foo/baz"));
    }

    #[test]
    fn resolve_second_instance_path_returns_none_without_positional_arg() {
        let argv = vec!["pragma".to_string()];
        assert_eq!(resolve_second_instance_path(&argv, "/tmp"), None);
    }

    #[test]
    fn resolve_second_instance_path_skips_flags() {
        let argv = vec!["pragma".to_string(), "--verbose".to_string()];
        assert_eq!(resolve_second_instance_path(&argv, "/tmp"), None);
    }

    #[test]
    fn resolve_second_instance_path_resolves_dot_against_given_cwd() {
        let argv = vec!["pragma".to_string(), ".".to_string()];
        let cwd = if cfg!(target_os = "windows") {
            "C:\\projects"
        } else {
            "/home/user/projects"
        };
        assert_eq!(
            resolve_second_instance_path(&argv, cwd),
            Some(cwd.to_string())
        );
    }

    #[test]
    fn resolve_second_instance_path_resolves_relative_against_given_cwd() {
        let argv = vec!["pragma".to_string(), "src".to_string()];
        let (cwd, expected) = if cfg!(target_os = "windows") {
            ("C:\\projects", "C:\\projects\\src")
        } else {
            ("/home/user/projects", "/home/user/projects/src")
        };
        assert_eq!(
            resolve_second_instance_path(&argv, cwd),
            Some(expected.to_string())
        );
    }

    #[test]
    fn resolve_second_instance_path_finds_positional_after_flags() {
        let absolute = if cfg!(target_os = "windows") {
            "C:\\projects\\pragma"
        } else {
            "/home/user/projects/pragma"
        };
        let argv = vec![
            "pragma".to_string(),
            "--some-flag".to_string(),
            absolute.to_string(),
        ];
        assert_eq!(
            resolve_second_instance_path(&argv, "/ignored"),
            Some(absolute.to_string())
        );
    }

    // Intentional: a positional starting with '-' is treated as a flag and skipped.
    #[test]
    fn resolve_second_instance_path_skips_positional_starting_with_dash() {
        let argv = vec!["pragma".to_string(), "-path-like-arg".to_string()];
        assert_eq!(resolve_second_instance_path(&argv, "/tmp"), None);
    }

    #[test]
    fn resolve_second_instance_path_keeps_absolute_path() {
        let absolute = if cfg!(target_os = "windows") {
            "C:\\projects\\pragma"
        } else {
            "/home/user/projects/pragma"
        };
        let argv = vec!["pragma".to_string(), absolute.to_string()];
        assert_eq!(
            resolve_second_instance_path(&argv, "/ignored"),
            Some(absolute.to_string())
        );
    }
}
