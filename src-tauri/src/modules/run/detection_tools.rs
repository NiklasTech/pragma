//! Run configuration suggestions for build tools: Cargo without Tauri, Go
//! modules, Makefile and justfile targets, and Docker Compose services.

use std::collections::HashMap;
use std::path::Path;

use super::types::{DebugConfig, RunConfig};

// Large Makefiles or justfiles would flood the suggestion list.
const MAX_TARGETS: usize = 20;
const MAKEFILE_NAMES: [&str; 3] = ["GNUmakefile", "makefile", "Makefile"];
const JUSTFILE_NAMES: [&str; 3] = ["justfile", "Justfile", ".justfile"];
const COMPOSE_NAMES: [&str; 4] = [
    "compose.yaml",
    "compose.yml",
    "docker-compose.yaml",
    "docker-compose.yml",
];
const JUST_KEYWORDS: [&str; 6] = ["set", "alias", "export", "import", "mod", "unexport"];

fn suggestion(
    name: String,
    command: String,
    icon: &str,
    detect: &str,
    debug: Option<DebugConfig>,
) -> RunConfig {
    RunConfig {
        id: None,
        name,
        command,
        cwd: None,
        env: HashMap::new(),
        autostart: false,
        auto_restart: false,
        icon: Some(icon.to_string()),
        detect: Some(detect.to_string()),
        debug,
    }
}

/// Matches directory entries exactly, so case-insensitive file systems report the real name.
fn first_existing<'a>(root: &Path, names: &[&'a str]) -> Option<(&'a str, String)> {
    let entries: Vec<String> = std::fs::read_dir(root)
        .ok()?
        .filter_map(|e| e.ok())
        .map(|e| e.file_name().to_string_lossy().to_string())
        .collect();
    names
        .iter()
        .filter(|name| entries.iter().any(|entry| entry == *name))
        .find_map(|name| {
            let content = std::fs::read_to_string(root.join(name)).ok()?;
            Some((*name, content))
        })
}

fn is_toml_header(line: &str, header: &str) -> bool {
    line.trim() == header
}

/// True when the manifest declares a `tauri` dependency in any section.
fn depends_on_tauri(manifest: &str) -> bool {
    manifest.lines().map(str::trim).any(|line| {
        line.starts_with("[dependencies.tauri]")
            || line
                .strip_prefix("tauri")
                .is_some_and(|rest| rest.trim_start().starts_with('='))
    })
}

pub(super) fn detect_cargo_suggestions(workspace_root: &str) -> Vec<RunConfig> {
    let root = Path::new(workspace_root);
    let Ok(manifest) = std::fs::read_to_string(root.join("Cargo.toml")) else {
        return Vec::new();
    };
    if depends_on_tauri(&manifest) || root.join("src-tauri").join("Cargo.toml").exists() {
        return Vec::new();
    }

    let has_package = manifest.lines().any(|l| is_toml_header(l, "[package]"));
    let has_workspace = manifest.lines().any(|l| is_toml_header(l, "[workspace]"));
    let mut suggestions = Vec::new();
    // A virtual workspace manifest has no binary that `cargo run` could pick.
    if has_package {
        suggestions.push(suggestion(
            "cargo run".to_string(),
            "cargo run".to_string(),
            "terminal",
            "Cargo.toml",
            None,
        ));
    }
    if has_package || has_workspace {
        let command = if has_workspace {
            "cargo test --workspace"
        } else {
            "cargo test"
        };
        suggestions.push(suggestion(
            "cargo test".to_string(),
            command.to_string(),
            "terminal",
            "Cargo.toml",
            None,
        ));
    }
    suggestions
}

fn has_main_package(dir: &Path) -> bool {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return false;
    };
    entries.filter_map(|e| e.ok()).any(|entry| {
        let path = entry.path();
        let is_go_source = path.extension().is_some_and(|ext| ext == "go")
            && !path.to_string_lossy().ends_with("_test.go");
        is_go_source
            && std::fs::read_to_string(&path)
                .is_ok_and(|content| content.lines().any(|line| line.trim() == "package main"))
    })
}

