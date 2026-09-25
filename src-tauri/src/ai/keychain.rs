use std::collections::HashMap;
use std::sync::{Mutex, MutexGuard, OnceLock};

use super::error::AIError;

const SERVICE_NAME: &str = "pragma-ai";

type Cache = Mutex<HashMap<String, Option<String>>>;

static CACHE: OnceLock<Cache> = OnceLock::new();

fn cache() -> &'static Cache {
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn lock_cache() -> Result<MutexGuard<'static, HashMap<String, Option<String>>>, AIError> {
    cache()
        .lock()
        .map_err(|_| AIError::Provider("keychain cache lock poisoned".to_string()))
}

pub fn get_api_key(provider: &str) -> Result<Option<String>, AIError> {
    let mut entries = lock_cache()?;

    if let Some(cached) = entries.get(provider) {
        return Ok(cached.clone());
    }

    let entry = keyring::Entry::new(SERVICE_NAME, provider)
        .map_err(|e| AIError::Provider(format!("keyring entry failed: {e}")))?;

    match entry.get_password() {
        Ok(key) => {
            entries.insert(provider.to_string(), Some(key.clone()));
            Ok(Some(key))
        }
        Err(keyring::Error::NoEntry) => {
            entries.insert(provider.to_string(), None);
            Ok(None)
        }
        Err(e) => Err(AIError::Provider(format!("keyring read failed: {e}"))),
    }
}

pub fn set_api_key(provider: &str, key: &str) -> Result<(), AIError> {
    let mut entries = lock_cache()?;

    let entry = keyring::Entry::new(SERVICE_NAME, provider)
        .map_err(|e| AIError::Provider(format!("keyring entry failed: {e}")))?;

    entry
        .set_password(key)
        .map_err(|e| AIError::Provider(format!("keyring write failed: {e}")))?;

    entries.insert(provider.to_string(), Some(key.to_string()));

    Ok(())
}

pub fn delete_api_key(provider: &str) -> Result<(), AIError> {
    let mut entries = lock_cache()?;

    let entry = keyring::Entry::new(SERVICE_NAME, provider)
        .map_err(|e| AIError::Provider(format!("keyring entry failed: {e}")))?;

    match entry.delete_credential() {
        Ok(()) => {}
        Err(keyring::Error::NoEntry) => {}
        Err(e) => return Err(AIError::Provider(format!("keyring delete failed: {e}"))),
    }

    entries.remove(provider);

    Ok(())
}
