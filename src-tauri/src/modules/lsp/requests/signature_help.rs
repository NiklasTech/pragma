use super::shared::marked_string_to_text;
use crate::modules::lsp::manager::LspManager;
use crate::modules::lsp::types::{
    LspParameterInformation, LspSignatureHelp, LspSignatureInformation,
};
use crate::modules::lsp::uris::path_to_uri;
use serde_json::Value;

impl LspManager {
    pub async fn signature_help(
        &self,
        language: &str,
        project_root: &str,
        file_path: &str,
        line: u32,
        character: u32,
    ) -> std::result::Result<Option<LspSignatureHelp>, String> {
        let client = self.get_client(language, project_root).await?;
        let params = serde_json::json!({
            "textDocument": { "uri": path_to_uri(file_path) },
            "position": { "line": line, "character": character },
        });
        let result = client
            .request("textDocument/signatureHelp", Some(params), None)
            .await
            .map_err(|e| e.to_string())?;
        Ok(normalize_signature_help_response(result))
    }
}

fn parameter_label(param: &Value, signature_label: &str) -> Option<String> {
    match param.get("label")? {
        Value::String(label) => Some(label.clone()),
        Value::Array(offsets) => {
            let start = offsets.first()?.as_u64()? as usize;
            let end = offsets.get(1)?.as_u64()? as usize;
            let chars: Vec<char> = signature_label.chars().collect();
            if start > end || end > chars.len() {
                return None;
            }
            Some(chars[start..end].iter().collect())
        }
        _ => None,
    }
}

pub fn normalize_signature_help_response(value: Value) -> Option<LspSignatureHelp> {
    let signatures_value = value.get("signatures")?.as_array()?;
    let signatures: Vec<LspSignatureInformation> = signatures_value
        .iter()
        .filter_map(|sig| {
            let label = sig.get("label")?.as_str()?.to_string();
            let documentation = sig.get("documentation").and_then(marked_string_to_text);
            let parameters = sig
                .get("parameters")
                .and_then(|params| params.as_array())
                .map(|params| {
                    params
                        .iter()
                        .filter_map(|param| {
                            let label = parameter_label(param, &label)?;
                            let documentation =
                                param.get("documentation").and_then(marked_string_to_text);
                            Some(LspParameterInformation {
                                label,
                                documentation,
                            })
                        })
                        .collect()
                })
                .unwrap_or_default();
            Some(LspSignatureInformation {
                label,
                documentation,
                parameters,
            })
        })
        .collect();
    if signatures.is_empty() {
        return None;
    }

    let active_signature = value
        .get("activeSignature")
        .and_then(|a| a.as_u64())
        .unwrap_or(0) as u32;
    let active_parameter = value
        .get("activeParameter")
        .and_then(|a| a.as_u64())
        .unwrap_or(0) as u32;
    Some(LspSignatureHelp {
        signatures,
        active_signature,
        active_parameter,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn signature_help_normalize_with_offset_labels() {
        let value = json!({
            "signatures": [
                {
                    "label": "foo(a: number, b: string): void",
                    "documentation": { "kind": "markdown", "value": "docs" },
                    "parameters": [
                        { "label": [4, 13] },
                        { "label": "b: string", "documentation": "second" }
                    ]
                }
            ],
            "activeSignature": 0,
            "activeParameter": 1
        });
        let help = normalize_signature_help_response(value).unwrap();
        assert_eq!(help.signatures.len(), 1);
        assert_eq!(help.signatures[0].documentation.as_deref(), Some("docs"));
        assert_eq!(help.signatures[0].parameters[0].label, "a: number");
        assert_eq!(help.signatures[0].parameters[1].label, "b: string");
        assert_eq!(help.active_parameter, 1);

        assert!(normalize_signature_help_response(json!({ "signatures": [] })).is_none());
        assert!(normalize_signature_help_response(Value::Null).is_none());
    }
}
