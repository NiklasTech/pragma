use regex::{Captures, Regex};

const DROPPED_ELEMENTS: [&str; 7] = [
    "head", "script", "style", "noscript", "svg", "template", "iframe",
];
const BLOCK_ELEMENTS: &str = "p|div|section|article|header|footer|nav|main|aside|ul|ol|table|tr|h[1-6]|pre|blockquote|figure|figcaption|dl|dt|dd|hr";

fn replace(text: &str, pattern: &str, with: &str) -> Result<String, String> {
    let regex = Regex::new(pattern).map_err(|e| e.to_string())?;
    Ok(regex.replace_all(text, with).into_owned())
}

fn decode_entity(captures: &Captures) -> String {
    let entity = &captures[1];
    let decoded = match entity {
        "amp" => Some('&'),
        "lt" => Some('<'),
        "gt" => Some('>'),
        "quot" => Some('"'),
        "apos" => Some('\''),
        "nbsp" => Some(' '),
        _ if entity.starts_with("#x") || entity.starts_with("#X") => {
            u32::from_str_radix(&entity[2..], 16)
                .ok()
                .and_then(char::from_u32)
        }
        _ if entity.starts_with('#') => entity[1..].parse().ok().and_then(char::from_u32),
        _ => None,
    };
    decoded.map_or_else(|| captures[0].to_string(), |c| c.to_string())
}

fn normalize_whitespace(text: &str) -> String {
    let mut lines: Vec<String> = Vec::new();
    for line in text.lines() {
        let collapsed = line.split_whitespace().collect::<Vec<_>>().join(" ");
        if collapsed.is_empty() && lines.last().map_or(true, |last| last.is_empty()) {
            continue;
        }
        lines.push(collapsed);
    }
    while lines.last().is_some_and(|last| last.is_empty()) {
        lines.pop();
    }
    lines.join("\n")
}

/// Turns an HTML document into readable plain text: drops scripts, styles and
/// markup, keeps block structure as line breaks and decodes common entities.
pub fn html_to_text(html: &str) -> Result<String, String> {
    let mut text = replace(html, r"(?s)<!--.*?-->", "")?;
    for element in DROPPED_ELEMENTS {
        text = replace(
            &text,
            &format!(r"(?is)<{element}\b[^>]*>.*?</{element}\s*>"),
            "",
        )?;
    }
    text = replace(&text, r"(?i)<br\s*/?>", "\n")?;
    text = replace(&text, r"(?i)<li\b[^>]*>", "\n- ")?;
    text = replace(
        &text,
        &format!(r"(?i)</?(?:{BLOCK_ELEMENTS})\b[^>]*>"),
        "\n",
    )?;
    text = replace(&text, r"<[^>]*>", "")?;

    let entities =
        Regex::new(r"&(#[xX][0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);").map_err(|e| e.to_string())?;
    let decoded = entities.replace_all(&text, decode_entity);
    Ok(normalize_whitespace(&decoded))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn drops_scripts_styles_and_the_head() {
        let html = "<html><head><title>T</title><style>p{}</style></head><body><script>alert(1)</script><p>Hello</p></body></html>";
        assert_eq!(html_to_text(html).unwrap(), "Hello");
    }

    #[test]
    fn keeps_block_structure_as_lines() {
        let html =
            "<h1>Title</h1><p>First   paragraph</p><ul><li>One</li><li>Two</li></ul>line<br>break";
        assert_eq!(
            html_to_text(html).unwrap(),
            "Title\n\nFirst paragraph\n\n- One\n- Two\nline\nbreak"
        );
    }

    #[test]
    fn decodes_entities_after_stripping_tags() {
        let html = "<p>a &lt;b&gt; &amp; &#169; &#x41;&nbsp;&unknown;</p>";
        assert_eq!(html_to_text(html).unwrap(), "a <b> & \u{a9} A &unknown;");
    }

    #[test]
    fn collapses_blank_lines_and_drops_comments() {
        let html = "<div>A</div>\n\n\n<!-- hidden -->\n<div>\n\nB</div>";
        assert_eq!(html_to_text(html).unwrap(), "A\n\nB");
    }
}
