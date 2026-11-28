//! Lets an agent reach the user, who may be working in another pane or app.

use serde_json::{json, Value};

pub fn definitions() -> Vec<Value> {
    vec![
        json!({
            "name": "ask_user",
            "description": "Ask the user a question with a few answers to pick from and wait for the choice. Pragma shows it on the session and on the command line, also while the user works elsewhere. Use it for decisions you cannot make yourself; add an answer like \"Something else\" when the options may not fit.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "question": { "type": "string", "description": "The question, one or two short sentences." },
                    "options": {
                        "type": "array",
                        "items": { "type": "string" },
                        "minItems": 2,
                        "maxItems": 9,
                        "description": "The answers the user picks from, 2 to 9 short labels."
                    }
                },
                "required": ["question", "options"]
            }
        }),
        json!({
            "name": "notify_user",
            "description": "Show the user a short notification, for example that a long task finished or something needs a look. It does not wait for an answer.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "message": { "type": "string", "description": "The notification text, one sentence." }
                },
                "required": ["message"]
            }
        }),
    ]
}
