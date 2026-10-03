//! OAuth for remote MCP servers: protected resource and authorization server
//! discovery, dynamic client registration, PKCE through a loopback redirect
//! and token refresh. Tokens live in the OS keychain.

use crate::modules::mcp::error::{McpError, Result};
use crate::modules::mcp::http::validate_url;
use crate::modules::mcp::secrets;
use base64::Engine;
use reqwest::Url;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::time::Duration;
use tauri::AppHandle;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

const CALLBACK_PATH: &str = "/callback";
const AUTHORIZE_TIMEOUT: Duration = Duration::from_secs(5 * 60);
const HTTP_TIMEOUT: Duration = Duration::from_secs(20);
const REFRESH_MARGIN_SECS: i64 = 60;
const MAX_CALLBACK_REQUEST: usize = 8 * 1024;
const CLIENT_NAME: &str = "Pragma";
const CALLBACK_PAGE: &str = "<!doctype html><html><head><meta charset=\"utf-8\"><title>Pragma</title></head><body style=\"font-family:system-ui;padding:3rem;text-align:center\"><h1>Signed in</h1><p>You can close this window and return to Pragma.</p></body></html>";

/// Tokens and the client they were issued to, as stored in the keychain.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredTokens {
    pub access_token: String,
    #[serde(default)]
    pub refresh_token: Option<String>,
    /// Unix seconds.
    #[serde(default)]
    pub expires_at: Option<i64>,
    pub token_endpoint: String,
    pub client_id: String,
    #[serde(default)]
    pub client_secret: Option<String>,
    pub resource: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct AuthServerMetadata {
    authorization_endpoint: String,
    token_endpoint: String,
    registration_endpoint: Option<String>,
}

#[derive(Debug, Deserialize)]
struct TokenResponse {
    access_token: String,
    #[serde(default)]
    refresh_token: Option<String>,
    #[serde(default)]
    expires_in: Option<i64>,
}

fn oauth_error(message: impl Into<String>) -> McpError {
    McpError::OAuth(message.into())
}

fn origin(url: &Url) -> String {
    let mut origin = format!("{}://{}", url.scheme(), url.host_str().unwrap_or_default());
    if let Some(port) = url.port() {
        origin.push_str(&format!(":{port}"));
    }
    origin
}

/// The server URL without query or fragment, used as the RFC 8707 resource.
fn canonical_resource(url: &Url) -> String {
    let mut resource = url.clone();
    resource.set_query(None);
    resource.set_fragment(None);
    resource.to_string().trim_end_matches('/').to_string()
}

fn is_loopback(url: &Url) -> bool {
    matches!(
        url.host_str(),
        Some("localhost") | Some("127.0.0.1") | Some("[::1]") | Some("::1")
    )
}

/// Authorization endpoints must use https; plain http is only allowed on loopback.
fn require_secure(endpoint: &str) -> Result<String> {
    let url =
        Url::parse(endpoint).map_err(|e| oauth_error(format!("invalid URL {endpoint}: {e}")))?;
    if url.scheme() == "https" || (url.scheme() == "http" && is_loopback(&url)) {
        Ok(endpoint.to_string())
    } else {
        Err(oauth_error(format!("{endpoint} must use https")))
    }
}

/// Reads one `key="value"` parameter from a `WWW-Authenticate` challenge.
fn challenge_param(challenge: &str, key: &str) -> Option<String> {
    let start = challenge.find(&format!("{key}="))? + key.len() + 1;
    let rest = &challenge[start..];
    let value = if let Some(quoted) = rest.strip_prefix('"') {
        quoted.split('"').next()?
    } else {
        rest.split([',', ' ']).next()?
    };
    Some(value.to_string()).filter(|value| !value.is_empty())
}

fn well_known(origin: &str, name: &str, path: &str) -> String {
    let path = path.trim_end_matches('/');
    format!("{origin}/.well-known/{name}{path}")
}

