//! Facts about the session's workspace and the earlier file versions Pragma keeps.

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
            "name": "workspace_info",
            "description": "Describe the session's workspace: project folder, working folder and worktree, git branch and changed files, the run configurations Pragma knows, and the detected stack.",
            "inputSchema": { "type": "object", "properties": {} }
        }),
        json!({
            "name": "local_history",
            "description": "List the earlier versions of a file Pragma knows, or show one version's diff by its id: snapshots from saves in Pragma's editor and from edits of Pragma's own agent, plus the git commits that changed the file. Changes a coding CLI writes itself have no snapshot.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "path": path_property(),
                    "entry": { "type": "string", "description": "Id of a version from the list, to show its diff." }
                },
                "required": ["path"]
            }
        }),
        json!({
            "name": "local_history_restore",
            "description": "Restore a file to an earlier version from local_history. It follows the user's setting for edits and may ask first.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "path": path_property(),
                    "entry": { "type": "string", "description": "Id of the version from local_history." }
                },
                "required": ["path", "entry"]
            }
        }),
    ]
}
