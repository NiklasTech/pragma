use serde::Deserialize;

use crate::ai::error::AIError;

pub(super) const DATA_PREFIX: &str = "data: ";
pub(super) const DONE_EVENT: &str = "[DONE]";

#[derive(Debug)]
pub(super) enum ParseOutcome {
    Event(OpenAIStreamEvent),
    Skip,
}

/// Parses one SSE `data:` payload. Providers emit events without `choices`
/// (usage, citations, metadata); those are skipped instead of failing the stream.
pub(super) fn parse_stream_event(data: &str) -> Result<ParseOutcome, AIError> {
    let event: OpenAIStreamEvent = serde_json::from_str(data)
        .map_err(|e| AIError::Stream(format!("invalid sse event: {e}")))?;

    if event.choices.is_empty() {
        if let Some(error) = event.error {
            return Err(AIError::Provider(
                error.message.unwrap_or_else(|| "unknown error".to_string()),
            ));
        }
        return Ok(ParseOutcome::Skip);
    }

    Ok(ParseOutcome::Event(event))
}

/// Builds the text of a single chunk and keeps `<thinking>` tags balanced across the stream.
pub(super) fn build_stream_chunk(
    choice: &mut OpenAIStreamChoice,
    in_reasoning: &mut bool,
) -> (String, Option<String>) {
    let delta = &mut choice.delta;
    let content = delta.content.take();
    let reasoning = delta.reasoning_content.take();

    let has_content = content.as_ref().is_some_and(|value| !value.is_empty());
    let has_reasoning = reasoning.as_ref().is_some_and(|value| !value.is_empty());

    let mut chunk = String::new();

    if has_content {
        if *in_reasoning {
            chunk.push_str("</thinking>");
            *in_reasoning = false;
        }
        chunk.push_str(content.as_deref().unwrap_or_default());
    }

    if has_reasoning {
        if !*in_reasoning {
            chunk.push_str("<thinking>");
            *in_reasoning = true;
        }
        chunk.push_str(reasoning.as_deref().unwrap_or_default());
    }

    (chunk, choice.finish_reason.take())
}

#[derive(Debug, Deserialize)]
pub(super) struct OpenAIStreamEvent {
    #[serde(default)]
    pub(super) choices: Vec<OpenAIStreamChoice>,
    pub(super) error: Option<OpenAIStreamError>,
}

#[derive(Debug, Deserialize)]
pub(super) struct OpenAIStreamError {
    pub(super) message: Option<String>,
}

#[derive(Debug, Deserialize)]
pub(super) struct OpenAIStreamChoice {
    #[serde(default)]
    pub(super) delta: OpenAIStreamDelta,
    pub(super) finish_reason: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
pub(super) struct OpenAIStreamDelta {
    pub(super) content: Option<String>,
    pub(super) reasoning_content: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(super) tool_calls: Option<Vec<OpenAIStreamToolCallDelta>>,
}

#[derive(Debug, Deserialize)]
pub(super) struct OpenAIStreamToolCallDelta {
    pub(super) index: usize,
    pub(super) id: Option<String>,
    pub(super) r#type: Option<String>,
    pub(super) function: Option<OpenAIStreamFunctionCallDelta>,
}

#[derive(Debug, Deserialize)]
pub(super) struct OpenAIStreamFunctionCallDelta {
    pub(super) name: Option<String>,
    pub(super) arguments: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse_event(data: &str) -> OpenAIStreamEvent {
        match parse_stream_event(data) {
            Ok(ParseOutcome::Event(event)) => event,
            Ok(ParseOutcome::Skip) => panic!("expected event, got skip"),
            Err(e) => panic!("expected event, got error: {e}"),
        }
    }

    fn first_choice(data: &str) -> OpenAIStreamChoice {
        parse_event(data)
            .choices
            .into_iter()
            .next()
            .expect("expected a choice")
    }

    fn chunk_for(data: &str) -> String {
        let mut choice = first_choice(data);
        let mut in_reasoning = false;
        build_stream_chunk(&mut choice, &mut in_reasoning).0
    }

    #[test]
    fn parses_normal_content_chunk() {
        let data = r#"{"id":"c1","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}"#;
        let event = parse_event(data);
        assert_eq!(event.choices.len(), 1);
        assert_eq!(chunk_for(data), "Hello");
    }

    #[test]
    fn skips_event_without_choices_field() {
        let data =
            r#"{"id":"c1","usage":{"prompt_tokens":1,"completion_tokens":2,"total_tokens":3}}"#;
        assert!(matches!(parse_stream_event(data), Ok(ParseOutcome::Skip)));
    }

    #[test]
    fn skips_event_with_empty_choices() {
        let data = r#"{"id":"c1","choices":[]}"#;
        assert!(matches!(parse_stream_event(data), Ok(ParseOutcome::Skip)));
    }

    #[test]
    fn surfaces_provider_error_event() {
        let data =
            r#"{"error":{"message":"context length exceeded","type":"invalid_request_error"}}"#;
        match parse_stream_event(data) {
            Err(AIError::Provider(message)) => assert_eq!(message, "context length exceeded"),
            other => panic!("expected provider error, got {other:?}"),
        }
    }

    #[test]
    fn parses_choice_with_finish_reason_and_no_delta() {
        let data = r#"{"id":"c1","choices":[{"index":0,"finish_reason":"stop"}]}"#;
        let mut choice = first_choice(data);
        let mut in_reasoning = false;
        let (content, finish_reason) = build_stream_chunk(&mut choice, &mut in_reasoning);
        assert!(content.is_empty());
        assert_eq!(finish_reason.as_deref(), Some("stop"));
    }

    #[test]
    fn malformed_json_is_a_stream_error() {
        assert!(matches!(
            parse_stream_event("{not json"),
            Err(AIError::Stream(_))
        ));
    }

    #[test]
    fn parses_reasoning_content() {
        let data =
            r#"{"choices":[{"delta":{"reasoning_content":"thinking"},"finish_reason":null}]}"#;
        assert_eq!(chunk_for(data), "<thinking>thinking");
    }

    #[test]
    fn parses_tool_call_delta() {
        let data = r#"{"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"read_file","arguments":"{}"}}]},"finish_reason":"tool_calls"}]}"#;
        let choice = first_choice(data);
        let deltas = choice.delta.tool_calls.expect("expected tool call deltas");
        assert_eq!(deltas.len(), 1);
        assert_eq!(deltas[0].index, 0);
        assert_eq!(deltas[0].id.as_deref(), Some("call_1"));
        assert_eq!(
            deltas[0]
                .function
                .as_ref()
                .and_then(|function| function.name.as_deref()),
            Some("read_file")
        );
        assert_eq!(choice.finish_reason.as_deref(), Some("tool_calls"));
    }
}
