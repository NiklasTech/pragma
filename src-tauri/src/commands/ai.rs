use serde::{Deserialize, Serialize};

use crate::ai::keychain;

#[derive(Debug, Serialize)]
pub struct KeyStatus {
    pub provider: String,
    pub has_key: bool,
    pub masked: String,
}

#[derive(Debug, Deserialize)]
pub struct StoreKeyRequest {
    pub provider: String,
    pub key: String,
}

#[derive(Debug, Deserialize)]
pub struct ProviderRequest {
    pub provider: String,
}

fn mask_key(key: &str) -> String {
    if key.len() <= 8 {
        return "****".to_string();
    }
    format!("{}...{}", &key[..4], &key[key.len() - 4..])
}

#[tauri::command]
pub async fn ai_store_key(req: StoreKeyRequest) -> Result<(), String> {
    if req.provider.is_empty() {
        return Err("provider is required".to_string());
    }
    if req.key.is_empty() {
        return Err("key is required".to_string());
    }

    keychain::set_api_key(&req.provider, &req.key).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ai_get_key(req: ProviderRequest) -> Result<Option<String>, String> {
    if req.provider.is_empty() {
        return Err("provider is required".to_string());
    }

    keychain::get_api_key(&req.provider).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ai_key_status(req: ProviderRequest) -> Result<KeyStatus, String> {
    if req.provider.is_empty() {
        return Err("provider is required".to_string());
    }

    let (has_key, masked) = match keychain::get_api_key(&req.provider) {
        Ok(Some(key)) => (true, mask_key(&key)),
        _ => (false, String::new()),
    };

    Ok(KeyStatus {
        provider: req.provider,
        has_key,
        masked,
    })
}

#[tauri::command]
pub async fn ai_delete_key(req: ProviderRequest) -> Result<(), String> {
    if req.provider.is_empty() {
        return Err("provider is required".to_string());
    }

    keychain::delete_api_key(&req.provider).map_err(|e| e.to_string())
}
