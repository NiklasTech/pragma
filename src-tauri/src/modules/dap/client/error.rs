#[derive(Debug)]
pub enum DapError {
    Spawn(std::io::Error),
    MissingStdio,
    Serialization(String),
    ConnectionClosed,
    Timeout,
    TooManyConcurrentRequests,
    RequestFailed(String),
    InvalidHeader,
    InvalidContentLength,
}

impl std::fmt::Display for DapError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DapError::Spawn(err) => write!(f, "failed to spawn debug adapter: {err}"),
            DapError::MissingStdio => write!(f, "missing stdio pipe"),
            DapError::Serialization(err) => write!(f, "serialization error: {err}"),
            DapError::ConnectionClosed => write!(f, "connection closed"),
            DapError::Timeout => write!(f, "request timed out"),
            DapError::TooManyConcurrentRequests => write!(f, "too many concurrent requests"),
            DapError::RequestFailed(message) => {
                write!(f, "debug adapter request failed: {message}")
            }
            DapError::InvalidHeader => write!(f, "invalid DAP message header"),
            DapError::InvalidContentLength => write!(f, "invalid Content-Length header"),
        }
    }
}

impl std::error::Error for DapError {}

impl From<std::io::Error> for DapError {
    fn from(err: std::io::Error) -> Self {
        DapError::Spawn(err)
    }
}

impl From<serde_json::Error> for DapError {
    fn from(err: serde_json::Error) -> Self {
        DapError::Serialization(err.to_string())
    }
}

impl From<DapError> for String {
    fn from(err: DapError) -> Self {
        err.to_string()
    }
}

pub type Result<T> = std::result::Result<T, DapError>;
