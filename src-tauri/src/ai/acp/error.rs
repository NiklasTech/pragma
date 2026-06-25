use std::fmt;

#[derive(Debug, Clone, PartialEq)]
pub enum AcpError {
    ConnectionClosed,
    MissingStdio,
    Serialization(String),
    Spawn(String),
    RequestTimeout,
    TooManyConcurrentRequests,
    JsonRpc { code: i64, message: String },
    Protocol(String),
    InvalidPath(String),
    ApprovalTimeout,
    ApprovalRejected,
}

impl fmt::Display for AcpError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AcpError::ConnectionClosed => write!(f, "ACP connection closed"),
            AcpError::MissingStdio => write!(f, "Failed to acquire stdio handles"),
            AcpError::Serialization(msg) => write!(f, "Serialization error: {msg}"),
            AcpError::Spawn(msg) => write!(f, "Failed to spawn process: {msg}"),
            AcpError::RequestTimeout => write!(f, "ACP request timed out"),
            AcpError::TooManyConcurrentRequests => {
                write!(f, "Too many concurrent ACP requests")
            }
            AcpError::JsonRpc { code, message } => {
                write!(f, "ACP JSON-RPC error {code}: {message}")
            }
            AcpError::Protocol(msg) => write!(f, "ACP protocol error: {msg}"),
            AcpError::InvalidPath(msg) => write!(f, "Invalid path: {msg}"),
            AcpError::ApprovalTimeout => write!(f, "Approval request timed out"),
            AcpError::ApprovalRejected => write!(f, "Approval request rejected"),
        }
    }
}

impl std::error::Error for AcpError {}

impl From<serde_json::Error> for AcpError {
    fn from(err: serde_json::Error) -> Self {
        AcpError::Serialization(err.to_string())
    }
}

pub type Result<T> = std::result::Result<T, AcpError>;
