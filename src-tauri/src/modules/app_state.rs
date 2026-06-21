use std::sync::Arc;

use tauri::Manager;
use tauri_plugin_store::Store;

const STORE_NAME: &str = "app.dat";
const ONBOARDING_COMPLETED_KEY: &str = "onboardingCompleted";

fn load_store(app: &tauri::AppHandle) -> Result<Arc<Store<tauri::Wry>>, String> {
    let path = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("failed to resolve app config dir: {e}"))?
        .join(STORE_NAME);
    tauri_plugin_store::StoreBuilder::new(app, path)
        .build()
        .map_err(|e| format!("failed to load store: {e}"))
}

#[tauri::command]
pub async fn get_onboarding_completed(app: tauri::AppHandle) -> Result<bool, String> {
    let store = load_store(&app)?;
    match store.get(ONBOARDING_COMPLETED_KEY) {
        Some(value) => serde_json::from_value(value).map_err(|e| e.to_string()),
        None => Ok(false),
    }
}

#[tauri::command]
pub async fn set_onboarding_completed(
    app: tauri::AppHandle,
    completed: bool,
) -> Result<(), String> {
    let store = load_store(&app)?;
    store.set(
        ONBOARDING_COMPLETED_KEY.to_string(),
        serde_json::to_value(completed).map_err(|e| e.to_string())?,
    );
    store
        .save()
        .map_err(|e| format!("failed to save store: {e}"))?;
    Ok(())
}
