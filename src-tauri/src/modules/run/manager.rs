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
