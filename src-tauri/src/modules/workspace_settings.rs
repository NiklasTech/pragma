use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::Value;

const MAX_FILE_BYTES: u64 = 256 * 1024;
const MAX_TAB_SIZE: u32 = 16;
const MAX_RULERS: usize = 10;
const MAX_RULER_COLUMN: u32 = 500;
const MAX_ALLOWED_COMMANDS: usize = 100;
const MAX_COMMAND_CHARS: usize = 200;
const MAX_STEP_LIMIT: u32 = 10_000;
const MAX_LSP_LANGUAGES: usize = 100;
const MAX_LANGUAGE_CHARS: usize = 40;

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceEditorSettings {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tab_size: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub insert_spaces: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub format_on_save: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub trim_trailing_whitespace: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub insert_final_newline: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rulers: Option<Vec<u32>>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceAgentSettings {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub allowed_commands: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub step_limit: Option<u32>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct WorkspaceLspSettings {
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub enabled: BTreeMap<String, bool>,
}

/// The settings a workspace may override; other keys of the file, such as `mcpServers`, are kept.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct WorkspaceSettings {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub editor: Option<WorkspaceEditorSettings>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub agent: Option<WorkspaceAgentSettings>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lsp: Option<WorkspaceLspSettings>,
}

fn settings_path(root_path: &str) -> Result<PathBuf, String> {
    let root = Path::new(root_path);
    if !root.is_absolute() || !root.is_dir() {
        return Err("Workspace root must be an existing absolute directory".to_string());
    }
    Ok(root.join(".pragma").join("settings.json"))
}

fn validate_editor(editor: &WorkspaceEditorSettings) -> Result<(), String> {
    if editor
        .tab_size
        .is_some_and(|size| size == 0 || size > MAX_TAB_SIZE)
    {
        return Err(format!("editor.tabSize must be 1 to {MAX_TAB_SIZE}"));
    }
    if let Some(rulers) = &editor.rulers {
        if rulers.len() > MAX_RULERS
            || rulers
                .iter()
                .any(|column| *column == 0 || *column > MAX_RULER_COLUMN)
        {
            return Err(format!(
                "editor.rulers takes at most {MAX_RULERS} columns from 1 to {MAX_RULER_COLUMN}"
            ));
        }
    }
    Ok(())
}

fn validate_agent(agent: &WorkspaceAgentSettings) -> Result<(), String> {
    if let Some(commands) = &agent.allowed_commands {
        if commands.len() > MAX_ALLOWED_COMMANDS {
            return Err(format!(
                "agent.allowedCommands takes at most {MAX_ALLOWED_COMMANDS} patterns"
            ));
        }
        if commands.iter().any(|command| {
            command.trim().is_empty()
                || command.trim() != command
                || command.chars().count() > MAX_COMMAND_CHARS
                || command.contains('\n')
        }) {
            return Err(format!(
                "agent.allowedCommands entries must be single lines of 1 to {MAX_COMMAND_CHARS} characters"
            ));
        }
    }
    if agent
        .step_limit
        .is_some_and(|limit| limit == 0 || limit > MAX_STEP_LIMIT)
    {
        return Err(format!("agent.stepLimit must be 1 to {MAX_STEP_LIMIT}"));
    }
    Ok(())
}

fn validate_lsp(lsp: &WorkspaceLspSettings) -> Result<(), String> {
    if lsp.enabled.len() > MAX_LSP_LANGUAGES {
        return Err(format!(
            "lsp.enabled takes at most {MAX_LSP_LANGUAGES} languages"
        ));
    }
    let valid_name = |name: &str| {
        !name.is_empty()
            && name.len() <= MAX_LANGUAGE_CHARS
            && name
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '+'))
    };
    if !lsp.enabled.keys().all(|name| valid_name(name)) {
        return Err("lsp.enabled keys must be language ids".to_string());
    }
    Ok(())
}

pub fn validate(settings: &WorkspaceSettings) -> Result<(), String> {
    if let Some(editor) = &settings.editor {
        validate_editor(editor)?;
    }
    if let Some(agent) = &settings.agent {
        validate_agent(agent)?;
    }
    if let Some(lsp) = &settings.lsp {
        validate_lsp(lsp)?;
    }
    Ok(())
}

fn read_document(path: &Path) -> Result<Option<Value>, String> {
    let metadata = match std::fs::metadata(path) {
        Ok(metadata) => metadata,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(e) => return Err(format!("Failed to read {}: {e}", path.display())),
    };
    if !metadata.is_file() || metadata.len() > MAX_FILE_BYTES {
        return Err(".pragma/settings.json must be a file of at most 256 KB".to_string());
    }
    let content = std::fs::read_to_string(path)
        .map_err(|e| format!("Failed to read .pragma/settings.json: {e}"))?;
    serde_json::from_str(&content)
        .map(Some)
        .map_err(|e| format!("Invalid .pragma/settings.json: {e}"))
}