fn go_debug() -> Option<DebugConfig> {
    Some(DebugConfig {
        adapter: "go".to_string(),
        request: Some("launch".to_string()),
        ..DebugConfig::default()
    })
}

pub(super) fn detect_go_suggestions(workspace_root: &str) -> Vec<RunConfig> {
    let root = Path::new(workspace_root);
    if !root.join("go.mod").is_file() {
        return Vec::new();
    }

    let mut suggestions = Vec::new();
    if has_main_package(root) {
        suggestions.push(suggestion(
            "go run".to_string(),
            "go run .".to_string(),
            "terminal",
            "go.mod",
            go_debug(),
        ));
    }

    if let Ok(entries) = std::fs::read_dir(root.join("cmd")) {
        let mut commands: Vec<String> = entries
            .filter_map(|e| e.ok())
            .filter(|e| e.path().is_dir() && has_main_package(&e.path()))
            .map(|e| e.file_name().to_string_lossy().to_string())
            .collect();
        commands.sort();
        for name in commands.into_iter().take(MAX_TARGETS) {
            suggestions.push(suggestion(
                format!("go run {name}"),
                format!("go run ./cmd/{name}"),
                "terminal",
                "go.mod",
                go_debug(),
            ));
        }
    }

    suggestions.push(suggestion(
        "go test".to_string(),
        "go test ./...".to_string(),
        "terminal",
        "go.mod",
        None,
    ));
    suggestions
}

/// Explicit Makefile targets, without special (`.PHONY`) or pattern (`%.o`) rules.
fn make_targets(content: &str) -> Vec<String> {
    let mut targets = Vec::new();
    for line in content.lines() {
        if line.starts_with(['\t', ' ', '#', '.']) {
            continue;
        }
        let Some((head, rest)) = line.split_once(':') else {
            continue;
        };
        // `a := b` and `a ::= b` are variable assignments, not rules.
        if rest.starts_with('=') || rest.starts_with(":=") || head.contains('=') {
            continue;
        }
        for target in head.split_whitespace() {
            let valid = target
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '-' | '.' | '/'));
            if valid && !targets.iter().any(|t| t == target) {
                targets.push(target.to_string());
            }
        }
    }
    targets.truncate(MAX_TARGETS);
    targets
}

pub(super) fn detect_make_suggestions(workspace_root: &str) -> Vec<RunConfig> {
    let Some((file, content)) = first_existing(Path::new(workspace_root), &MAKEFILE_NAMES) else {
        return Vec::new();
    };
    make_targets(&content)
        .into_iter()
        .map(|target| {
            suggestion(
                format!("make {target}"),
                format!("make {target}"),
                "terminal",
                file,
                None,
            )
        })
        .collect()
}

/// Recipes that run without arguments; private ones (`_name`, `[private]`) are skipped.
fn just_recipes(content: &str) -> Vec<String> {
    let mut recipes = Vec::new();
    let mut private_attribute = false;
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        if line.starts_with(char::is_whitespace) {
            private_attribute = false;
            continue;
        }
        if trimmed.starts_with('[') {
            private_attribute |= trimmed.contains("private");
            continue;
        }
        let private = std::mem::take(&mut private_attribute);

        let Some((head, rest)) = trimmed.split_once(':') else {
            continue;
        };
        if rest.starts_with('=') {
            continue;
        }
        let head = head.trim_start_matches('@');
        let mut parts = head.split_whitespace();
        let Some(name) = parts.next() else {
            continue;
        };
        if JUST_KEYWORDS.contains(&name) || name.starts_with('_') || private {
            continue;
        }
        let valid_name = name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-');
        let runs_without_args = parts.all(|param| param.contains('=') || param.starts_with('*'));
        if valid_name && runs_without_args && !recipes.iter().any(|r| r == name) {
            recipes.push(name.to_string());
        }
    }
    recipes.truncate(MAX_TARGETS);
    recipes
}

