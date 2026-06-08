pub mod cli;
pub mod config;
pub mod error;
pub mod keychain;
pub mod provider;
pub mod providers;
pub mod registry;

pub use config::ProviderConfig;
pub use error::AIError;
pub use provider::{
    AIProvider, CompletionChunk, CompletionRequest, CompletionResponse, Message, ModelInfo, Role,
    Usage,
};
pub use registry::ProviderRegistry;
