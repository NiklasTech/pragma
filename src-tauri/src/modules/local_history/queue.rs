use std::sync::mpsc::{self, SendError, Sender};
use std::sync::OnceLock;

struct SnapshotJob {
    app: tauri::AppHandle,
    repo_path: String,
    file_path: String,
    content: String,
}

impl SnapshotJob {
    fn run(self) {
        let _ = super::on_file_saved(&self.app, &self.repo_path, &self.file_path, &self.content);
    }
}

static QUEUE: OnceLock<Sender<SnapshotJob>> = OnceLock::new();

fn start_worker() -> Sender<SnapshotJob> {
    let (sender, receiver) = mpsc::channel::<SnapshotJob>();
    // If the thread cannot start, the receiver is dropped and jobs run inline instead.
    let _ = std::thread::Builder::new()
        .name("local-history".to_string())
        .spawn(move || {
            for job in receiver {
                job.run();
            }
        });
    sender
}

/// Snapshots run on one worker in save order, so saving never waits on git.
pub fn queue_snapshot(
    app: tauri::AppHandle,
    repo_path: String,
    file_path: String,
    content: String,
) {
    let job = SnapshotJob {
        app,
        repo_path,
        file_path,
        content,
    };
    if let Err(SendError(job)) = QUEUE.get_or_init(start_worker).send(job) {
        job.run();
    }
}