pub(super) fn detect_just_suggestions(workspace_root: &str) -> Vec<RunConfig> {
    let Some((file, content)) = first_existing(Path::new(workspace_root), &JUSTFILE_NAMES) else {
        return Vec::new();
    };
    just_recipes(&content)
        .into_iter()
        .map(|recipe| {
            suggestion(
                format!("just {recipe}"),
                format!("just {recipe}"),
                "terminal",
                file,
                None,
            )
        })
        .collect()
}

fn indentation(line: &str) -> usize {
    line.len() - line.trim_start().len()
}

/// Service names under the top-level `services:` key of a Compose file.
fn compose_services(content: &str) -> Vec<String> {
    let mut services = Vec::new();
    let mut in_services = false;
    let mut service_indent: Option<usize> = None;
    for line in content.lines() {
        let trimmed = line.trim_end();
        if trimmed.trim().is_empty() || trimmed.trim_start().starts_with('#') {
            continue;
        }
        if indentation(trimmed) == 0 {
            in_services = trimmed.starts_with("services:");
            service_indent = None;
            continue;
        }
        if !in_services {
            continue;
        }
        let indent = indentation(trimmed);
        let level = *service_indent.get_or_insert(indent);
        if indent != level {
            continue;
        }
        let Some(name) = trimmed.trim().strip_suffix(':') else {
            continue;
        };
        let name = name.trim_matches(['"', '\'']);
        let valid = !name.is_empty()
            && name
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '-' | '.'));
        if valid {
            services.push(name.to_string());
        }
    }
    services.truncate(MAX_TARGETS);
    services
}

pub(super) fn detect_compose_suggestions(workspace_root: &str) -> Vec<RunConfig> {
    let Some((file, content)) = first_existing(Path::new(workspace_root), &COMPOSE_NAMES) else {
        return Vec::new();
    };
    let services = compose_services(&content);
    if services.is_empty() {
        return Vec::new();
    }

    let mut suggestions = vec![suggestion(
        "compose up".to_string(),
        "docker compose up".to_string(),
        "terminal",
        file,
        None,
    )];
    if services.len() > 1 {
        suggestions.extend(services.into_iter().map(|service| {
            suggestion(
                format!("compose up {service}"),
                format!("docker compose up {service}"),
                "terminal",
                file,
                None,
            )
        }));
    }
    suggestions
}

#[cfg(test)]
mod tests {
    use super::*;

    fn workspace(files: &[(&str, &str)]) -> tempfile::TempDir {
        let tmp = tempfile::tempdir().unwrap();
        for (path, content) in files {
            let full = tmp.path().join(path);
            std::fs::create_dir_all(full.parent().unwrap()).unwrap();
            std::fs::write(full, content).unwrap();
        }
        tmp
    }

    fn names(configs: &[RunConfig]) -> Vec<&str> {
        configs.iter().map(|c| c.name.as_str()).collect()
    }

    #[test]
    fn cargo_package_gets_run_and_test() {
        let tmp = workspace(&[(
            "Cargo.toml",
            "[package]\nname = \"app\"\n\n[dependencies]\nserde = \"1\"\n",
        )]);
        let configs = detect_cargo_suggestions(tmp.path().to_str().unwrap());
        assert_eq!(names(&configs), ["cargo run", "cargo test"]);
        assert_eq!(configs[1].command, "cargo test");
    }

    #[test]
    fn cargo_virtual_workspace_only_tests() {
        let tmp = workspace(&[("Cargo.toml", "[workspace]\nmembers = [\"a\"]\n")]);
        let configs = detect_cargo_suggestions(tmp.path().to_str().unwrap());
        assert_eq!(names(&configs), ["cargo test"]);
        assert_eq!(configs[0].command, "cargo test --workspace");
    }

