use serde::Serialize;
use sysinfo::{Pid, System};

#[derive(Serialize)]
pub struct MemoryStats {
    #[serde(rename = "residentSetSizeBytes")]
    pub resident_set_size_bytes: u64,
}

#[tauri::command]
pub fn memory_stats() -> Result<MemoryStats, String> {
    let mut system = System::new_all();
    system.refresh_all();

    let current_pid = std::process::id();
    let pid = Pid::from_u32(current_pid);

    let process = system
        .process(pid)
        .ok_or_else(|| "Failed to retrieve current process".to_string())?;

    Ok(MemoryStats {
        resident_set_size_bytes: process.memory(),
    })
}
