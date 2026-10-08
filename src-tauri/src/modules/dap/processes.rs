use serde::Serialize;
use sysinfo::{ProcessRefreshKind, ProcessesToUpdate, System, UpdateKind};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DapProcessInfo {
    pub pid: u32,
    pub name: String,
    pub command: String,
}

/// Local processes a debugger can attach to, sorted by name. Threads and the
/// IDE process itself are left out.
pub(super) fn list_processes() -> Vec<DapProcessInfo> {
    let own_pid = std::process::id();
    let mut system = System::new();
    system.refresh_processes_specifics(
        ProcessesToUpdate::All,
        true,
        ProcessRefreshKind::nothing()
            .with_cmd(UpdateKind::OnlyIfNotSet)
            .without_tasks(),
    );

    let mut processes: Vec<DapProcessInfo> = system
        .processes()
        .values()
        .filter(|process| process.thread_kind().is_none())
        .map(|process| DapProcessInfo {
            pid: process.pid().as_u32(),
            name: process.name().to_string_lossy().to_string(),
            command: process
                .cmd()
                .iter()
                .map(|arg| arg.to_string_lossy())
                .collect::<Vec<_>>()
                .join(" "),
        })
        .filter(|process| process.pid != own_pid)
        .collect();
    processes.sort_by(|a, b| {
        a.name
            .to_lowercase()
            .cmp(&b.name.to_lowercase())
            .then(a.pid.cmp(&b.pid))
    });
    processes
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lists_processes_without_the_current_one() {
        let processes = list_processes();
        assert!(!processes.is_empty());
        assert!(processes.iter().all(|p| p.pid != std::process::id()));
    }
}
