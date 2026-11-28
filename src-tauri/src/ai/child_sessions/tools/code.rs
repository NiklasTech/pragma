//! Code intelligence from the language servers Pragma runs for the project.

use serde_json::{json, Value};

fn path_property() -> Value {
    json!({
        "type": "string",
        "description": "File path, absolute or relative to the session's working folder."
    })
}

/// A symbol is found by its line and name, which agents know, instead of a column. `extra` is
/// one more required property.
fn position_schema(extra: Option<(&str, Value)>) -> Value {
    let mut properties = json!({
        "path": path_property(),
        "line": { "type": "number", "description": "1-based line number where the symbol appears." },
        "symbol": { "type": "string", "description": "The identifier on that line, e.g. a function or variable name." }
    });
    let mut required = vec!["path", "line", "symbol"];
    if let (Some((name, schema)), Some(map)) = (extra, properties.as_object_mut()) {
        map.insert(name.to_string(), schema);
        required.push(name);
    }
    json!({ "type": "object", "properties": properties, "required": required })
}

pub fn definitions() -> Vec<Value> {
    vec![
        json!({
            "name": "lsp_diagnostics",
            "description": "Get the errors and warnings the language server reports for a file, without running the build. Use it after an edit. Without a path it lists the problems of all files open in Pragma's editor.",
            "inputSchema": {
                "type": "object",
                "properties": { "path": path_property() }
            }
        }),
        json!({
            "name": "lsp_definition",
            "description": "Find where a symbol is defined, using the language server.",
            "inputSchema": position_schema(None)
        }),
        json!({
            "name": "lsp_references",
            "description": "Find all references to a symbol across the project, using the language server.",
            "inputSchema": position_schema(None)
        }),
        json!({
            "name": "lsp_hover",
            "description": "Get the type and documentation of a symbol, as the editor shows it on hover.",
            "inputSchema": position_schema(None)
        }),
        json!({
            "name": "lsp_document_symbols",
            "description": "List the classes, functions, variables and other symbols of a file with their lines, as an outline.",
            "inputSchema": {
                "type": "object",
                "properties": { "path": path_property() },
                "required": ["path"]
            }
        }),
        json!({
            "name": "lsp_workspace_symbols",
            "description": "Search the project for classes, functions, types and other symbols by name, using the language server.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "query": { "type": "string", "description": "Symbol name or part of it." },
                    "path": {
                        "type": "string",
                        "description": "Any file in the language to search, absolute or relative to the session's working folder. It selects the language server."
                    }
                },
                "required": ["query", "path"]
            }
        }),
        json!({
            "name": "lsp_rename",
            "description": "Rename a symbol everywhere it is used, using the language server. Pragma shows the files that change and applies the edits once the user allows it.",
            "inputSchema": position_schema(Some((
                "new_name",
                json!({ "type": "string", "description": "The new name of the symbol." })
            )))
        }),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rename_requires_the_new_name() {
        let tools = definitions();
        let rename = tools
            .iter()
            .find(|tool| tool["name"] == "lsp_rename")
            .unwrap();
        let required = rename["inputSchema"]["required"].as_array().unwrap();
        assert!(required.contains(&json!("new_name")));
        assert!(rename["inputSchema"]["properties"]["new_name"].is_object());
    }
}
