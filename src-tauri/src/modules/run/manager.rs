use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use super::process::kill_process_group;

pub(super) struct RunInstance {
    pub(super) pgid: i32,
    pub(super) stop_requested: Arc<AtomicBool>,
}

pub struct RunManager {
    pub(super) processes: Mutex<HashMap<String, RunInstance>>,
}

impl Default for RunManager {
    fn default() -> Self {
        Self::new()
    }
}

impl RunManager {
    pub fn new() -> Self {
        Self {
            processes: Mutex::new(HashMap::new()),
        }
    }

    pub fn stop_all(&self) {
        let processes = self.processes.lock().unwrap_or_else(|e| e.into_inner());
        for instance in processes.values() {
            instance.stop_requested.store(true, Ordering::SeqCst);
            kill_process_group(instance.pgid);
        }
    }
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use std::os::unix::process::CommandExt;
    use std::process::Command;

    #[test]
    fn stop_all_with_no_processes_is_a_no_op() {
        RunManager::default().stop_all();
    }

    #[test]
    fn stop_all_marks_and_kills_every_process_group() {
        let manager = RunManager::new();
        let mut children = Vec::new();
        let mut flags = Vec::new();
        for name in ["first", "second"] {
            let child = Command::new("sleep")
                .arg("30")
                .process_group(0)
                .spawn()
                .unwrap();
            let stop_requested = Arc::new(AtomicBool::new(false));
            manager.processes.lock().unwrap().insert(
                name.to_string(),
                RunInstance {
                    pgid: child.id() as i32,
                    stop_requested: Arc::clone(&stop_requested),
                },
            );
            children.push(child);
            flags.push(stop_requested);
        }

        manager.stop_all();

        for flag in flags {
            assert!(flag.load(Ordering::SeqCst));
        }
        for mut child in children {
            assert!(!child.wait().unwrap().success());
        }
    }
}
