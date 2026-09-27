use serde::Serialize;
use serde_json::Value;

/// One selectable value of an ACP session config option.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigOptionValue {
    pub value: String,
    pub name: String,
    pub description: Option<String>,
}

/// A select-type ACP session config option such as the model or reasoning effort.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionConfigOption {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub category: Option<String>,
    pub current_value: String,
    pub options: Vec<ConfigOptionValue>,
}

fn string_field(value: &Value, key: &str) -> Option<String> {
    value.get(key).and_then(Value::as_str).map(str::to_string)
}

/// Flattens plain and grouped option lists; entries without a value are skipped.
fn collect_values(options: &[Value], out: &mut Vec<ConfigOptionValue>) {
    for option in options {
        if let Some(group) = option.get("options").and_then(Value::as_array) {
            collect_values(group, out);
            continue;
        }
        let Some(value) = string_field(option, "value") else {
            continue;
        };
        out.push(ConfigOptionValue {
            name: string_field(option, "name").unwrap_or_else(|| value.clone()),
            description: string_field(option, "description"),
            value,
        });
    }
}

/// Parses the `configOptions` an ACP agent reports; unknown option types are ignored.
pub fn parse_config_options(raw: &Value) -> Vec<SessionConfigOption> {
    let Some(items) = raw.as_array() else {
        return Vec::new();
    };

    items
        .iter()
        .filter(|item| item.get("type").and_then(Value::as_str) == Some("select"))
        .filter_map(|item| {
            let id = string_field(item, "id")?;
            let current_value = string_field(item, "currentValue")?;
            let mut options = Vec::new();
            collect_values(
                item.get("options")
                    .and_then(Value::as_array)
                    .map(Vec::as_slice)
                    .unwrap_or_default(),
                &mut options,
            );
            Some(SessionConfigOption {
                name: string_field(item, "name").unwrap_or_else(|| id.clone()),
                description: string_field(item, "description"),
                category: string_field(item, "category"),
                id,
                current_value,
                options,
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn parses_select_options_and_flattens_groups() {
        let raw = json!([
            {
                "id": "model",
                "name": "Model",
                "category": "model",
                "type": "select",
                "currentValue": "opus",
                "options": [
                    { "value": "opus", "name": "Opus 5.5", "description": "Best for complex tasks" },
                    { "group": "fast", "name": "Fast", "options": [{ "value": "haiku", "name": "Haiku 4.5" }] }
                ]
            },
            { "id": "toggle", "type": "boolean", "currentValue": true }
        ]);

        let options = parse_config_options(&raw);

        assert_eq!(options.len(), 1);
        assert_eq!(options[0].id, "model");
        assert_eq!(options[0].category.as_deref(), Some("model"));
        assert_eq!(options[0].current_value, "opus");
        let values: Vec<&str> = options[0]
            .options
            .iter()
            .map(|o| o.value.as_str())
            .collect();
        assert_eq!(values, vec!["opus", "haiku"]);
    }

    #[test]
    fn ignores_non_array_input() {
        assert!(parse_config_options(&json!({ "id": "model" })).is_empty());
    }
}
