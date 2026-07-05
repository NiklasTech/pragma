//! Platform-specific process spawning helpers.
//!
//! On Windows, spawning a console subsystem child process from a GUI app
//! causes a brief flashing console window to appear. Every helper here sets
//! `CREATE_NO_WINDOW` so spawned processes run hidden.

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

/// Create a hidden `std::process::Command` on Windows.
pub fn new_std_command<S: AsRef<std::ffi::OsStr>>(program: S) -> std::process::Command {
    let mut cmd = std::process::Command::new(program);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}

/// Create a hidden `tokio::process::Command` on Windows.
pub fn new_tokio_command<S: AsRef<std::ffi::OsStr>>(program: S) -> tokio::process::Command {
    let mut cmd = tokio::process::Command::new(program);
    #[cfg(target_os = "windows")]
    {
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}
