use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Default)]
pub struct LspServerConfig {
    pub command: String,
    pub args: Vec<String>,
    pub install_program: Option<String>,
    pub install_args: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum LspServerStatus {
    Stopped,
    Starting,
    Running,
    Error,
}

#[derive(Debug, Clone, Serialize)]
pub struct LspStatusEvent {
    pub language: String,
    pub project_root: String,
    pub status: LspServerStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProjectLanguage {
    pub language: String,
    pub percentage: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct LspDiagnosticsEvent {
    pub language: String,
    pub file_path: String,
    pub diagnostics: Vec<LspDiagnostic>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LspPosition {
    pub line: u32,
    pub character: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LspRange {
    pub start: LspPosition,
    pub end: LspPosition,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LspDiagnostic {
    pub range: LspRange,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub severity: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<u32>>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublishDiagnosticsParams {
    pub uri: String,
    pub diagnostics: Vec<LspDiagnostic>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientCapabilities {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text_document: Option<HashMap<String, serde_json::Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub workspace: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InitializeParams {
    pub process_id: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub root_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub root_uri: Option<String>,
    pub capabilities: ClientCapabilities,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InitializedParams {}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextDocumentItem {
    pub uri: String,
    pub language_id: String,
    pub version: i32,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DidOpenTextDocumentParams {
    pub text_document: TextDocumentItem,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionedTextDocumentIdentifier {
    pub uri: String,
    pub version: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextDocumentContentChangeEvent {
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DidChangeTextDocumentParams {
    pub text_document: VersionedTextDocumentIdentifier,
    pub content_changes: Vec<TextDocumentContentChangeEvent>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DidSaveTextDocumentParams {
    pub text_document: TextDocumentIdentifier,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextDocumentIdentifier {
    pub uri: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompletionOptions {
    #[serde(default)]
    pub resolve_provider: Option<bool>,
    #[serde(default)]
    pub trigger_characters: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerCapabilities {
    #[serde(default)]
    pub completion_provider: Option<serde_json::Value>,
    #[serde(default)]
    pub definition_provider: Option<serde_json::Value>,
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

impl ServerCapabilities {
    pub fn feature_flags(&self) -> LspFeatureFlags {
        let completion_options = self.completion_options();
        LspFeatureFlags {
            completion: completion_options.is_some(),
            completion_resolve: completion_options
                .as_ref()
                .and_then(|options| options.resolve_provider)
                .unwrap_or(false),
            completion_trigger_characters: completion_options
                .and_then(|options| options.trigger_characters)
                .unwrap_or_default(),
            definition: match &self.definition_provider {
                Some(serde_json::Value::Bool(enabled)) => *enabled,
                Some(serde_json::Value::Object(_)) => true,
                _ => false,
            },
        }
    }

    fn completion_options(&self) -> Option<CompletionOptions> {
        match &self.completion_provider {
            Some(serde_json::Value::Bool(true)) => Some(CompletionOptions::default()),
            Some(value @ serde_json::Value::Object(_)) => {
                serde_json::from_value(value.clone()).ok()
            }
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LspCompletionItem {
    pub label: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kind: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sort_text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub filter_text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub insert_text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub documentation: Option<serde_json::Value>,
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LspCompletionList {
    pub is_incomplete: bool,
    pub items: Vec<LspCompletionItem>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DefinitionTarget {
    pub file_path: String,
    pub line: u32,
    pub character: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LspFeatureFlags {
    pub completion: bool,
    pub completion_resolve: bool,
    pub completion_trigger_characters: Vec<String>,
    pub definition: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DidCloseTextDocumentParams {
    pub text_document: TextDocumentIdentifier,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InitializeResult {
    pub capabilities: ServerCapabilities,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_completion_and_definition_providers() {
        let json = serde_json::json!({
            "completionProvider": { "resolveProvider": true, "triggerCharacters": [".", "\""] },
            "definitionProvider": true
        });
        let capabilities: ServerCapabilities = serde_json::from_value(json).unwrap();
        let flags = capabilities.feature_flags();
        assert!(flags.completion);
        assert!(flags.completion_resolve);
        assert_eq!(flags.completion_trigger_characters, vec![".", "\""]);
        assert!(flags.definition);
    }

    #[test]
    fn missing_providers_yield_disabled_flags() {
        let capabilities: ServerCapabilities =
            serde_json::from_value(serde_json::json!({})).unwrap();
        let flags = capabilities.feature_flags();
        assert!(!flags.completion);
        assert!(!flags.completion_resolve);
        assert!(!flags.definition);
    }

    #[test]
    fn boolean_completion_provider_means_supported_without_options() {
        let capabilities: ServerCapabilities =
            serde_json::from_value(serde_json::json!({ "completionProvider": true })).unwrap();
        let flags = capabilities.feature_flags();
        assert!(flags.completion);
        assert!(!flags.completion_resolve);
    }

    #[test]
    fn completion_item_roundtrips_unknown_fields_for_resolve() {
        let json = serde_json::json!({
            "label": "map",
            "kind": 2,
            "sortText": "11",
            "data": { "source": "typescript" }
        });
        let item: LspCompletionItem = serde_json::from_value(json).unwrap();
        assert_eq!(item.label, "map");
        assert_eq!(item.kind, Some(2));
        let serialized = serde_json::to_value(&item).unwrap();
        assert_eq!(
            serialized["data"],
            serde_json::json!({ "source": "typescript" })
        );
    }
}