fn random_token() -> String {
    format!(
        "{}{}",
        uuid::Uuid::new_v4().simple(),
        uuid::Uuid::new_v4().simple()
    )
}

fn pkce_challenge(verifier: &str) -> String {
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()))
}

fn form_component(value: &str) -> String {
    value
        .bytes()
        .map(|byte| match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'*' => {
                (byte as char).to_string()
            }
            b' ' => "+".to_string(),
            other => format!("%{other:02X}"),
        })
        .collect()
}

fn form_encode(pairs: &[(&str, &str)]) -> String {
    pairs
        .iter()
        .map(|(key, value)| format!("{}={}", form_component(key), form_component(value)))
        .collect::<Vec<_>>()
        .join("&")
}

fn http_client() -> Result<reqwest::Client> {
    reqwest::Client::builder()
        .timeout(HTTP_TIMEOUT)
        .user_agent(concat!("pragma/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|e| oauth_error(e.to_string()))
}

async fn fetch_json(http: &reqwest::Client, url: &str) -> Option<Value> {
    let response = http.get(url).send().await.ok()?;
    if !response.status().is_success() {
        return None;
    }
    response.json().await.ok()
}

/// Asks the server without credentials so its 401 names the resource metadata.
async fn probe_challenge(http: &reqwest::Client, server: &Url) -> String {
    let body = json!({
        "jsonrpc": "2.0",
        "id": 0,
        "method": "initialize",
        "params": { "protocolVersion": crate::modules::mcp::connection::PROTOCOL_VERSION, "capabilities": {}, "clientInfo": { "name": "pragma", "version": env!("CARGO_PKG_VERSION") } },
    });
    let response = http
        .post(server.clone())
        .header(
            reqwest::header::ACCEPT,
            "application/json, text/event-stream",
        )
        .json(&body)
        .send()
        .await;
    response
        .ok()
        .and_then(|response| {
            response
                .headers()
                .get(reqwest::header::WWW_AUTHENTICATE)?
                .to_str()
                .ok()
                .map(str::to_string)
        })
        .unwrap_or_default()
}

/// The authorization server and scopes from the protected resource metadata.
async fn discover_resource(
    http: &reqwest::Client,
    server: &Url,
    challenge: &str,
) -> (Option<String>, Vec<String>) {
    let mut candidates = Vec::new();
    if let Some(url) = challenge_param(challenge, "resource_metadata") {
        candidates.push(url);
    }
    let origin = origin(server);
    candidates.push(well_known(
        &origin,
        "oauth-protected-resource",
        server.path(),
    ));
    candidates.push(well_known(&origin, "oauth-protected-resource", ""));

    let challenge_scopes: Vec<String> = challenge_param(challenge, "scope")
        .map(|scope| scope.split_whitespace().map(str::to_string).collect())
        .unwrap_or_default();
    for candidate in candidates {
        let Some(metadata) = fetch_json(http, &candidate).await else {
            continue;
        };
        let issuer = metadata
            .get("authorization_servers")
            .and_then(Value::as_array)
            .and_then(|servers| servers.first())
            .and_then(Value::as_str)
            .map(str::to_string);
        let scopes = if challenge_scopes.is_empty() {
            metadata
                .get("scopes_supported")
                .and_then(Value::as_array)
                .map(|scopes| {
                    scopes
                        .iter()
                        .filter_map(Value::as_str)
                        .map(str::to_string)
                        .collect()
                })
                .unwrap_or_default()
        } else {
            challenge_scopes.clone()
        };
        return (issuer, scopes);
    }
    (None, challenge_scopes)
}

fn parse_auth_metadata(metadata: &Value) -> Option<AuthServerMetadata> {
    let endpoint = |key: &str| {
        metadata
            .get(key)
            .and_then(Value::as_str)
            .map(str::to_string)
    };
    Some(AuthServerMetadata {
        authorization_endpoint: endpoint("authorization_endpoint")?,
        token_endpoint: endpoint("token_endpoint")?,
        registration_endpoint: endpoint("registration_endpoint"),
    })
}

/// RFC 8414 and OpenID discovery, falling back to the default endpoint paths.
async fn discover_auth_server(http: &reqwest::Client, issuer: &str) -> Result<AuthServerMetadata> {
    let url =
        Url::parse(issuer).map_err(|e| oauth_error(format!("invalid issuer {issuer}: {e}")))?;
    let origin = origin(&url);
    let path = url.path().trim_end_matches('/');
    let candidates = if path.is_empty() {
        vec![
            well_known(&origin, "oauth-authorization-server", ""),
            well_known(&origin, "openid-configuration", ""),
        ]
    } else {
        vec![
            well_known(&origin, "oauth-authorization-server", path),
            well_known(&origin, "openid-configuration", path),
            format!("{origin}{path}/.well-known/openid-configuration"),
        ]
    };

    let mut metadata = None;
    for candidate in candidates {
        if let Some(found) = fetch_json(http, &candidate)
            .await
            .as_ref()
            .and_then(parse_auth_metadata)
        {
            metadata = Some(found);
            break;
        }
    }
    let metadata = metadata.unwrap_or_else(|| AuthServerMetadata {
        authorization_endpoint: format!("{origin}/authorize"),
        token_endpoint: format!("{origin}/token"),
        registration_endpoint: Some(format!("{origin}/register")),
    });
    Ok(AuthServerMetadata {
        authorization_endpoint: require_secure(&metadata.authorization_endpoint)?,
        token_endpoint: require_secure(&metadata.token_endpoint)?,
        registration_endpoint: metadata
            .registration_endpoint
            .map(|endpoint| require_secure(&endpoint))
            .transpose()?,
    })
}

async fn register_client(
    http: &reqwest::Client,
    endpoint: &str,
    redirect_uri: &str,
) -> Result<(String, Option<String>)> {
    let response = http
        .post(endpoint)
        .json(&json!({
            "client_name": CLIENT_NAME,
            "redirect_uris": [redirect_uri],
            "grant_types": ["authorization_code", "refresh_token"],
            "response_types": ["code"],
            "token_endpoint_auth_method": "none",
        }))
        .send()
        .await
        .map_err(|e| oauth_error(format!("client registration failed: {e}")))?;
    if !response.status().is_success() {
        return Err(oauth_error(format!(
            "client registration failed: HTTP {}",
            response.status()
        )));
    }
    let body: Value = response
        .json()
        .await
        .map_err(|e| oauth_error(format!("invalid registration response: {e}")))?;
    let client_id = body
        .get("client_id")
        .and_then(Value::as_str)
        .ok_or_else(|| oauth_error("registration response has no client_id"))?
        .to_string();
    let secret = body
        .get("client_secret")
        .and_then(Value::as_str)
        .map(str::to_string);
    Ok((client_id, secret))
}

struct AuthorizeRequest<'a> {
    endpoint: &'a str,
    client_id: &'a str,
    redirect_uri: &'a str,
    challenge: &'a str,
    state: &'a str,
    scopes: &'a [String],
    resource: &'a str,
}

fn authorize_url(request: &AuthorizeRequest<'_>) -> Result<String> {
    let mut url = Url::parse(request.endpoint)
        .map_err(|e| oauth_error(format!("invalid authorization endpoint: {e}")))?;
    {
        let mut query = url.query_pairs_mut();
        query
            .append_pair("response_type", "code")
            .append_pair("client_id", request.client_id)
            .append_pair("redirect_uri", request.redirect_uri)
            .append_pair("code_challenge", request.challenge)
            .append_pair("code_challenge_method", "S256")
            .append_pair("state", request.state)
            .append_pair("resource", request.resource);
        if !request.scopes.is_empty() {
            query.append_pair("scope", &request.scopes.join(" "));
        }
    }
    Ok(url.to_string())
}

/// The `code` from a callback request line, once its `state` matches.
fn callback_code(request_line: &str, state: &str) -> Option<Result<String>> {
    let target = request_line.split_whitespace().nth(1)?;
    let url = Url::parse(&format!("http://127.0.0.1{target}")).ok()?;
    if url.path() != CALLBACK_PATH {
        return None;
    }
    let param = |name: &str| {
        url.query_pairs()
            .find(|(key, _)| key == name)
            .map(|(_, value)| value.to_string())
    };
    if param("state").as_deref() != Some(state) {
        return Some(Err(oauth_error("the authorization response did not match")));
    }
    if let Some(error) = param("error") {
        let description = param("error_description").unwrap_or_default();
        return Some(Err(oauth_error(
            format!("{error} {description}").trim().to_string(),
        )));
    }
    Some(param("code").ok_or_else(|| oauth_error("the authorization response has no code")))
}

async fn wait_for_code(listener: TcpListener, state: &str) -> Result<String> {
    loop {
        let (mut stream, _) = listener
            .accept()
            .await
            .map_err(|e| oauth_error(format!("callback listener failed: {e}")))?;
        let mut buffer = vec![0u8; MAX_CALLBACK_REQUEST];
        let read = stream.read(&mut buffer).await.unwrap_or(0);
        let request = String::from_utf8_lossy(&buffer[..read]);
        let line = request.lines().next().unwrap_or_default();
        match callback_code(line, state) {
            Some(result) => {
                let page = if result.is_ok() {
                    CALLBACK_PAGE.to_string()
                } else {
                    CALLBACK_PAGE.replace("Signed in", "Sign-in failed")
                };
                let response = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{page}",
                    page.len()
                );
                let _ = stream.write_all(response.as_bytes()).await;
                return result;
            }
            None => {
                let _ = stream
                    .write_all(
                        b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
                    )
                    .await;
            }
        }
    }
}

