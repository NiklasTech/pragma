use encoding_rs::{Encoding, UTF_16BE, UTF_16LE, UTF_8};

/// Text decoded from a file, with what is needed to write it back the same way.
#[derive(Debug, PartialEq, Eq)]
pub struct DecodedText {
    pub text: String,
    pub encoding: &'static Encoding,
    pub bom: bool,
}

pub fn encoding_for_label(label: &str) -> Result<&'static Encoding, String> {
    Encoding::for_label(label.trim().as_bytes()).ok_or_else(|| format!("Unknown encoding: {label}"))
}

/// Decodes `bytes` with `forced`, or detects the encoding: a BOM, then UTF-8, then a guess.
/// Bytes with NUL and no BOM are taken as binary.
pub fn decode(bytes: &[u8], forced: Option<&'static Encoding>) -> Result<DecodedText, String> {
    if let Some(encoding) = forced {
        let bom = Encoding::for_bom(bytes).is_some_and(|(found, _)| found == encoding);
        let (text, had_errors) = encoding.decode_with_bom_removal(bytes);
        if had_errors && encoding == UTF_8 {
            return Err("File is not valid UTF-8".to_string());
        }
        return Ok(DecodedText {
            text: text.into_owned(),
            encoding,
            bom,
        });
    }

    if let Some((encoding, bom_len)) = Encoding::for_bom(bytes) {
        let (text, _) = encoding.decode_without_bom_handling(&bytes[bom_len..]);
        return Ok(DecodedText {
            text: text.into_owned(),
            encoding,
            bom: true,
        });
    }

    if bytes.contains(&0) {
        return Err("Binary files are not supported".to_string());
    }

    if let Ok(text) = std::str::from_utf8(bytes) {
        return Ok(DecodedText {
            text: text.to_string(),
            encoding: UTF_8,
            bom: false,
        });
    }

    let mut detector = chardetng::EncodingDetector::new();
    detector.feed(bytes, true);
    let encoding = detector.guess(None, true);
    let (text, _) = encoding.decode_without_bom_handling(bytes);
    Ok(DecodedText {
        text: text.into_owned(),
        encoding,
        bom: false,
    })
}

/// Encodes `text`; fails instead of replacing characters the encoding cannot hold.
pub fn encode(text: &str, encoding: &'static Encoding, bom: bool) -> Result<Vec<u8>, String> {
    let mut bytes = Vec::with_capacity(text.len() + 3);
    if encoding == UTF_16LE || encoding == UTF_16BE {
        if bom {
            bytes.extend_from_slice(if encoding == UTF_16LE {
                &[0xFF, 0xFE]
            } else {
                &[0xFE, 0xFF]
            });
        }
        for unit in text.encode_utf16() {
            let pair = if encoding == UTF_16LE {
                unit.to_le_bytes()
            } else {
                unit.to_be_bytes()
            };
            bytes.extend_from_slice(&pair);
        }
        return Ok(bytes);
    }

    if bom && encoding == UTF_8 {
        bytes.extend_from_slice(&[0xEF, 0xBB, 0xBF]);
    }
    let (encoded, _, had_errors) = encoding.encode(text);
    if had_errors {
        return Err(format!(
            "Some characters cannot be saved as {}",
            encoding.name()
        ));
    }
    bytes.extend_from_slice(&encoded);
    Ok(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;
    use encoding_rs::{SHIFT_JIS, WINDOWS_1252};

    #[test]
    fn plain_utf8_stays_utf8_without_bom() {
        let decoded = decode("grüße".as_bytes(), None).unwrap();
        assert_eq!(decoded.text, "grüße");
        assert_eq!(decoded.encoding, UTF_8);
        assert!(!decoded.bom);
        assert_eq!(
            encode(&decoded.text, UTF_8, false).unwrap(),
            "grüße".as_bytes()
        );
    }

    #[test]
    fn bom_decides_the_encoding_and_round_trips() {
        let utf8 = [0xEF, 0xBB, 0xBF, b'h', b'i'];
        let decoded = decode(&utf8, None).unwrap();
        assert_eq!((decoded.text.as_str(), decoded.bom), ("hi", true));
        assert_eq!(encode("hi", UTF_8, true).unwrap(), utf8);

        let utf16 = [0xFF, 0xFE, b'h', 0, b'i', 0];
        let decoded = decode(&utf16, None).unwrap();
        assert_eq!(decoded.encoding, UTF_16LE);
        assert_eq!(decoded.text, "hi");
        assert_eq!(encode("hi", UTF_16LE, true).unwrap(), utf16);
        assert_eq!(
            encode("hi", UTF_16BE, true).unwrap(),
            [0xFE, 0xFF, 0, b'h', 0, b'i']
        );
    }

    #[test]
    fn legacy_single_byte_text_is_detected() {
        let latin = b"Der Fu\xdfg\xe4nger \xfcberquert die Stra\xdfe vor dem gro\xdfen Geb\xe4ude.";
        let decoded = decode(latin, None).unwrap();
        assert_eq!(decoded.encoding, WINDOWS_1252);
        assert!(decoded.text.contains("Fußgänger"));
        assert_eq!(encode(&decoded.text, WINDOWS_1252, false).unwrap(), latin);
    }

    #[test]
    fn forced_encoding_overrides_detection() {
        let (sjis, _, _) = SHIFT_JIS.encode("日本語のテキスト");
        let decoded = decode(&sjis, Some(SHIFT_JIS)).unwrap();
        assert_eq!(decoded.text, "日本語のテキスト");
        assert!(decode(&[0xFF, 0x41], Some(UTF_8)).is_err());
    }

    #[test]
    fn nul_bytes_without_bom_are_binary() {
        assert_eq!(
            decode(&[0x89, b'P', b'N', b'G', 0, 0], None).unwrap_err(),
            "Binary files are not supported"
        );
    }

    #[test]
    fn unmappable_characters_fail_instead_of_being_replaced() {
        assert!(encode("price: 5 €", WINDOWS_1252, false).is_ok());
        assert!(encode("日本", WINDOWS_1252, false).is_err());
    }

    #[test]
    fn labels_resolve_to_encodings() {
        assert_eq!(encoding_for_label("latin1").unwrap(), WINDOWS_1252);
        assert_eq!(encoding_for_label(" Shift_JIS ").unwrap(), SHIFT_JIS);
        assert!(encoding_for_label("nope").is_err());
    }
}
