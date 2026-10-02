//! Machine facts the voice settings use to recommend a speech model size.

use sysinfo::{MemoryRefreshKind, RefreshKind, System};

#[tauri::command]
pub fn voice_system_memory() -> Result<u64, String> {
    let system = System::new_with_specifics(
        RefreshKind::nothing().with_memory(MemoryRefreshKind::nothing().with_ram()),
    );
    Ok(system.total_memory())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reports_installed_memory() {
        assert!(voice_system_memory().unwrap() > 0);
    }
}
