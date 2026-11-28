//! Driving the page in Pragma's browser pane beyond opening it and taking a screenshot, so an agent
//! can test the web app it just changed.

use serde_json::{json, Value};

fn target_properties() -> Value {
    json!({
        "selector": { "type": "string", "description": "CSS selector of the element. Wins over text." },
        "text": { "type": "string", "description": "Visible label of a link, button or field, e.g. \"Sign in\"." }
    })
}

pub fn definitions() -> Vec<Value> {
    let mut type_properties = target_properties();
    if let Some(map) = type_properties.as_object_mut() {
        map.insert(
            "value".to_string(),
            json!({ "type": "string", "description": "The text to put into the field." }),
        );
        map.insert(
            "submit".to_string(),
            json!({ "type": "boolean", "description": "Press Enter and submit the form afterwards." }),
        );
    }
    vec![
        json!({
            "name": "browser_navigate",
            "description": "Go to a URL in Pragma's browser pane, or go back, forward or reload the page there.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "url": { "type": "string", "description": "The http or https URL to open." },
                    "action": { "type": "string", "enum": ["back", "forward", "reload"], "description": "Instead of a URL." }
                }
            }
        }),
        json!({
            "name": "browser_read",
            "description": "Read the page in Pragma's browser pane as text: title, URL, the visible text and the links, buttons and fields it shows.",
            "inputSchema": { "type": "object", "properties": {} }
        }),
        json!({
            "name": "browser_click",
            "description": "Click a link, button or other control on the page in Pragma's browser pane, found by CSS selector or by its visible label.",
            "inputSchema": { "type": "object", "properties": target_properties() }
        }),
        json!({
            "name": "browser_type",
            "description": "Type into a field on the page in Pragma's browser pane, found by CSS selector or by its label or placeholder; it replaces the field's value.",
            "inputSchema": { "type": "object", "properties": type_properties, "required": ["value"] }
        }),
        json!({
            "name": "browser_network",
            "description": "List the failed requests of the page in Pragma's browser pane since it loaded: HTTP errors, failed fetches and resources that did not load.",
            "inputSchema": { "type": "object", "properties": {} }
        }),
    ]
}
