//! Incremental parser for `text/event-stream` bodies; yields each event's data.

#[derive(Default)]
pub(super) struct SseParser {
    pending: Vec<u8>,
    data: Vec<String>,
}

impl SseParser {
    /// Feeds raw bytes and returns the data of every event completed by them.
    pub(super) fn push(&mut self, chunk: &[u8]) -> Vec<String> {
        self.pending.extend_from_slice(chunk);
        let mut events = Vec::new();
        while let Some(end) = self.pending.iter().position(|byte| *byte == b'\n') {
            let raw: Vec<u8> = self.pending.drain(..=end).collect();
            let line = String::from_utf8_lossy(&raw);
            let line = line.trim_end_matches(['\n', '\r']);
            if line.is_empty() {
                if !self.data.is_empty() {
                    events.push(self.data.join("\n"));
                    self.data.clear();
                }
                continue;
            }
            if line.starts_with(':') {
                continue;
            }
            let (field, value) = line.split_once(':').unwrap_or((line, ""));
            if field == "data" {
                self.data
                    .push(value.strip_prefix(' ').unwrap_or(value).to_string());
            }
        }
        events
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn yields_data_of_complete_events() {
        let mut parser = SseParser::default();
        let events = parser.push(b"event: message\nid: 1\ndata: {\"a\":1}\n\n");
        assert_eq!(events, [r#"{"a":1}"#]);
    }

    #[test]
    fn joins_multi_line_data_and_skips_comments() {
        let mut parser = SseParser::default();
        let events = parser.push(b": keep-alive\ndata: one\ndata: two\n\n");
        assert_eq!(events, ["one\ntwo"]);
    }

    #[test]
    fn handles_events_split_across_chunks_and_crlf() {
        let mut parser = SseParser::default();
        assert!(parser.push(b"data: {\"jsonrpc\"").is_empty());
        assert!(parser.push(b":\"2.0\"}\r\n").is_empty());
        assert_eq!(parser.push(b"\r\n"), [r#"{"jsonrpc":"2.0"}"#]);
    }

    #[test]
    fn keeps_multi_byte_characters_intact_across_chunks() {
        let mut parser = SseParser::default();
        let bytes = "data: grüße\n\n".as_bytes();
        let split = bytes.iter().position(|b| *b == 0xc3).unwrap() + 1;
        assert!(parser.push(&bytes[..split]).is_empty());
        assert_eq!(parser.push(&bytes[split..]), ["grüße"]);
    }
}
