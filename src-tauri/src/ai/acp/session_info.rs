use std::sync::Arc;

use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;

const SESSION_INFO_EVENT: &str = "acp_session_info";

/// A slash command, skill or agent the coding CLI offers in its session.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AvailableCommand {
    pub name: String,
    pub description: String,
    /// Shown while the text after the command is still empty.
    pub hint: Option<String>,
}

/// One task of the agent's plan; status is `pending`, `in_progress` or `completed`.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanEntry {
    pub content: String,
    pub priority: String,
    pub status: String,
}

/// What a session reports besides its answers: its commands and its current plan.
#[derive(Debug, Clone, Default, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionInfo {
    pub commands: Vec<AvailableCommand>,
    pub plan: Vec<PlanEntry>,
}

pub type SharedSessionInfo = Arc<Mutex<SessionInfo>>;

fn string_field(value: &Value, key: &str) -> Option<String> {
    value.get(key).and_then(Value::as_str).map(str::to_string)
}

/// Parses `availableCommands`; entries without a name are skipped and a leading `/` is dropped.
pub fn parse_available_commands(raw: &Value) -> Vec<AvailableCommand> {
    let Some(items) = raw.as_array() else {
        return Vec::new();
    };
    items
        .iter()
        .filter_map(|item| {
            let name = string_field(item, "name")?
                .trim_start_matches('/')
                .trim()
                .to_string();
            if name.is_empty() {
                return None;
            }
            Some(AvailableCommand {
                name,
                description: string_field(item, "description").unwrap_or_default(),
                hint: item
                    .pointer("/input/hint")
                    .and_then(Value::as_str)
                    .filter(|hint| !hint.is_empty())
                    .map(str::to_string),
            })
        })
        .collect()
}

/// Parses the `entries` of a `plan` update; entries without content are skipped.
pub fn parse_plan(raw: &Value) -> Vec<PlanEntry> {
    let Some(items) = raw.as_array() else {
        return Vec::new();
    };
    items
        .iter()
        .filter_map(|item| {
            let content = string_field(item, "content")?;
            if content.trim().is_empty() {
                return None;
            }
            Some(PlanEntry {
                content,
                priority: string_field(item, "priority").unwrap_or_else(|| "medium".to_string()),
                status: string_field(item, "status").unwrap_or_else(|| "pending".to_string()),
            })
        })
        .collect()
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SessionInfoEvent {
    chat_session_id: String,
    info: SessionInfo,
}

/// Keeps a session's commands and plan and tells the UI when the agent changes them.
pub struct SessionInfoSink {
    pub app_handle: AppHandle,
    pub chat_session_id: String,
    pub info: SharedSessionInfo,
}

impl SessionInfoSink {
    pub async fn set_commands(&self, raw: &Value) {
        let commands = parse_available_commands(raw);
        let mut info = self.info.lock().await;
        info.commands = commands;
        self.emit(info.clone());
    }

    /// Every plan update replaces the whole plan; an empty one clears it.
    pub async fn set_plan(&self, raw: &Value) {
        let plan = parse_plan(raw);
        let mut info = self.info.lock().await;
        info.plan = plan;
        self.emit(info.clone());
    }

    fn emit(&self, info: SessionInfo) {
        let _ = self.app_handle.emit(
            SESSION_INFO_EVENT,
            SessionInfoEvent {
                chat_session_id: self.chat_session_id.clone(),
                info,
            },
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn parses_commands_with_hints_and_skips_nameless_ones() {
        let commands = parse_available_commands(&json!([
            { "name": "review", "description": "Review a pull request", "input": { "hint": "PR number" } },
            { "name": "/compact", "description": "Compact the conversation", "input": null },
            { "name": "humanizer", "description": "Rewrite AI-sounding text (skill)", "input": { "hint": "" } },
            { "description": "no name" },
            { "name": "  " }
        ]));

        assert_eq!(
            commands,
            vec![
                AvailableCommand {
                    name: "review".to_string(),
                    description: "Review a pull request".to_string(),
                    hint: Some("PR number".to_string()),
                },
                AvailableCommand {
                    name: "compact".to_string(),
                    description: "Compact the conversation".to_string(),
                    hint: None,
                },
                AvailableCommand {
                    name: "humanizer".to_string(),
                    description: "Rewrite AI-sounding text (skill)".to_string(),
                    hint: None,
                },
            ]
        );
    }

    #[test]
    fn parses_plan_entries_with_defaults() {
        let plan = parse_plan(&json!([
            { "content": "Read the code", "priority": "high", "status": "completed" },
            { "content": "Write the tests" },
            { "content": "" },
            { "status": "pending" }
        ]));

        assert_eq!(plan.len(), 2);
        assert_eq!(plan[0].status, "completed");
        assert_eq!(plan[0].priority, "high");
        assert_eq!(plan[1].content, "Write the tests");
        assert_eq!(plan[1].status, "pending");
        assert_eq!(plan[1].priority, "medium");
    }

    #[test]
    fn non_array_input_is_empty() {
        assert!(parse_available_commands(&Value::Null).is_empty());
        assert!(parse_plan(&json!({ "content": "x" })).is_empty());
    }
}
