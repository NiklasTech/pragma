//! Pragma's built-in tool groups. Each group defines its tools in its own file; the app answers
//! their calls in the window that holds the session (`src/features/ai/pragmaTools/`).

mod code;
mod user;

use serde_json::Value;

/// Event that carries a call of a built-in tool to the frontend.
pub const PRAGMA_TOOL_EVENT: &str = "pragma_tool_request";

/// MCP definitions of every built-in tool group.
pub fn definitions() -> Vec<Value> {
    let mut tools = code::definitions();
    tools.extend(user::definitions());
    tools
}

pub fn is_pragma_tool(name: &str) -> bool {
    definitions()
        .iter()
        .any(|tool| tool.get("name").and_then(Value::as_str) == Some(name))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_tool_has_a_unique_name_a_description_and_an_object_schema() {
        let tools = definitions();
        let mut names: Vec<&str> = tools
            .iter()
            .map(|tool| tool["name"].as_str().unwrap())
            .collect();
        for tool in &tools {
            assert!(tool["description"].as_str().is_some_and(|d| !d.is_empty()));
            assert_eq!(tool["inputSchema"]["type"], "object");
        }
        let count = names.len();
        names.sort_unstable();
        names.dedup();
        assert_eq!(names.len(), count);
    }

    #[test]
    fn knows_its_own_tools_only() {
        assert!(is_pragma_tool("lsp_diagnostics"));
        assert!(!is_pragma_tool("agent_spawn_session"));
        assert!(!is_pragma_tool("ext__a__b"));
    }
}
