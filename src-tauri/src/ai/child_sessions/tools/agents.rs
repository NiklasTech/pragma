//! Other agents in the project and the project's task board, so agents can coordinate without
//! the user copying text between panes.

use serde_json::{json, Value};

fn session_property() -> Value {
    json!({ "type": "string", "description": "Id of the session, from sessions_list." })
}

pub fn definitions() -> Vec<Value> {
    vec![
        json!({
            "name": "sessions_list",
            "description": "List the agent sessions of this project with their id, title, agent, kind (chat or terminal) and state (working, needs you, done, idle). Your own session is marked.",
            "inputSchema": { "type": "object", "properties": {} }
        }),
        json!({
            "name": "session_read",
            "description": "Read the latest output of another session: the screen of a coding CLI in a terminal, or the last messages of a chat.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "session": session_property(),
                    "lines": { "type": "number", "description": "How many lines or messages to return. Defaults to 80, at most 300." }
                },
                "required": ["session"]
            }
        }),
        json!({
            "name": "session_send",
            "description": "Send a message to another session, as if the user typed it: into a coding CLI's terminal, or as a chat message. It follows the user's approval setting and may ask first.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "session": session_property(),
                    "message": { "type": "string", "description": "The message to send." }
                },
                "required": ["session", "message"]
            }
        }),
        json!({
            "name": "tasks_list",
            "description": "List the tasks on the project's task board with id, status, priority, labels and title.",
            "inputSchema": { "type": "object", "properties": {} }
        }),
        json!({
            "name": "task_create",
            "description": "Add a task to the project's task board, in To do.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "title": { "type": "string", "description": "Short title, up to 120 characters." },
                    "notes": { "type": "string", "description": "Optional details in Markdown." },
                    "priority": { "type": "string", "enum": ["low", "medium", "high"] },
                    "labels": { "type": "array", "items": { "type": "string" } }
                },
                "required": ["title"]
            }
        }),
        json!({
            "name": "task_update",
            "description": "Change a task on the project's task board: its status, title, notes or result.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "task": { "type": "string", "description": "Id of the task, from tasks_list." },
                    "status": { "type": "string", "enum": ["todo", "in_progress", "in_review", "done"] },
                    "title": { "type": "string" },
                    "notes": { "type": "string" },
                    "result": { "type": "string", "description": "What came out of the task." }
                },
                "required": ["task"]
            }
        }),
    ]
}