async fn request_tokens(
    http: &reqwest::Client,
    token_endpoint: &str,
    pairs: &[(&str, &str)],
) -> Result<TokenResponse> {
    let response = http
        .post(token_endpoint)
        .header(
            reqwest::header::CONTENT_TYPE,
            "application/x-www-form-urlencoded",
        )
        .header(reqwest::header::ACCEPT, "application/json")
        .body(form_encode(pairs))
        .send()
        .await
        .map_err(|e| oauth_error(format!("token request failed: {e}")))?;
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        let body: String = body.chars().take(300).collect();
        return Err(oauth_error(format!(
            "token request failed: HTTP {status} {body}"
        )));
    }
    response
        .json()
        .await
        .map_err(|e| oauth_error(format!("invalid token response: {e}")))
}

fn expires_at(expires_in: Option<i64>) -> Option<i64> {
    expires_in.map(|seconds| chrono::Utc::now().timestamp() + seconds)
}

fn store(server_id: &str, tokens: &StoredTokens) -> Result<()> {
    let json = serde_json::to_string(tokens)?;
    secrets::set_oauth_tokens(server_id, &json)
}

fn load(server_id: &str) -> Result<Option<StoredTokens>> {
    Ok(secrets::get_oauth_tokens(server_id)?.and_then(|json| serde_json::from_str(&json).ok()))
}

