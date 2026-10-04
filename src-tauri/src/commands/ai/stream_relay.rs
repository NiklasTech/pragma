use crate::ai::provider::{CompletionChunk, Usage};

use super::types::StreamChunk;

/// Decides which provider chunks reach the frontend. Once the response finished
/// (stop or tool calls) nothing else is forwarded, but reading continues because
/// providers report usage after the finish reason.
#[derive(Debug, Default)]
pub(super) struct StreamRelay {
    finished: bool,
    stopped: bool,
    usage: Option<Usage>,
}

impl StreamRelay {
    pub(super) fn finished(&self) -> bool {
        self.finished
    }

    /// Returns the chunk to forward, if any.
    pub(super) fn accept(&mut self, chunk: CompletionChunk) -> Option<StreamChunk> {
        if chunk.usage.is_some() {
            self.usage = chunk.usage;
        }
        if self.finished {
            return None;
        }

        let stop = chunk.finish_reason.as_deref() == Some("stop");
        if stop || chunk.finish_reason.as_deref() == Some("tool_calls") {
            self.finished = true;
            self.stopped = stop;
        }

        if chunk.content.is_empty() && chunk.tool_calls.is_none() {
            return None;
        }

        Some(StreamChunk {
            text: (!chunk.content.is_empty()).then_some(chunk.content),
            error: None,
            done: false,
            reasoning: None,
            tool_calls: chunk.tool_calls,
            tool_results: None,
            usage: None,
        })
    }

    /// The closing chunk carries the finish flag and the usage of the whole response.
    pub(super) fn into_final_chunk(self) -> Option<StreamChunk> {
        if !self.stopped && self.usage.is_none() {
            return None;
        }
        Some(StreamChunk {
            text: None,
            error: None,
            done: self.stopped,
            reasoning: None,
            tool_calls: None,
            tool_results: None,
            usage: self.usage.map(Into::into),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::provider::{FunctionCall, ToolCall};

    fn chunk(content: &str, finish_reason: Option<&str>) -> CompletionChunk {
        CompletionChunk {
            content: content.to_string(),
            finish_reason: finish_reason.map(str::to_string),
            tool_calls: None,
            usage: None,
        }
    }

    fn usage_chunk(prompt: u32, completion: u32) -> CompletionChunk {
        CompletionChunk {
            usage: Some(Usage::new(prompt, completion)),
            ..chunk("", None)
        }
    }

    fn tool_call_chunk(id: &str) -> CompletionChunk {
        CompletionChunk {
            tool_calls: Some(vec![ToolCall {
                id: id.to_string(),
                r#type: "function".to_string(),
                function: FunctionCall {
                    name: "read_file".to_string(),
                    arguments: "{}".to_string(),
                },
            }]),
            ..chunk("", Some("tool_calls"))
        }
    }

    #[test]
    fn forwards_text_and_finishes_with_usage_sent_after_stop() {
        let mut relay = StreamRelay::default();

        let text = relay
            .accept(chunk("Hello", None))
            .expect("text is forwarded");
        assert_eq!(text.text.as_deref(), Some("Hello"));
        assert!(!text.done);

        assert!(relay.accept(chunk("", Some("stop"))).is_none());
        assert!(relay.finished());
        assert!(relay.accept(usage_chunk(100, 20)).is_none());

        let last = relay.into_final_chunk().expect("final chunk");
        assert!(last.done);
        let usage = last.usage.expect("usage is attached");
        assert_eq!(usage.input_tokens, Some(100));
        assert_eq!(usage.output_tokens, Some(20));
    }

    #[test]
    fn forwards_only_the_first_tool_call_but_keeps_its_usage() {
        let mut relay = StreamRelay::default();

        let first = relay.accept(tool_call_chunk("a")).expect("tool call");
        assert_eq!(
            first.tool_calls.map(|calls| calls[0].id.clone()).as_deref(),
            Some("a")
        );
        assert!(relay.accept(tool_call_chunk("b")).is_none());
        assert!(relay.accept(usage_chunk(40, 5)).is_none());

        let last = relay.into_final_chunk().expect("usage chunk");
        assert!(!last.done);
        assert_eq!(last.usage.and_then(|usage| usage.input_tokens), Some(40));
    }

    #[test]
    fn later_usage_replaces_earlier_running_totals() {
        let mut relay = StreamRelay::default();
        relay.accept(usage_chunk(10, 1));
        relay.accept(usage_chunk(10, 7));
        relay.accept(chunk("done", Some("stop")));

        let usage = relay.into_final_chunk().and_then(|last| last.usage);
        assert_eq!(usage.and_then(|usage| usage.output_tokens), Some(7));
    }

    #[test]
    fn no_final_chunk_without_stop_or_usage() {
        let mut relay = StreamRelay::default();
        relay.accept(chunk("partial", None));
        assert!(relay.into_final_chunk().is_none());
    }
}
