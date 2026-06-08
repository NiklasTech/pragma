use super::error::AIError;

const SERVICE_NAME: &str = "pragma-ai";

pub fn get_api_key(provider: &str) -> Result<Option<String>, AIError> {
    let entry = keyring::Entry::new(SERVICE_NAME, provider)
        .map_err(|e| AIError::Provider(format!("keyring entry failed: {e}")))?;

    match entry.get_password() {
        Ok(key) => Ok(Some(key)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(AIError::Provider(format!("keyring read failed: {e}"))),
    }
}

pub fn set_api_key(provider: &str, key: &str) -> Result<(), AIError> {
    let entry = keyring::Entry::new(SERVICE_NAME, provider)
        .map_err(|e| AIError::Provider(format!("keyring entry failed: {e}")))?;

    entry
        .set_password(key)
        .map_err(|e| AIError::Provider(format!("keyring write failed: {e}")))
}

pub fn delete_api_key(provider: &str) -> Result<(), AIError> {
    let entry = keyring::Entry::new(SERVICE_NAME, provider)
        .map_err(|e| AIError::Provider(format!("keyring entry failed: {e}")))?;

    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(AIError::Provider(format!("keyring delete failed: {e}"))),
    }
}
