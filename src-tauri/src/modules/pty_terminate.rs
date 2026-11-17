//! Ends a terminal's process for good, also when it ignores the hangup signal.

use std::time::Duration;

/// How long the process has after the hangup before it gets SIGTERM, and after that before SIGKILL.
pub const GRACE_STEPS: [Duration; 2] = [Duration::from_millis(1000), Duration::from_millis(2000)];

/// Sends SIGTERM and then SIGKILL to the terminal's process group while its process still runs.
///
/// A terminal's process starts its own session (`setsid`), so its pid is also its process group:
/// the signals reach the programs it started, such as the tools a coding CLI runs, and nothing else.
#[cfg(unix)]
pub fn escalate(pid: u32) {
    let Ok(pid) = libc::pid_t::try_from(pid) else {
        return;
    };
    if pid <= 1 {
        return;
    }
    std::thread::spawn(move || {
        for (wait, signal) in GRACE_STEPS.into_iter().zip([libc::SIGTERM, libc::SIGKILL]) {
            std::thread::sleep(wait);
            if !leads_running_group(pid) {
                return;
            }
            // SAFETY: plain signal delivery to a process group this terminal created.
            unsafe {
                libc::kill(-pid, signal);
            }
        }
    });
}

/// On Windows the killer already ends the process outright.
#[cfg(not(unix))]
pub fn escalate(_pid: u32) {}

/// True while `pid` runs and still leads its own group, so a reused pid is never signalled.
#[cfg(unix)]
fn leads_running_group(pid: libc::pid_t) -> bool {
    // SAFETY: both calls only query the process table.
    unsafe { libc::kill(pid, 0) == 0 && libc::getpgid(pid) == pid }
}
