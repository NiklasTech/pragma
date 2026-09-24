use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DebugConfig {
    pub adapter: String,
    #[serde(default)]
    pub request: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunConfig {
    #[serde(default)]
    pub id: Option<String>,
    pub name: String,
    pub command: String,
    pub cwd: Option<String>,
    #[serde(default)]
    pub env: HashMap<String, String>,
    #[serde(default)]
    pub autostart: bool,
    #[serde(default, alias = "auto_restart")]
    pub auto_restart: bool,
    #[serde(default)]
    pub icon: Option<String>,
    #[serde(default)]
    pub detect: Option<String>,
    #[serde(default)]
    pub debug: Option<DebugConfig>,
}

#[derive(Debug, Deserialize, Serialize)]
pub(super) struct RunConfigFile {
    pub(super) configurations: Vec<RunConfig>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum RunStatus {
    Running,
    Failed,
    Stopped,
}
