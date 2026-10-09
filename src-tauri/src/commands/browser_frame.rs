use std::time::Duration;

use reqwest::header::{HeaderMap, CONTENT_SECURITY_POLICY, X_FRAME_OPTIONS};
use reqwest::Url;
use serde::Serialize;

const PROBE_TIMEOUT: Duration = Duration::from_secs(5);

#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct FramePolicy {
    /// True when the page tells browsers not to show it inside a frame of another site.
    pub blocked: bool,
    pub reason: Option<String>,
}

fn parse_http_url(raw: &str) -> Result<Url, String> {
    let url = Url::parse(raw.trim()).map_err(|e| format!("Invalid URL: {e}"))?;
    match url.scheme() {
        "http" | "https" => Ok(url),
        scheme => Err(format!(
            "Only http and https URLs can be checked, not {scheme}"
        )),
    }
}

fn frame_ancestors(csp: &str) -> Option<&str> {
    csp.split(';').map(str::trim).find_map(|directive| {
        let (name, value) = directive
            .split_once(char::is_whitespace)
            .unwrap_or((directive, ""));
        name.eq_ignore_ascii_case("frame-ancestors")
            .then_some(value.trim())
    })
}

/// Reads `X-Frame-Options` and CSP `frame-ancestors`; the app's own origin is never listed,
/// so anything short of a wildcard refuses the browser pane.
fn policy_from_headers(headers: &HeaderMap) -> FramePolicy {
    let mut has_frame_ancestors = false;
    for value in headers.get_all(CONTENT_SECURITY_POLICY) {
        let Ok(csp) = value.to_str() else { continue };
        if let Some(sources) = frame_ancestors(csp) {
            has_frame_ancestors = true;
            if !sources.split_whitespace().any(|source| source == "*") {
                return FramePolicy {
                    blocked: true,
                    reason: Some(format!(
                        "Content-Security-Policy: frame-ancestors {sources}"
                    )),
                };
            }
        }
    }

    // Browsers ignore X-Frame-Options once frame-ancestors is present.
    if has_frame_ancestors {
        return FramePolicy {
            blocked: false,
            reason: None,
        };
    }

    if let Some(value) = headers.get(X_FRAME_OPTIONS).and_then(|v| v.to_str().ok()) {
        let option = value.trim();
        if option.eq_ignore_ascii_case("deny") || option.eq_ignore_ascii_case("sameorigin") {
            return FramePolicy {
                blocked: true,
                reason: Some(format!("X-Frame-Options: {}", option.to_ascii_uppercase())),
            };
        }
    }

    FramePolicy {
        blocked: false,
        reason: None,
    }
}

/// Tells whether a page refuses to be framed, so the browser pane can explain a blank frame.
/// A page that cannot be reached is reported as not blocked and left to the frame.
#[tauri::command]
pub async fn browser_frame_policy(url: String) -> Result<FramePolicy, String> {
    let url = parse_http_url(&url)?;
    let client = reqwest::Client::builder()
        .timeout(PROBE_TIMEOUT)
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {e}"))?;

    match client.get(url).send().await {
        Ok(response) => Ok(policy_from_headers(response.headers())),
        Err(_) => Ok(FramePolicy {
            blocked: false,
            reason: None,
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use reqwest::header::HeaderValue;

    fn headers(pairs: &[(&'static str, &'static str)]) -> HeaderMap {
        let mut map = HeaderMap::new();
        for (name, value) in pairs {
            map.append(*name, HeaderValue::from_static(value));
        }
        map
    }

    #[test]
    fn only_http_urls_are_checked() {
        assert!(parse_http_url("https://github.com").is_ok());
        assert!(parse_http_url("http://localhost:5173/").is_ok());
        assert!(parse_http_url("file:///etc/passwd").is_err());
        assert!(parse_http_url("not a url").is_err());
    }

    #[test]
    fn x_frame_options_deny_and_sameorigin_block() {
        assert!(policy_from_headers(&headers(&[("x-frame-options", "DENY")])).blocked);
        let policy = policy_from_headers(&headers(&[("x-frame-options", "sameorigin")]));
        assert!(policy.blocked);
        assert_eq!(
            policy.reason.as_deref(),
            Some("X-Frame-Options: SAMEORIGIN")
        );
    }

    #[test]
    fn frame_ancestors_blocks_unless_it_allows_everyone() {
        let policy = policy_from_headers(&headers(&[(
            "content-security-policy",
            "default-src 'self'; frame-ancestors 'none'",
        )]));
        assert!(policy.blocked);
        assert_eq!(
            policy.reason.as_deref(),
            Some("Content-Security-Policy: frame-ancestors 'none'")
        );
        assert!(
            policy_from_headers(&headers(&[(
                "content-security-policy",
                "frame-ancestors 'self' https://github.com"
            )]))
            .blocked
        );
        assert!(
            !policy_from_headers(&headers(&[
                ("content-security-policy", "frame-ancestors *"),
                ("x-frame-options", "DENY"),
            ]))
            .blocked
        );
    }

    #[test]
    fn pages_without_frame_headers_are_allowed() {
        assert_eq!(
            policy_from_headers(&headers(&[(
                "content-security-policy",
                "default-src 'self'"
            )])),
            FramePolicy {
                blocked: false,
                reason: None
            }
        );
        assert!(!policy_from_headers(&headers(&[("x-frame-options", "ALLOWALL")])).blocked);
    }
}
