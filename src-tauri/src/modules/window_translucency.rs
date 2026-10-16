use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Runtime, WebviewWindow, WebviewWindowBuilder};

const STORE_KEY: &str = "windowTranslucency";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Material {
    Sidebar,
    UnderWindow,
    Hud,
    Mica,
    Acrylic,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslucencySettings {
    pub enabled: bool,
    pub material: Material,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslucencyStatus {
    supported: bool,
    materials: Vec<Material>,
    enabled: bool,
    material: Material,
    /// Windows of this session were created transparent, so changes apply without a restart.
    active: bool,
}

/// Whether the windows of this session were created transparent; fixed at startup.
pub struct TranslucencySession {
    transparent: bool,
}

impl TranslucencySession {
    pub fn transparent(&self) -> bool {
        self.transparent
    }
}

pub fn supported_materials() -> &'static [Material] {
    #[cfg(target_os = "macos")]
    {
        &[Material::Sidebar, Material::UnderWindow, Material::Hud]
    }
    #[cfg(target_os = "windows")]
    {
        &[Material::Mica, Material::Acrylic]
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        &[]
    }
}

fn default_settings() -> TranslucencySettings {
    TranslucencySettings {
        enabled: false,
        material: supported_materials()
            .first()
            .copied()
            .unwrap_or(Material::Sidebar),
    }
}

/// Keeps only settings this platform can show; anything else falls back to off.
fn sanitize(settings: TranslucencySettings) -> TranslucencySettings {
    let materials = supported_materials();
    if materials.is_empty() {
        return default_settings();
    }
    if materials.contains(&settings.material) {
        settings
    } else {
        TranslucencySettings {
            material: materials[0],
            ..settings
        }
    }
}

pub fn load_settings(app: &AppHandle) -> TranslucencySettings {
    let stored = crate::modules::app_state::load_store(app)
        .ok()
        .and_then(|store| store.get(STORE_KEY))
        .and_then(|value| serde_json::from_value::<TranslucencySettings>(value).ok());
    sanitize(stored.unwrap_or_else(default_settings))
}

fn save_settings(app: &AppHandle, settings: TranslucencySettings) -> Result<(), String> {
    let store = crate::modules::app_state::load_store(app)?;
    store.set(
        STORE_KEY.to_string(),
        serde_json::to_value(settings).map_err(|e| e.to_string())?,
    );
    store
        .save()
        .map_err(|e| format!("failed to save store: {e}"))
}

/// Creates windows transparent when translucency was on at startup.
pub fn session_for(settings: TranslucencySettings) -> TranslucencySession {
    TranslucencySession {
        transparent: settings.enabled && !supported_materials().is_empty(),
    }
}

fn session_transparent(app: &AppHandle) -> bool {
    app.try_state::<TranslucencySession>()
        .is_some_and(|session| session.transparent)
}

pub fn prepare_builder<'a, R: Runtime, M: Manager<R>>(
    builder: WebviewWindowBuilder<'a, R, M>,
    transparent: bool,
) -> WebviewWindowBuilder<'a, R, M> {
    #[cfg(any(target_os = "macos", target_os = "windows"))]
    {
        builder.transparent(transparent)
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = transparent;
        builder
    }
}

/// Window builder for this session's other windows.
pub fn prepare_session_builder<'a, M: Manager<tauri::Wry>>(
    app: &AppHandle,
    builder: WebviewWindowBuilder<'a, tauri::Wry, M>,
) -> WebviewWindowBuilder<'a, tauri::Wry, M> {
    prepare_builder(builder, session_transparent(app))
}