/// Runs the browser sign-in for a remote server and stores the tokens.
pub async fn authorize(app: &AppHandle, server_id: &str, server_url: &str) -> Result<()> {
    let server = validate_url(server_url)?;
    let resource = canonical_resource(&server);
    let http = http_client()?;

    let challenge = probe_challenge(&http, &server).await;
    let (issuer, scopes) = discover_resource(&http, &server, &challenge).await;
    let issuer = issuer.unwrap_or_else(|| origin(&server));
    let metadata = discover_auth_server(&http, &issuer).await?;

    let listener = TcpListener::bind(("127.0.0.1", 0))
        .await
        .map_err(|e| oauth_error(format!("cannot open the callback port: {e}")))?;
    let port = listener
        .local_addr()
        .map_err(|e| oauth_error(e.to_string()))?
        .port();
    let redirect_uri = format!("http://127.0.0.1:{port}{CALLBACK_PATH}");

    let registration = metadata.registration_endpoint.as_deref().ok_or_else(|| {
        oauth_error("the authorization server does not support dynamic client registration")
    })?;
    let (client_id, client_secret) = register_client(&http, registration, &redirect_uri).await?;

    let verifier = random_token();
    let state = random_token();
    let url = authorize_url(&AuthorizeRequest {
        endpoint: &metadata.authorization_endpoint,
        client_id: &client_id,
        redirect_uri: &redirect_uri,
        challenge: &pkce_challenge(&verifier),
        state: &state,
        scopes: &scopes,
        resource: &resource,
    })?;

    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_url(&url, None::<&str>)
        .map_err(|e| oauth_error(format!("cannot open the browser: {e}")))?;

    let code = tokio::time::timeout(AUTHORIZE_TIMEOUT, wait_for_code(listener, &state))
        .await
        .map_err(|_| oauth_error("sign-in timed out"))??;

    let mut pairs = vec![
        ("grant_type", "authorization_code"),
        ("code", code.as_str()),
        ("redirect_uri", redirect_uri.as_str()),
        ("client_id", client_id.as_str()),
        ("code_verifier", verifier.as_str()),
        ("resource", resource.as_str()),
    ];
    if let Some(secret) = client_secret.as_deref() {
        pairs.push(("client_secret", secret));
    }
    let tokens = request_tokens(&http, &metadata.token_endpoint, &pairs).await?;

    store(
        server_id,
        &StoredTokens {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_at: expires_at(tokens.expires_in),
            token_endpoint: metadata.token_endpoint,
            client_id,
            client_secret,
            resource,
        },
    )
}