    #[test]
    fn cargo_skips_tauri_projects() {
        let tmp = workspace(&[(
            "Cargo.toml",
            "[package]\nname = \"app\"\n[dependencies]\ntauri = { version = \"2\" }\n",
        )]);
        assert!(detect_cargo_suggestions(tmp.path().to_str().unwrap()).is_empty());

        let tmp = workspace(&[
            ("Cargo.toml", "[workspace]\nmembers = [\"src-tauri\"]\n"),
            ("src-tauri/Cargo.toml", "[package]\nname = \"app\"\n"),
        ]);
        assert!(detect_cargo_suggestions(tmp.path().to_str().unwrap()).is_empty());
    }

    #[test]
    fn tauri_dependency_detection_ignores_similar_crates() {
        assert!(depends_on_tauri("tauri = \"2\""));
        assert!(depends_on_tauri("[dependencies.tauri]\nversion = \"2\""));
        assert!(!depends_on_tauri("tauri-plugin-log = \"2\""));
    }

    #[test]
    fn go_module_suggests_main_packages_and_tests() {
        let tmp = workspace(&[
            ("go.mod", "module example.com/app\n"),
            ("main.go", "package main\n\nfunc main() {}\n"),
            ("cmd/worker/main.go", "package main\n"),
            ("cmd/lib/lib.go", "package lib\n"),
        ]);
        let configs = detect_go_suggestions(tmp.path().to_str().unwrap());
        assert_eq!(names(&configs), ["go run", "go run worker", "go test"]);
        assert_eq!(configs[1].command, "go run ./cmd/worker");
        assert_eq!(configs[0].debug.as_ref().unwrap().adapter, "go");
        assert!(configs[2].debug.is_none());
    }

    #[test]
    fn go_library_only_gets_tests() {
        let tmp = workspace(&[("go.mod", "module x\n"), ("lib.go", "package lib\n")]);
        let configs = detect_go_suggestions(tmp.path().to_str().unwrap());
        assert_eq!(names(&configs), ["go test"]);
    }

    #[test]
    fn make_targets_skip_special_pattern_and_variables() {
        let content = ".PHONY: build test\nCC := gcc\nVAR = 1\nbuild: deps\n\tgo build\ntest:\n\tgo test\n%.o: %.c\n\tcc\nall clean:\n";
        assert_eq!(make_targets(content), ["build", "test", "all", "clean"]);
    }

    #[test]
    fn makefile_suggestions_use_make() {
        let tmp = workspace(&[("Makefile", "build:\n\techo hi\n")]);
        let configs = detect_make_suggestions(tmp.path().to_str().unwrap());
        assert_eq!(configs[0].command, "make build");
        assert_eq!(configs[0].detect.as_deref(), Some("Makefile"));
    }

    #[test]
    fn just_recipes_skip_private_and_parameterized() {
        let content = "set shell := [\"bash\", \"-c\"]\nversion := \"1\"\nalias b := build\n\n# Build it\nbuild:\n    cargo build\n\ntest filter='':\n    cargo test {{filter}}\n\ndeploy target:\n    ./deploy {{target}}\n\n_helper:\n    true\n\n[private]\nhidden:\n    true\n\n@quiet *args:\n    echo {{args}}\n";
        assert_eq!(just_recipes(content), ["build", "test", "quiet"]);
    }

    #[test]
    fn compose_lists_services_and_a_combined_up() {
        let tmp = workspace(&[(
            "compose.yaml",
            "name: app\nservices:\n  web:\n    image: nginx\n    ports:\n      - \"80:80\"\n  db:\n    image: postgres\nvolumes:\n  data:\n",
        )]);
        let configs = detect_compose_suggestions(tmp.path().to_str().unwrap());
        assert_eq!(
            names(&configs),
            ["compose up", "compose up web", "compose up db"]
        );
        assert_eq!(configs[2].command, "docker compose up db");
    }

    #[test]
    fn compose_with_one_service_only_offers_up() {
        let tmp = workspace(&[("docker-compose.yml", "services:\n  app:\n    build: .\n")]);
        let configs = detect_compose_suggestions(tmp.path().to_str().unwrap());
        assert_eq!(names(&configs), ["compose up"]);
    }
}