/// Applies or clears the material on a window; must run on the main thread.
fn apply_now(window: &WebviewWindow, settings: TranslucencySettings) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use window_vibrancy::{NSVisualEffectMaterial, NSVisualEffectState};
        let _ = window_vibrancy::clear_vibrancy(window);
        if !settings.enabled {
            return Ok(());
        }
        let material = match settings.material {
            Material::UnderWindow => NSVisualEffectMaterial::UnderWindowBackground,
            Material::Hud => NSVisualEffectMaterial::HudWindow,
            _ => NSVisualEffectMaterial::Sidebar,
        };
        window_vibrancy::apply_vibrancy(
            window,
            material,
            Some(NSVisualEffectState::FollowsWindowActiveState),
            None,
        )
        .map_err(|e| format!("Failed to apply vibrancy: {e}"))
    }
    #[cfg(target_os = "windows")]
    {
        let _ = window_vibrancy::clear_mica(window);
        let _ = window_vibrancy::clear_acrylic(window);
        if !settings.enabled {
            return Ok(());
        }
        match settings.material {
            Material::Acrylic => window_vibrancy::apply_acrylic(window, Some((0, 0, 0, 0))),
            _ => window_vibrancy::apply_mica(window, None),
        }
        .map_err(|e| format!("Failed to apply window material: {e}"))
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = (window, settings);
        Ok(())
    }
}

fn apply_on_main_thread(window: &WebviewWindow, settings: TranslucencySettings) {
    let target = window.clone();
    let result = window.run_on_main_thread(move || {
        if let Err(err) = apply_now(&target, settings) {
            log::warn!("window translucency: {err}");
        }
    });
    if let Err(err) = result {
        log::warn!("window translucency: {err}");
    }
}

/// Applies the stored material to a window created in this session.
pub fn apply_to_window(app: &AppHandle, window: &WebviewWindow) {
    if session_transparent(app) {
        apply_on_main_thread(window, load_settings(app));
    }
}

fn status(app: &AppHandle, settings: TranslucencySettings) -> TranslucencyStatus {
    TranslucencyStatus {
        supported: !supported_materials().is_empty(),
        materials: supported_materials().to_vec(),
        enabled: settings.enabled,
        material: settings.material,
        active: session_transparent(app),
    }
}

#[tauri::command(async)]
pub fn window_translucency_get(app: AppHandle) -> Result<TranslucencyStatus, String> {
    Ok(status(&app, load_settings(&app)))
}

#[tauri::command(async)]
pub fn window_translucency_set(
    app: AppHandle,
    enabled: bool,
    material: Material,
) -> Result<TranslucencyStatus, String> {
    if supported_materials().is_empty() {
        return Err("Window translucency is not supported on this platform".to_string());
    }
    if !supported_materials().contains(&material) {
        return Err("This material is not available on this platform".to_string());
    }
    let settings = TranslucencySettings { enabled, material };
    save_settings(&app, settings)?;
    if session_transparent(&app) {
        for window in app.webview_windows().values() {
            apply_on_main_thread(window, settings);
        }
    }
    Ok(status(&app, settings))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_to_off() {
        assert!(!default_settings().enabled);
        assert!(!session_for(default_settings()).transparent);
    }

    #[test]
    fn keeps_supported_materials_and_replaces_others() {
        let materials = supported_materials();
        if let Some(first) = materials.first() {
            let foreign = [
                Material::Sidebar,
                Material::UnderWindow,
                Material::Hud,
                Material::Mica,
                Material::Acrylic,
            ]
            .into_iter()
            .find(|m| !materials.contains(m))
            .unwrap_or(*first);
            let settings = sanitize(TranslucencySettings {
                enabled: true,
                material: foreign,
            });
            assert!(materials.contains(&settings.material));
            assert!(settings.enabled);
        } else {
            let settings = sanitize(TranslucencySettings {
                enabled: true,
                material: Material::Mica,
            });
            assert!(!settings.enabled);
        }
    }

    #[test]
    fn creates_transparent_windows_only_when_enabled_and_supported() {
        let on = TranslucencySettings {
            enabled: true,
            ..default_settings()
        };
        assert_eq!(
            session_for(on).transparent,
            !supported_materials().is_empty()
        );
    }

    #[test]
    fn reads_material_names_from_the_frontend() {
        let parsed: TranslucencySettings =
            serde_json::from_str(r#"{"enabled":true,"material":"underWindow"}"#).unwrap();
        assert_eq!(parsed.material, Material::UnderWindow);
        assert!(serde_json::from_str::<Material>(r#""glass""#).is_err());
    }
}
