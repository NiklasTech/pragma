//! Lets ACP agents start Pragma child sessions through a small MCP server.
//!
//! The agent launches the Pragma binary with [`BRIDGE_FLAG`] as a stdio MCP
//! server. That process forwards each tool call over loopback TCP to the
//! running app, which asks the user and creates the session in the frontend.

pub mod bridge;
mod protocol;
pub mod server;

pub use server::ChildSessionServer;

pub const BRIDGE_FLAG: &str = "--pragma-child-sessions-mcp";
