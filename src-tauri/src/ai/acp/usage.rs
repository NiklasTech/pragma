use serde::Deserialize;
use serde_json::Value;

use crate::commands::ai::StreamUsage;

/// `usage` of a `session/prompt` response. Agents that do not track tokens omit it.
#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PromptUsage {
    #[serde(default)]
    input_tokens: Option<u64>,
    #[serde(default)]
    output_tokens: Option<u64>,
    #[serde(default)]
    cached_read_tokens: Option<u64>,
    #[serde(default)]
    cached_write_tokens: Option<u64>,
}

/// Reads the turn usage from a prompt response. Input counts exclude the cached
/// part, as in the Anthropic API most ACP agents wrap.
pub fn prompt_usage(response: &Value) -> Option<StreamUsage> {
    let usage: PromptUsage = serde_json::from_value(response.get("usage")?.clone()).ok()?;
    if usage.input_tokens.is_none() && usage.output_tokens.is_none() {
        return None;
    }
    let cache_read = usage.cached_read_tokens.unwrap_or(0);
    let cache_write = usage.cached_write_tokens.unwrap_or(0);
    Some(StreamUsage {
        input_tokens: Some(
            usage
                .input_tokens
                .unwrap_or(0)
                .saturating_add(cache_read)
                .saturating_add(cache_write),
        ),
        output_tokens: usage.output_tokens,
        cache_read_tokens: usage.cached_read_tokens,
        cache_write_tokens: usage.cached_write_tokens,
        context_used: None,
        context_size: None,
    })
}

/// A `usage_update` notification: tokens in the context window and its size.
pub fn context_usage(used: Option<u64>, size: Option<u64>) -> Option<StreamUsage> {
    used?;
    Some(StreamUsage {
        context_used: used,
        context_size: size,
        ..StreamUsage::default()
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn reads_prompt_usage_with_cache() {
        let usage = prompt_usage(&json!({
            "stopReason": "end_turn",
            "usage": {
                "totalTokens": 1530,
                "inputTokens": 30,
                "outputTokens": 500,
                "cachedReadTokens": 1000
            }
        }))
        .expect("usage");

        assert_eq!(usage.input_tokens, Some(1030));
        assert_eq!(usage.output_tokens, Some(500));
        assert_eq!(usage.cache_read_tokens, Some(1000));
        assert_eq!(usage.cache_write_tokens, None);
    }

    #[test]
    fn missing_or_empty_prompt_usage_is_none() {
        assert!(prompt_usage(&json!({ "stopReason": "end_turn" })).is_none());
        assert!(prompt_usage(&json!({ "usage": {} })).is_none());
        assert!(prompt_usage(&Value::Null).is_none());
    }

    #[test]
    fn context_usage_needs_the_used_count() {
        let usage = context_usage(Some(52_000), Some(200_000)).expect("usage");
        assert_eq!(usage.context_used, Some(52_000));
        assert_eq!(usage.context_size, Some(200_000));
        assert!(context_usage(None, Some(200_000)).is_none());
    }
}
