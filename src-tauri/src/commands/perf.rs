use serde::Serialize;
use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, System};

#[derive(Serialize)]
pub struct MemoryStats {
    #[serde(rename = "residentSetSizeBytes")]
    pub resident_set_size_bytes: u64,
}

#[tauri::command]
pub fn memory_stats() -> Result<MemoryStats, String> {
    let current_pid = std::process::id();
    let pid = Pid::from_u32(current_pid);

    // Only refresh the current process with memory information. Calling
    // `System::new_all()` enumerates every process and can OOM when many
    // short-lived child processes are running (e.g. during `npm install -g`).
    let mut system = System::new();
    system.refresh_processes_specifics(
        ProcessesToUpdate::Some(&[pid]),
        false,
        ProcessRefreshKind::nothing().with_memory(),
    );

    let process = system
        .process(pid)
        .ok_or_else(|| "Failed to retrieve current process".to_string())?;

    Ok(MemoryStats {
        resident_set_size_bytes: process.memory(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn memory_stats_returns_current_process_rss() {
        let stats = memory_stats().expect("memory_stats should return the current process RSS");
        assert!(
            stats.resident_set_size_bytes > 0,
            "RSS should be greater than zero"
        );
    }
}
