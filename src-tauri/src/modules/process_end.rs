//! Ends process groups Pragma started and waits until they are gone, for use while the app exits.

#[cfg(unix)]
use std::time::Duration;

/// How long the processes have after the hangup before SIGTERM, and after that before SIGKILL.
#[cfg(unix)]
const GRACE_STEPS: [Duration; 2] = [Duration::from_millis(1000), Duration::from_millis(700)];
#[cfg(unix)]
const POLL: Duration = Duration::from_millis(20);

/// Hangs up every group, then sends SIGTERM and SIGKILL to those that still run. Blocks for the
/// grace steps at most, and returns as soon as every group is gone.
#[cfg(unix)]
pub fn end_groups(groups: &[u32]) {
    let mut alive: Vec<libc::pid_t> = groups
        .iter()
        .filter_map(|group| libc::pid_t::try_from(*group).ok())
        .filter(|group| *group > 1)
        .collect();
    signal(&alive, libc::SIGHUP);
    for (wait, next) in GRACE_STEPS.into_iter().zip([libc::SIGTERM, libc::SIGKILL]) {
        let deadline = std::time::Instant::now() + wait;
        while std::time::Instant::now() < deadline {
            // SAFETY: signal 0 only asks whether the group still has a process.
            alive.retain(|group| unsafe { libc::kill(-group, 0) } == 0);
            if alive.is_empty() {
                return;
            }
            std::thread::sleep(POLL);
        }
        signal(&alive, next);
    }
}

#[cfg(unix)]
fn signal(groups: &[libc::pid_t], signal: libc::c_int) {
    for group in groups {
        // SAFETY: plain signal delivery to process groups Pragma created.
        unsafe {
            libc::kill(-group, signal);
        }
    }
}

/// Windows has no process groups to signal; `taskkill` ends each process with its children.
#[cfg(windows)]
pub fn end_groups(groups: &[u32]) {
    for pid in groups {
        let _ = crate::platform::new_std_command("taskkill")
            .args(["/T", "/F", "/PID", &pid.to_string()])
            .output();
    }
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use std::os::unix::process::CommandExt;
    use std::process::{Child, Command};
    use std::time::Instant;

    fn spawn(script: &str) -> Child {
        Command::new("/bin/sh")
            .args(["-c", script])
            .process_group(0)
            .spawn()
            .unwrap()
    }

    /// Reaps the child in the background, as the app does for everything it starts.
    fn reap(mut child: Child) -> std::thread::JoinHandle<bool> {
        std::thread::spawn(move || child.wait().unwrap().success())
    }

    #[test]
    fn returns_early_when_a_group_ends_on_the_hangup() {
        let child = spawn("sleep 30");
        let pid = child.id();
        let reaper = reap(child);
        let started = Instant::now();

        end_groups(&[pid]);

        assert!(started.elapsed() < GRACE_STEPS[0]);
        assert!(!reaper.join().unwrap());
    }

    #[test]
    fn ends_a_group_that_ignores_hangup_and_term() {
        let child = spawn("trap '' HUP TERM; while :; do sleep 0.1; done");
        let pid = child.id();
        // Give the shell time to install its trap before the hangup arrives.
        std::thread::sleep(Duration::from_millis(300));
        let reaper = reap(child);

        end_groups(&[pid]);

        assert!(!reaper.join().unwrap());
    }

    #[test]
    fn never_signals_pids_that_stand_for_other_groups() {
        end_groups(&[0, 1]);
    }
}
