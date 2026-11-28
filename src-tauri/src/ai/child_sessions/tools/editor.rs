//! Pragma's editor and review view: show the user what the agent points at, and read what the
//! user is looking at.

use serde_json::{json, Value};

fn path_property() -> Value {
    json!({
        "type": "string",
        "description": "File path, absolute or relative to the session's working folder."
    })
}

pub fn definitions() -> Vec<Value> {
    vec![
        json!({
            "name": "editor_open",
            "description": "Open a file in Pragma's editor, at a line if given, so the user sees what you point at. Pragma offers to switch to the editor; it does not pull the user away.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "path": path_property(),
                    "line": { "type": "number", "description": "1-based line to show." }
                },
                "required": ["path"]
            }
        }),
        json!({
            "name": "editor_show_diff",
            "description": "Show the user the uncommitted changes of a file as a diff in Pragma's editor.",
            "inputSchema": {
                "type": "object",
                "properties": { "path": path_property() },
                "required": ["path"]
            }
        }),
        json!({
            "name": "editor_open_files",
            "description": "List the files open in Pragma's editor, which one is active and which have unsaved changes.",
            "inputSchema": { "type": "object", "properties": {} }
        }),
        json!({
            "name": "editor_selection",
            "description": "Get the text the user selected in the active editor file, with its file and lines, or the cursor position when nothing is selected.",
            "inputSchema": { "type": "object", "properties": {} }
        }),
        json!({
            "name": "review_request",
            "description": "Ask the user to review your changes in Pragma's review view. It returns at once; the user's comments come back as a new message.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "message": { "type": "string", "description": "Optional note on what to look at." }
                }
            }
        }),
    ]
}
