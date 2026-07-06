use std::path::{Component, Path, PathBuf};

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
    let path = Path::new(path);
    let absolute = if path.is_absolute() {
        path.to_path_buf()
    } else {
        std::env::current_dir()
            .map(|cwd| cwd.join(path))
            .unwrap_or_else(|_| path.to_path_buf())
    };
    normalize_path(&absolute).to_string_lossy().to_string()
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

#[cfg(test)]
mod tests {
    use super::*;

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
}
