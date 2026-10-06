mod html_text;

use html_text::html_to_text;

use reqwest::header::CONTENT_TYPE;
use reqwest::Url;
use serde::Serialize;
use std::time::Duration;

const MAX_BODY_BYTES: usize = 2 * 1024 * 1024;
const REQUEST_TIMEOUT: Duration = Duration::from_secs(20);

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FetchedUrl {
    pub url: String,
    pub status: u16,
    pub content_type: String,
    pub text: String,
    pub truncated: bool,
}

fn parse_http_url(raw: &str) -> Result<Url, String> {
    let url = Url::parse(raw.trim()).map_err(|e| format!("Invalid URL: {e}"))?;
    match url.scheme() {
        "http" | "https" => Ok(url),
        scheme => Err(format!(
            "Only http and https URLs can be fetched, not {scheme}"
        )),
    }
}

fn is_text_content_type(content_type: &str) -> bool {
    let lower = content_type.to_ascii_lowercase();
    lower.is_empty()
        || lower.starts_with("text/")
        || ["json", "xml", "javascript", "html", "yaml", "toml"]
            .iter()
            .any(|kind| lower.contains(kind))
}

fn is_html(content_type: &str, body: &str) -> bool {
    if content_type.to_ascii_lowercase().contains("html") {
        return true;
    }
    let start = body
        .trim_start()
        .chars()
        .take(15)
        .collect::<String>()
        .to_ascii_lowercase();
    content_type.is_empty() && (start.starts_with("<!doctype html") || start.starts_with("<html"))
}

/// Fetches an http(s) URL and returns its text, with HTML reduced to readable text.
#[tauri::command]
pub async fn fetch_url_text(url: String) -> Result<FetchedUrl, String> {
    let url = parse_http_url(&url)?;
    let client = reqwest::Client::builder()
        .timeout(REQUEST_TIMEOUT)
        .user_agent(concat!("Pragma/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {e}"))?;
    let mut response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Request failed: {e}"))?;

    let status = response.status().as_u16();
    let final_url = response.url().to_string();
    let content_type = response
        .headers()
        .get(CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("")
        .to_string();
    if !is_text_content_type(&content_type) {
        return Err(format!("Cannot read {content_type} content as text"));
    }

    let mut body = Vec::new();
    let mut truncated = false;
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|e| format!("Failed to read response: {e}"))?
    {
        let remaining = MAX_BODY_BYTES - body.len();
        if chunk.len() > remaining {
            body.extend_from_slice(&chunk[..remaining]);
            truncated = true;
            break;
        }
        body.extend_from_slice(&chunk);
    }

    let raw = String::from_utf8_lossy(&body);
    let text = if is_html(&content_type, &raw) {
        html_to_text(&raw)?
    } else {
        raw.into_owned()
    };

    Ok(FetchedUrl {
        url: final_url,
        status,
        content_type,
        text,
        truncated,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_only_http_and_https_urls() {
        assert!(parse_http_url("https://example.com/docs").is_ok());
        assert!(parse_http_url(" http://localhost:5173 ").is_ok());
        assert!(parse_http_url("file:///etc/passwd").is_err());
        assert!(parse_http_url("ftp://example.com").is_err());
        assert!(parse_http_url("not a url").is_err());
    }

    #[test]
    fn reads_text_like_content_types_only() {
        assert!(is_text_content_type("text/html; charset=utf-8"));
        assert!(is_text_content_type("application/json"));
        assert!(is_text_content_type("application/xhtml+xml"));
        assert!(is_text_content_type(""));
        assert!(!is_text_content_type("image/png"));
        assert!(!is_text_content_type("application/octet-stream"));
    }

    #[test]
    fn detects_html_by_content_type_or_untyped_markup() {
        assert!(is_html("text/html", ""));
        assert!(is_html("", "  <!DOCTYPE html><html></html>"));
        assert!(!is_html("text/plain", "<html>"));
        assert!(!is_html("", "plain text"));
    }
}
