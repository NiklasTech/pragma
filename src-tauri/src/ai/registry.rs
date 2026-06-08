use std::collections::HashMap;
use std::sync::Arc;

use super::error::AIError;
use super::provider::AIProvider;

pub struct ProviderRegistry {
    providers: HashMap<String, Arc<dyn AIProvider>>,
}

impl ProviderRegistry {
    pub fn new() -> Self {
        Self {
            providers: HashMap::new(),
        }
    }

    pub fn register(&mut self, provider: Arc<dyn AIProvider>) {
        self.providers.insert(provider.name().to_string(), provider);
    }

    pub fn get(&self, name: &str) -> Result<Arc<dyn AIProvider>, AIError> {
        self.providers
            .get(name)
            .cloned()
            .ok_or_else(|| AIError::ProviderNotFound(name.to_string()))
    }

    pub fn list(&self) -> Vec<String> {
        self.providers.keys().cloned().collect()
    }

    pub fn is_registered(&self, name: &str) -> bool {
        self.providers.contains_key(name)
    }

    pub fn unregister(&mut self, name: &str) -> bool {
        self.providers.remove(name).is_some()
    }
}

impl Default for ProviderRegistry {
    fn default() -> Self {
        Self::new()
    }
}
