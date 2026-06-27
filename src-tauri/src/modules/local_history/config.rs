use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Copy)]
pub struct RetentionPolicy {
    pub max_age_days: u32,
    pub max_snapshots: u32,
}

impl Default for RetentionPolicy {
    fn default() -> Self {
        Self {
            max_age_days: 7,
            max_snapshots: 50,
        }
    }
}