/// Exchanges the refresh token; `None` when there is nothing to refresh with.
pub async fn refresh(server_id: &str) -> Result<Option<String>> {
    let Some(stored) = load(server_id)? else {
        return Ok(None);
    };
    let Some(refresh_token) = stored.refresh_token.clone() else {
        return Ok(None);
    };
    let http = http_client()?;
    let mut pairs = vec![
        ("grant_type", "refresh_token"),
        ("refresh_token", refresh_token.as_str()),
        ("client_id", stored.client_id.as_str()),
        ("resource", stored.resource.as_str()),
    ];
    if let Some(secret) = stored.client_secret.as_deref() {
        pairs.push(("client_secret", secret));
    }
    let tokens = request_tokens(&http, &stored.token_endpoint, &pairs).await?;
    let updated = StoredTokens {
        access_token: tokens.access_token.clone(),
        refresh_token: tokens.refresh_token.or(stored.refresh_token),
        expires_at: expires_at(tokens.expires_in),
        ..stored
    };
    store(server_id, &updated)?;
    Ok(Some(tokens.access_token))
}

/// A valid access token, refreshed when it is about to expire.
pub async fn access_token(server_id: &str) -> Result<Option<String>> {
    let Some(stored) = load(server_id)? else {
        return Ok(None);
    };
    let expiring = stored
        .expires_at
        .is_some_and(|at| at <= chrono::Utc::now().timestamp() + REFRESH_MARGIN_SECS);
    if !expiring {
        return Ok(Some(stored.access_token));
    }
    match refresh(server_id).await {
        Ok(Some(token)) => Ok(Some(token)),
        _ => Ok(None),
    }
}

