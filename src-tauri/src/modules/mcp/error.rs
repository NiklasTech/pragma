use serde_json::Value;
use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum JsonRpcErrorCode {
    ParseError,
    InvalidRequest,
    MethodNotFound,
    InvalidParams,
    InternalError,
    ServerError(i64),
    Other(i64),
}

impl JsonRpcErrorCode {
    pub const fn as_i64(&self) -> i64 {
        match self {
            JsonRpcErrorCode::ParseError => -32700,
            JsonRpcErrorCode::InvalidRequest => -32600,
            JsonRpcErrorCode::MethodNotFound => -32601,
            JsonRpcErrorCode::InvalidParams => -32602,
            JsonRpcErrorCode::InternalError => -32603,
            JsonRpcErrorCode::ServerError(code) => *code,
            JsonRpcErrorCode::Other(code) => *code,
        }
    }
}

impl From<i64> for JsonRpcErrorCode {
    fn from(code: i64) -> Self {
        match code {
            -32700 => JsonRpcErrorCode::ParseError,
            -32600 => JsonRpcErrorCode::InvalidRequest,
            -32601 => JsonRpcErrorCode::MethodNotFound,
            -32602 => JsonRpcErrorCode::InvalidParams,
            -32603 => JsonRpcErrorCode::InternalError,
            code if (-32099..=-32000).contains(&code) => JsonRpcErrorCode::ServerError(code),
            _ => JsonRpcErrorCode::Other(code),
        }
    }
}

impl fmt::Display for JsonRpcErrorCode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            JsonRpcErrorCode::ParseError => write!(f, "Parse error"),
            JsonRpcErrorCode::InvalidRequest => write!(f, "Invalid request"),
            JsonRpcErrorCode::MethodNotFound => write!(f, "Method not found"),
            JsonRpcErrorCode::InvalidParams => write!(f, "Invalid params"),
            JsonRpcErrorCode::InternalError => write!(f, "Internal error"),
            JsonRpcErrorCode::ServerError(code) => write!(f, "Server error ({code})"),
            JsonRpcErrorCode::Other(code) => write!(f, "JSON-RPC error ({code})"),
        }
    }
}

#[derive(Debug)]
pub enum McpError {
    Spawn(std::io::Error),
    MissingStdio,
    Serialization(String),
    ConnectionClosed,
    Timeout,
    TooManyConcurrentRequests,
    Rpc {
        code: JsonRpcErrorCode,
        message: String,
        data: Option<Value>,
    },
}

impl McpError {
    pub fn rpc(code: i64, message: impl Into<String>, data: Option<Value>) -> Self {
        McpError::Rpc {
            code: code.into(),
            message: message.into(),
            data,
        }
    }
}

impl fmt::Display for McpError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            McpError::Spawn(err) => write!(f, "failed to spawn MCP server: {err}"),
            McpError::MissingStdio => write!(f, "missing stdio pipe"),
            McpError::Serialization(err) => write!(f, "serialization error: {err}"),
            McpError::ConnectionClosed => write!(f, "connection closed"),
            McpError::Timeout => write!(f, "request timed out"),
            McpError::TooManyConcurrentRequests => write!(f, "too many concurrent requests"),
            McpError::Rpc { code, message, .. } => write!(f, "JSON-RPC error {code}: {message}"),
        }
    }
}

impl std::error::Error for McpError {}

impl From<std::io::Error> for McpError {
    fn from(err: std::io::Error) -> Self {
        McpError::Spawn(err)
    }
}

impl From<serde_json::Error> for McpError {
    fn from(err: serde_json::Error) -> Self {
        McpError::Serialization(err.to_string())
    }
}

impl From<McpError> for String {
    fn from(err: McpError) -> Self {
        err.to_string()
    }
}

pub type Result<T> = std::result::Result<T, McpError>;
