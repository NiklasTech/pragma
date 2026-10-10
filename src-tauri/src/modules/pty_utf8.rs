/// Decodes PTY output read in chunks, holding back a character that a read cut in half.
#[derive(Default)]
pub struct Utf8StreamDecoder {
    pending: Vec<u8>,
}

impl Utf8StreamDecoder {
    pub fn decode(&mut self, chunk: &[u8]) -> String {
        self.pending.extend_from_slice(chunk);
        let complete = self.pending.len() - incomplete_tail_len(&self.pending);
        let text = String::from_utf8_lossy(&self.pending[..complete]).into_owned();
        self.pending.drain(..complete);
        text
    }

    pub fn finish(&mut self) -> String {
        let text = String::from_utf8_lossy(&self.pending).into_owned();
        self.pending.clear();
        text
    }
}

/// Length of a multi-byte sequence at the end that still misses continuation bytes.
fn incomplete_tail_len(bytes: &[u8]) -> usize {
    for back in 1..=bytes.len().min(3) {
        let byte = bytes[bytes.len() - back];
        if byte & 0b1100_0000 == 0b1000_0000 {
            continue;
        }
        let needed = match byte {
            0xC0..=0xDF => 2,
            0xE0..=0xEF => 3,
            0xF0..=0xF7 => 4,
            _ => 1,
        };
        return if needed > back { back } else { 0 };
    }
    0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn joins_a_character_split_across_reads() {
        let line = "──".as_bytes();
        let mut decoder = Utf8StreamDecoder::default();

        assert_eq!(decoder.decode(&line[..4]), "─");
        assert_eq!(decoder.decode(&line[4..]), "─");
    }

    #[test]
    fn joins_a_four_byte_character_split_into_single_bytes() {
        let bytes = "a\u{1F600}b".as_bytes();
        let mut decoder = Utf8StreamDecoder::default();
        let text: String = bytes.iter().map(|byte| decoder.decode(&[*byte])).collect();

        assert_eq!(text, "a\u{1F600}b");
    }

    #[test]
    fn passes_complete_text_through() {
        let mut decoder = Utf8StreamDecoder::default();

        assert_eq!(
            decoder.decode("ok ─ \u{1F600}".as_bytes()),
            "ok ─ \u{1F600}"
        );
        assert_eq!(decoder.finish(), "");
    }

    #[test]
    fn replaces_invalid_bytes_without_stalling() {
        let mut decoder = Utf8StreamDecoder::default();

        assert_eq!(decoder.decode(&[b'a', 0xFF, b'b']), "a\u{FFFD}b");
        assert_eq!(
            decoder.decode(&[0x80, 0x80, 0x80, b'c']),
            "\u{FFFD}\u{FFFD}\u{FFFD}c"
        );
    }

    #[test]
    fn flushes_a_cut_off_character_at_the_end() {
        let mut decoder = Utf8StreamDecoder::default();

        assert_eq!(decoder.decode(&"─".as_bytes()[..2]), "");
        assert_eq!(decoder.finish(), "\u{FFFD}");
    }
}
