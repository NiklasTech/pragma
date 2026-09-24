use super::LspManager;
use crate::modules::lsp::types::ProjectLanguage;
use std::collections::HashMap;
use std::path::Path;

impl LspManager {
    pub async fn detect_project_languages(
        project_root: &str,
    ) -> Result<Vec<ProjectLanguage>, String> {
        let root = Path::new(project_root);
        if !root.is_dir() {
            return Err(format!("'{project_root}' is not a directory"));
        }

        let mut counts: HashMap<String, usize> = HashMap::new();
        let mut total = 0usize;

        visit_project_files(root, &mut counts, &mut total, 0)
            .await
            .map_err(|e| e.to_string())?;

        if total == 0 {
            return Ok(Vec::new());
        }

        let mut languages: Vec<ProjectLanguage> = counts
            .into_iter()
            .map(|(language, count)| ProjectLanguage {
                language,
                percentage: (count as f64 / total as f64) * 100.0,
            })
            .collect();

        languages.sort_by(|a, b| {
            b.percentage
                .partial_cmp(&a.percentage)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        Ok(languages)
    }
}

pub fn resolve_project_root(language: &str, file_path: &str) -> Option<String> {
    let path = Path::new(file_path);
    let mut current = path.parent()?;

    let markers: &[&str] = match language {
        "typescript" | "javascript" => &["tsconfig.json", "package.json"],
        "rust" => &["Cargo.toml"],
        "python" => &["pyproject.toml", "setup.py", "requirements.txt"],
        "go" => &["go.mod"],
        "java" => &["pom.xml", "build.gradle", "build.gradle.kts"],
        "c" | "cpp" => &["CMakeLists.txt", "Makefile", "meson.build"],
        "html" | "css" => &["package.json", "index.html"],
        _ => &["package.json"],
    };

    loop {
        if markers.iter().any(|marker| current.join(marker).exists()) {
            return current.to_str().map(|s| s.to_string());
        }

        match current.parent() {
            Some(parent) => current = parent,
            None => break,
        }
    }

    path.parent()
        .and_then(|p| p.to_str())
        .map(|s| s.to_string())
}

const MAX_SCAN_DEPTH: usize = 4;
const MAX_SCAN_FILES: usize = 1000;

const SCAN_SKIP_DIRS: &[&str] = &[
    "node_modules",
    ".git",
    "target",
    "dist",
    "build",
    ".venv",
    "venv",
    "vendor",
    ".idea",
    ".vscode",
    "__pycache__",
    ".next",
    ".nuxt",
    "out",
];

fn extension_to_language(ext: &str) -> Option<&'static str> {
    match ext.to_lowercase().as_str() {
        "ts" | "tsx" => Some("typescript"),
        "js" | "jsx" | "mjs" | "cjs" => Some("javascript"),
        "rs" => Some("rust"),
        "py" | "pyi" => Some("python"),
        "go" => Some("go"),
        "java" => Some("java"),
        "c" | "h" => Some("c"),
        "cpp" | "cc" | "cxx" | "hpp" | "hh" => Some("cpp"),
        "html" | "htm" => Some("html"),
        "css" | "scss" | "sass" | "less" => Some("css"),
        _ => None,
    }
}

async fn visit_project_files(
    dir: &Path,
    counts: &mut HashMap<String, usize>,
    total: &mut usize,
    depth: usize,
) -> std::io::Result<()> {
    if depth > MAX_SCAN_DEPTH || *total >= MAX_SCAN_FILES {
        return Ok(());
    }

    let mut entries = tokio::fs::read_dir(dir).await?;
    while let Some(entry) = entries.next_entry().await? {
        let path = entry.path();
        let name = entry.file_name();
        let name_str = name.to_string_lossy();

        if SCAN_SKIP_DIRS.iter().any(|skip| name_str == *skip) {
            continue;
        }

        let file_type = entry.file_type().await?;
        if file_type.is_dir() {
            Box::pin(visit_project_files(&path, counts, total, depth + 1)).await?;
        } else if file_type.is_file() {
            if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                if let Some(language) = extension_to_language(ext) {
                    *counts.entry(language.to_string()).or_insert(0) += 1;
                    *total += 1;
                }
            }
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn resolve_project_root_finds_the_marker_above_the_file() {
        let temp = std::env::temp_dir().join("pragma-lsp-project-root-marker-test");
        let _ = fs::remove_dir_all(&temp);
        let nested = temp.join("src");
        fs::create_dir_all(&nested).unwrap();
        fs::write(temp.join("package.json"), "{}").unwrap();
        let file = nested.join("page.html");
        fs::write(&file, "").unwrap();

        let resolved = resolve_project_root("html", file.to_str().unwrap());
        assert_eq!(resolved.as_deref(), Some(temp.to_str().unwrap()));

        let _ = fs::remove_dir_all(&temp);
    }
}
