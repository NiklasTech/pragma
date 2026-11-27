use serde_json::Value;

use super::config_options::{ConfigOptionValue, SessionConfigOption};

/// The option Pragma shows for an agent's session modes; the agent never sees this id.
pub const MODE_OPTION_ID: &str = "pragma.mode";

fn string_field(value: &Value, key: &str) -> Option<String> {
    value.get(key).and_then(Value::as_str).map(str::to_string)
}

/// The `modes` of a session response as a select option, like the config options.
pub fn mode_option(modes: &Value) -> Option<SessionConfigOption> {
    let current_value = string_field(modes, "currentModeId")?;
    let options: Vec<ConfigOptionValue> = modes
        .get("availableModes")?
        .as_array()?
        .iter()
        .filter_map(|mode| {
            let value = string_field(mode, "id")?;
            Some(ConfigOptionValue {
                name: string_field(mode, "name").unwrap_or_else(|| value.clone()),
                description: string_field(mode, "description"),
                value,
            })
        })
        .collect();
    if options.is_empty() {
        return None;
    }
    Some(SessionConfigOption {
        id: MODE_OPTION_ID.to_string(),
        name: "Mode".to_string(),
        description: None,
        category: Some("mode".to_string()),
        current_value,
        options,
    })
}

fn has_mode(options: &[SessionConfigOption]) -> bool {
    options
        .iter()
        .any(|option| option.category.as_deref() == Some("mode"))
}

/// Adds the session modes as an option unless a config option already chooses the mode.
pub fn with_modes(
    mut options: Vec<SessionConfigOption>,
    modes: Option<&Value>,
) -> Vec<SessionConfigOption> {
    if has_mode(&options) {
        return options;
    }
    if let Some(option) = modes.and_then(mode_option) {
        options.push(option);
    }
    options
}

/// A new list of config options keeps the modes option Pragma added before.
pub fn keep_modes(
    mut options: Vec<SessionConfigOption>,
    previous: &[SessionConfigOption],
) -> Vec<SessionConfigOption> {
    if has_mode(&options) {
        return options;
    }
    if let Some(modes) = previous.iter().find(|option| option.id == MODE_OPTION_ID) {
        options.push(modes.clone());
    }
    options
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn modes() -> Value {
        json!({
            "currentModeId": "ask",
            "availableModes": [
                { "id": "ask", "name": "Ask", "description": "Ask before edits" },
                { "id": "code" }
            ]
        })
    }

    fn model_option() -> SessionConfigOption {
        SessionConfigOption {
            id: "model".to_string(),
            name: "Model".to_string(),
            description: None,
            category: Some("model".to_string()),
            current_value: "a".to_string(),
            options: Vec::new(),
        }
    }

    #[test]
    fn modes_become_an_option() {
        let option = mode_option(&modes()).expect("option");
        assert_eq!(option.id, MODE_OPTION_ID);
        assert_eq!(option.current_value, "ask");
        assert_eq!(option.options[1].name, "code");
        assert!(mode_option(&json!({ "currentModeId": "x", "availableModes": [] })).is_none());
    }

    #[test]
    fn a_mode_config_option_wins_over_the_modes() {
        let mut agent_mode = model_option();
        agent_mode.id = "mode".to_string();
        agent_mode.category = Some("mode".to_string());

        assert_eq!(
            with_modes(vec![agent_mode.clone()], Some(&modes())).len(),
            1
        );
        let added = with_modes(vec![model_option()], Some(&modes()));
        assert_eq!(added.len(), 2);
        assert_eq!(keep_modes(vec![model_option()], &added).len(), 2);
        assert_eq!(keep_modes(vec![agent_mode], &added).len(), 1);
    }
}
