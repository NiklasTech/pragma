pub mod approval_bridge;
pub mod client;
pub mod error;
pub mod fs_bridge;
pub mod manager;
pub mod mcp_bridge;
pub mod tools_bridge;
pub mod types;

pub use approval_bridge::ApprovalBridge;
pub use client::{AcpClient, AcpClientConfig, Notification, RequestOptions, ReverseRpcRequest};
pub use error::{AcpError, Result};
pub use manager::{AcpSessionHandle, AcpSessionManager};
pub use types::PromptContent;
