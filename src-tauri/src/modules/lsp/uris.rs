fn percent_encode_segment(segment: &str) -> String {
    let mut out = String::with_capacity(segment.len());
    for byte in segment.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' | b':' | b'@' => {
                out.push(byte as char)
            }
            _ => out.push_str(&format!("%{byte:02X}")),
        }
    }
    out
}

fn percent_decode(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' && index + 2 < bytes.len() {
            if let Some(value) = std::str::from_utf8(&bytes[index + 1..index + 3])
                .ok()
                .and_then(|digits| u8::from_str_radix(digits, 16).ok())
            {
                out.push(value);
                index += 3;
                continue;
            }
        }
        out.push(bytes[index]);
        index += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

pub fn path_to_uri(path: &str) -> String {
    let normalized = path.replace('\\', "/");
    let mut uri = String::with_capacity(normalized.len() + 8);
    uri.push_str("file://");
    for segment in normalized.split('/') {
        if segment.is_empty() {
            continue;
        }
        uri.push('/');
        uri.push_str(&percent_encode_segment(segment));
    }
    uri
}

pub fn uri_to_path(uri: &str) -> String {
    let Some(rest) = uri.strip_prefix("file://") else {
        return uri.to_string();
    };
    let decoded = percent_decode(rest);

    #[cfg(windows)]
    {
        let without_slash = decoded.strip_prefix('/').unwrap_or(&decoded);
        let bytes = without_slash.as_bytes();
        if bytes.len() >= 2 && bytes[0].is_ascii_alphabetic() && bytes[1] == b':' {
            let drive = (bytes[0] as char).to_ascii_uppercase();
            return format!("{drive}:{}", &without_slash[2..]).replace('/', "\\");
        }
        decoded.replace('/', "\\")
    }

    #[cfg(not(windows))]
    {
        decoded
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encodes_spaces_and_backslashes() {
        assert_eq!(
            path_to_uri("C:\\Users\\some one\\main file.ts"),
            "file:///C:/Users/some%20one/main%20file.ts"
        );
    }

    #[test]
    fn encodes_unix_absolute_path() {
        assert_eq!(
            path_to_uri("/home/user/my project/lib.rs"),
            "file:///home/user/my%20project/lib.rs"
        );
    }

    #[cfg(windows)]
    #[test]
    fn round_trips_windows_path() {
        let path = "C:\\Users\\x\\project\\a.ts";
        assert_eq!(uri_to_path(&path_to_uri(path)), path);
    }

    #[cfg(windows)]
    #[test]
    fn decodes_lowercase_drive_and_encoded_colon() {
        assert_eq!(uri_to_path("file:///c%3A/Users/x"), "C:\\Users\\x");
    }

    #[cfg(not(windows))]
    #[test]
    fn round_trips_unix_path() {
        let path = "/home/user/project/a.ts";
        assert_eq!(uri_to_path(&path_to_uri(path)), path);
    }

    #[test]
    fn passes_through_non_file_uris() {
        assert_eq!(uri_to_path("untitled:Untitled-1"), "untitled:Untitled-1");
    }

    #[cfg(windows)]
    #[test]
    fn percent_before_multibyte_char_passes_through() {
        assert_eq!(uri_to_path("file:///x%aä"), "\\x%aä");
    }

    #[cfg(windows)]
    #[test]
    fn truncated_percent_sequence_passes_through() {
        assert_eq!(uri_to_path("file:///trailing%"), "\\trailing%");
    }

    #[cfg(windows)]
    #[test]
    fn invalid_hex_digits_pass_through_literally() {
        assert_eq!(uri_to_path("file:///bad%ZZhex"), "\\bad%ZZhex");
    }
}