pub fn parse(document: Value) -> Result<WorkspaceSettings, String> {
    let settings: WorkspaceSettings = serde_json::from_value(document)
        .map_err(|e| format!("Invalid .pragma/settings.json: {e}"))?;
    validate(&settings)?;
    Ok(settings)
}

/// Writes the overridable sections and keeps every other key of an existing file.
pub fn merge_into(existing: Option<Value>, settings: &WorkspaceSettings) -> Result<Value, String> {
    let mut document = match existing {
        Some(Value::Object(map)) => map,
        Some(_) => return Err(".pragma/settings.json must contain a JSON object".to_string()),
        None => serde_json::Map::new(),
    };
    for key in ["editor", "agent", "lsp"] {
        document.remove(key);
    }
    if let Value::Object(sections) =
        serde_json::to_value(settings).map_err(|e| format!("Failed to encode settings: {e}"))?
    {
        document.extend(sections);
    }
    Ok(Value::Object(document))
}

/// The workspace overrides, or `None` when the workspace has no `.pragma/settings.json`.
#[tauri::command(async)]
pub fn workspace_settings_load(root_path: String) -> Result<Option<WorkspaceSettings>, String> {
    let path = settings_path(&root_path)?;
    read_document(&path)?.map(parse).transpose()
}

#[tauri::command(async)]
pub fn workspace_settings_save(
    root_path: String,
    settings: WorkspaceSettings,
) -> Result<(), String> {
    validate(&settings)?;
    let path = settings_path(&root_path)?;
    let existing = read_document(&path)?;
    let document = merge_into(existing, &settings)?;
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir)
            .map_err(|e| format!("Failed to create .pragma directory: {e}"))?;
    }
    let content = serde_json::to_string_pretty(&document)
        .map_err(|e| format!("Failed to encode settings: {e}"))?;
    std::fs::write(&path, format!("{content}\n"))
        .map_err(|e| format!("Failed to write .pragma/settings.json: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn parses_the_overridable_sections_and_ignores_other_keys() {
        let settings = parse(json!({
            "editor": { "tabSize": 2, "insertSpaces": true, "rulers": [80, 120] },
            "agent": { "allowedCommands": ["pnpm test"], "stepLimit": 40 },
            "lsp": { "enabled": { "rust": false } },
            "mcpServers": { "docs": { "command": "npx" } }
        }))
        .unwrap();
        assert_eq!(settings.editor.as_ref().unwrap().tab_size, Some(2));
        assert_eq!(
            settings.agent.as_ref().unwrap().allowed_commands,
            Some(vec!["pnpm test".to_string()])
        );
        assert_eq!(settings.lsp.unwrap().enabled.get("rust"), Some(&false));
    }

    #[test]
    fn rejects_values_out_of_range() {
        for document in [
            json!({ "editor": { "tabSize": 0 } }),
            json!({ "editor": { "rulers": [0] } }),
            json!({ "agent": { "allowedCommands": [" rm -rf /"] } }),
            json!({ "agent": { "allowedCommands": ["a\nb"] } }),
            json!({ "agent": { "stepLimit": 0 } }),
            json!({ "lsp": { "enabled": { "../x": true } } }),
            json!({ "editor": { "tabSize": "two" } }),
        ] {
            assert!(parse(document.clone()).is_err(), "{document}");
        }
    }

    #[test]
    fn saving_replaces_the_sections_and_keeps_other_keys() {
        let existing = json!({ "mcpServers": { "docs": {} }, "editor": { "tabSize": 8 } });
        let settings = WorkspaceSettings {
            editor: Some(WorkspaceEditorSettings {
                tab_size: Some(4),
                ..Default::default()
            }),
            ..Default::default()
        };
        let merged = merge_into(Some(existing), &settings).unwrap();
        assert_eq!(
            merged,
            json!({ "mcpServers": { "docs": {} }, "editor": { "tabSize": 4 } })
        );
        assert!(merge_into(Some(json!([1])), &settings).is_err());
    }

    #[test]
    fn load_and_save_round_trip_in_the_workspace() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().to_string_lossy().into_owned();
        assert_eq!(workspace_settings_load(root.clone()).unwrap(), None);

        let settings = WorkspaceSettings {
            agent: Some(WorkspaceAgentSettings {
                allowed_commands: Some(vec!["cargo test".to_string()]),
                step_limit: None,
            }),
            ..Default::default()
        };
        workspace_settings_save(root.clone(), settings.clone()).unwrap();
        assert_eq!(
            workspace_settings_load(root.clone()).unwrap(),
            Some(settings)
        );

        assert!(workspace_settings_load("relative/path".to_string()).is_err());
        std::fs::write(dir.path().join(".pragma").join("settings.json"), "{oops").unwrap();
        assert!(workspace_settings_load(root).is_err());
    }
}
