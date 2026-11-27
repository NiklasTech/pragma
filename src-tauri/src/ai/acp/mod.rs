pub mod approval_bridge;
pub mod client;
pub mod config_options;
pub mod continuation;
pub mod error;
pub mod fs_bridge;
pub mod manager;
pub mod mcp_bridge;
pub mod session_info;
pub mod tool_calls;
pub mod tools_bridge;
pub mod types;
pub mod usage;

pub use approval_bridge::{ApprovalBridge, ApprovalDecision};
pub use client::{AcpClient, AcpClientConfig, Notification, RequestOptions, ReverseRpcRequest};
pub use error::{AcpError, Result};
pub use manager::{AcpSessionHandle, AcpSessionManager, SessionStart};
pub use types::PromptContent;
