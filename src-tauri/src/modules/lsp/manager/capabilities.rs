use crate::modules::lsp::types::ClientCapabilities;
use std::collections::HashMap;

pub(super) fn client_capabilities() -> ClientCapabilities {
    ClientCapabilities {
        text_document: Some({
            let mut map = HashMap::new();
            map.insert(
                "synchronization".to_string(),
                serde_json::json!({
                    "dynamicRegistration": false,
                    "willSave": false,
                    "willSaveWaitUntil": false,
                    "didSave": true,
                    "change": 1,
                }),
            );
            map.insert(
                "publishDiagnostics".to_string(),
                serde_json::json!({
                    "dynamicRegistration": false,
                    "relatedInformation": true,
                    "tagSupport": { "valueSet": [1, 2] },
                    "versionSupport": true,
                    "codeDescriptionSupport": true,
                    "dataSupport": true,
                }),
            );
            map.insert(
                "completion".to_string(),
                serde_json::json!({
                    "dynamicRegistration": false,
                    "completionItem": {
                        "snippetSupport": false,
                        "resolveSupport": { "properties": ["documentation", "detail"] },
                        "documentationFormat": ["markdown", "plaintext"]
                    }
                }),
            );
            map.insert(
                "definition".to_string(),
                serde_json::json!({
                    "dynamicRegistration": false,
                    "linkSupport": true
                }),
            );
            map.insert(
                "hover".to_string(),
                serde_json::json!({
                    "dynamicRegistration": false,
                    "contentFormat": ["markdown", "plaintext"]
                }),
            );
            map.insert(
                "references".to_string(),
                serde_json::json!({ "dynamicRegistration": false }),
            );
            map.insert(
                "formatting".to_string(),
                serde_json::json!({ "dynamicRegistration": false }),
            );
            map.insert(
                "rename".to_string(),
                serde_json::json!({ "dynamicRegistration": false }),
            );
            map.insert(
                "signatureHelp".to_string(),
                serde_json::json!({
                    "dynamicRegistration": false,
                    "signatureInformation": {
                        "documentationFormat": ["markdown", "plaintext"],
                        "parameterInformation": { "labelOffsetSupport": true }
                    }
                }),
            );
            map.insert(
                "codeAction".to_string(),
                serde_json::json!({
                    "dynamicRegistration": false,
                    "codeActionLiteralSupport": {
                        "codeActionKind": { "valueSet": ["quickfix", "refactor", "source"] }
                    }
                }),
            );
            map.insert(
                "documentSymbol".to_string(),
                serde_json::json!({
                    "dynamicRegistration": false,
                    "hierarchicalDocumentSymbolSupport": true
                }),
            );
            map
        }),
        workspace: Some({
            let mut map = HashMap::new();
            map.insert(
                "symbol".to_string(),
                serde_json::json!({ "dynamicRegistration": false }),
            );
            map
        }),
    }
}