pub fn has_tokens(server_id: &str) -> Result<bool> {
    Ok(load(server_id)?.is_some())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn challenge_params_are_read_quoted_and_bare() {
        let challenge = r#"Bearer realm="mcp", resource_metadata="https://api.example.com/.well-known/oauth-protected-resource", scope=files"#;
        assert_eq!(
            challenge_param(challenge, "resource_metadata").as_deref(),
            Some("https://api.example.com/.well-known/oauth-protected-resource")
        );
        assert_eq!(
            challenge_param(challenge, "scope").as_deref(),
            Some("files")
        );
        assert!(challenge_param(challenge, "error").is_none());
    }

    #[test]
    fn resource_drops_query_fragment_and_trailing_slash() {
        let url = Url::parse("https://api.example.com/mcp/?x=1#top").unwrap();
        assert_eq!(canonical_resource(&url), "https://api.example.com/mcp");
        assert_eq!(
            origin(&Url::parse("http://localhost:8080/a").unwrap()),
            "http://localhost:8080"
        );
    }

    #[test]
    fn well_known_urls_insert_the_path() {
        assert_eq!(
            well_known(
                "https://auth.example.com",
                "oauth-authorization-server",
                "/tenant/"
            ),
            "https://auth.example.com/.well-known/oauth-authorization-server/tenant"
        );
        assert_eq!(
            well_known("https://a.example.com", "oauth-protected-resource", "/"),
            "https://a.example.com/.well-known/oauth-protected-resource"
        );
    }

    #[test]
    fn endpoints_must_be_https_unless_loopback() {
        assert!(require_secure("https://auth.example.com/token").is_ok());
        assert!(require_secure("http://localhost:9000/token").is_ok());
        assert!(require_secure("http://127.0.0.1:9000/token").is_ok());
        assert!(require_secure("http://auth.example.com/token").is_err());
    }

    #[test]
    fn pkce_challenge_matches_rfc_7636_example() {
        assert_eq!(
            pkce_challenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
            "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
        );
    }

    #[test]
    fn authorize_url_carries_pkce_state_resource_and_scope() {
        let url = authorize_url(&AuthorizeRequest {
            endpoint: "https://auth.example.com/authorize",
            client_id: "client 1",
            redirect_uri: "http://127.0.0.1:5000/callback",
            challenge: "abc",
            state: "xyz",
            scopes: &["read".to_string(), "write".to_string()],
            resource: "https://api.example.com/mcp",
        })
        .unwrap();
        let parsed = Url::parse(&url).unwrap();
        let pairs: std::collections::HashMap<_, _> = parsed.query_pairs().into_owned().collect();
        assert_eq!(pairs["client_id"], "client 1");
        assert_eq!(pairs["code_challenge_method"], "S256");
        assert_eq!(pairs["scope"], "read write");
        assert_eq!(pairs["resource"], "https://api.example.com/mcp");
    }

    #[test]
    fn callback_requires_the_matching_state() {
        let ok = callback_code("GET /callback?code=c1&state=s1 HTTP/1.1", "s1").unwrap();
        assert_eq!(ok.unwrap(), "c1");
        assert!(
            callback_code("GET /callback?code=c1&state=bad HTTP/1.1", "s1")
                .unwrap()
                .is_err()
        );
        assert!(
            callback_code("GET /callback?error=access_denied&state=s1 HTTP/1.1", "s1")
                .unwrap()
                .is_err()
        );
        assert!(callback_code("GET /favicon.ico HTTP/1.1", "s1").is_none());
    }

    #[test]
    fn form_encoding_escapes_reserved_and_non_ascii_characters() {
        assert_eq!(
            form_encode(&[("a", "x y"), ("b", "1&2=3"), ("c", "ü")]),
            "a=x+y&b=1%262%3D3&c=%C3%BC"
        );
    }

    #[test]
    fn auth_metadata_needs_both_endpoints() {
        let metadata = json!({
            "authorization_endpoint": "https://a/authorize",
            "token_endpoint": "https://a/token",
        });
        assert!(parse_auth_metadata(&metadata)
            .unwrap()
            .registration_endpoint
            .is_none());
        assert!(parse_auth_metadata(&json!({ "token_endpoint": "x" })).is_none());
    }
}
