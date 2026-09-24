use std::collections::HashMap;
use std::path::Path;

use super::types::RunConfig;

fn resolve_package_manager(workspace_root: &str) -> &'static str {
    let root = Path::new(workspace_root);
    if root.join("pnpm-lock.yaml").exists() {
        "pnpm"
    } else if root.join("yarn.lock").exists() {
        "yarn"
    } else if root.join("bun.lockb").exists() || root.join("bun.lock").exists() {
        "bun"
    } else {
        "npm"
    }
}

pub(super) fn detect_package_json_suggestions(workspace_root: &str) -> Vec<RunConfig> {
    let path = Path::new(workspace_root).join("package.json");
    if !path.exists() {
        return Vec::new();
    }

    let content = match std::fs::read_to_string(&path) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };

    let package: serde_json::Value = match serde_json::from_str(&content) {
        Ok(v) => v,
        Err(_) => return Vec::new(),
    };

    let scripts = package.get("scripts").and_then(|s| s.as_object());
    let scripts = match scripts {
        Some(s) => s,
        None => return Vec::new(),
    };

    let pm = resolve_package_manager(workspace_root);
    let mut suggestions = Vec::new();

    for script in ["dev", "start", "serve"] {
        if scripts.contains_key(script) {
            suggestions.push(RunConfig {
                id: None,
                name: script.to_string(),
                command: format!("{pm} run {script}"),
                cwd: None,
                env: HashMap::new(),
                autostart: false,
                auto_restart: false,
                icon: Some("terminal".to_string()),
                detect: Some("package.json".to_string()),
                debug: None,
            });
        }
    }

    suggestions
}

pub(super) fn detect_vite_suggestion(workspace_root: &str) -> Option<RunConfig> {
    let root = Path::new(workspace_root);
    let has_vite_config = std::fs::read_dir(root)
        .ok()?
        .filter_map(|e| e.ok())
        .any(|e| {
            let name = e.file_name();
            let name = name.to_string_lossy();
            name.starts_with("vite.config.")
        });

    if !has_vite_config {
        return None;
    }

    let pm = resolve_package_manager(workspace_root);
    Some(RunConfig {
        id: None,
        name: "vite".to_string(),
        command: format!("{pm} exec vite"),
        cwd: None,
        env: HashMap::new(),
        autostart: false,
        auto_restart: false,
        icon: Some("lightning".to_string()),
        detect: Some("vite.config.*".to_string()),
        debug: None,
    })
}

pub(super) fn detect_tauri_suggestion(workspace_root: &str) -> Option<RunConfig> {
    let root = Path::new(workspace_root);
    if !root.join("src-tauri").join("Cargo.toml").exists() {
        return None;
    }

    let pm = resolve_package_manager(workspace_root);
    Some(RunConfig {
        id: None,
        name: "tauri dev".to_string(),
        command: format!("{pm} tauri dev"),
        cwd: None,
        env: HashMap::new(),
        autostart: false,
        auto_restart: false,
        icon: Some("desktop".to_string()),
        detect: Some("src-tauri/Cargo.toml".to_string()),
        debug: None,
    })
}

pub(super) fn detect_python_suggestion(workspace_root: &str) -> Option<RunConfig> {
    let root = Path::new(workspace_root);
    let has_python_project =
        root.join("requirements.txt").exists() || root.join("pyproject.toml").exists();

    if !has_python_project {
        return None;
    }

    if root.join("manage.py").exists() {
        return Some(RunConfig {
            id: None,
            name: "django".to_string(),
            command: "python manage.py runserver".to_string(),
            cwd: None,
            env: HashMap::new(),
            autostart: false,
            auto_restart: false,
            icon: Some("snake".to_string()),
            detect: Some("manage.py".to_string()),
            debug: None,
        });
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn detect_package_json_suggestions_finds_dev_script() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path().join("package.json");
        let mut file = std::fs::File::create(&path).unwrap();
        file.write_all(br#"{"scripts": {"dev": "vite", "build": "tsc"}}"#)
            .unwrap();

        let suggestions = detect_package_json_suggestions(tmp.path().to_str().unwrap());
        assert_eq!(suggestions.len(), 1);
        assert_eq!(suggestions[0].name, "dev");
        assert_eq!(suggestions[0].command, "npm run dev");
        assert_eq!(suggestions[0].detect, Some("package.json".to_string()));
    }

    #[test]
    fn detect_vite_suggestion_uses_package_manager() {
        let tmp = tempfile::tempdir().unwrap();
        std::fs::File::create(tmp.path().join("vite.config.ts")).unwrap();
        std::fs::File::create(tmp.path().join("pnpm-lock.yaml")).unwrap();

        let suggestion = detect_vite_suggestion(tmp.path().to_str().unwrap()).unwrap();
        assert_eq!(suggestion.command, "pnpm exec vite");
    }

    #[test]
    fn detect_tauri_suggestion_requires_cargo_toml() {
        let tmp = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(tmp.path().join("src-tauri")).unwrap();
        std::fs::File::create(tmp.path().join("src-tauri").join("Cargo.toml")).unwrap();

        let suggestion = detect_tauri_suggestion(tmp.path().to_str().unwrap()).unwrap();
        assert_eq!(suggestion.name, "tauri dev");
        assert_eq!(suggestion.command, "npm tauri dev");
    }

    #[test]
    fn detect_python_suggestion_finds_django() {
        let tmp = tempfile::tempdir().unwrap();
        std::fs::File::create(tmp.path().join("requirements.txt")).unwrap();
        std::fs::File::create(tmp.path().join("manage.py")).unwrap();

        let suggestion = detect_python_suggestion(tmp.path().to_str().unwrap()).unwrap();
        assert_eq!(suggestion.command, "python manage.py runserver");
    }
}
