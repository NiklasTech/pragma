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

/// Like [`new_std_command`], but runs `.cmd` / `.bat` files through
/// `cmd.exe /c` on Windows so they actually execute.
pub fn new_std_command_for_program<S: AsRef<std::ffi::OsStr>>(program: S) -> std::process::Command {
    let program = program.as_ref();

    #[cfg(target_os = "windows")]
    {
        let lower = program.to_string_lossy().to_ascii_lowercase();
        if lower.ends_with(".cmd") || lower.ends_with(".bat") {
            let mut cmd = new_std_command("cmd");
            cmd.arg("/c").arg(program);
            return cmd;
        }
    }

    new_std_command(program)
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

// -- Program resolution --------------------------------------------------------

/// Resolve a program name to an executable path.
///
/// GUI apps on Windows often do not inherit the user's shell PATH, so package
/// managers installed by npm/pnpm/corepack may not be found. This helper first
/// searches PATH, then falls back to well-known installation directories for
/// common tools.
pub fn resolve_program(program: &str) -> Result<std::path::PathBuf, String> {
    use std::path::Path;

    let path = Path::new(program);

    // If the user already provided a path, use it directly.
    if path.is_absolute() || path.components().count() > 1 {
        return Ok(path.to_path_buf());
    }

    // 1. Search PATH.
    if let Some(found) = which_in_path(program) {
        return Ok(found);
    }

    // 2. Fall back to known install locations.
    let fallback_dirs = known_fallback_dirs();
    for dir in &fallback_dirs {
        for candidate in candidate_names(program) {
            let full = dir.join(&candidate);
            if full.is_file() {
                return Ok(full);
            }
        }
    }

    // 3. Build a helpful error message.
    let mut searched: Vec<String> = std::env::var_os("PATH")
        .map(|p| {
            std::env::split_paths(&p)
                .map(|d| d.to_string_lossy().to_string())
                .collect()
        })
        .unwrap_or_default();
    for dir in &fallback_dirs {
        searched.push(dir.to_string_lossy().to_string());
    }

    Err(format!(
        "Cannot find '{}' in PATH. Searched: {}",
        program,
        searched.join(", ")
    ))
}

/// Look up `name` in the directories listed in the `PATH` environment variable,
/// honouring executable extensions on Windows.
fn which_in_path(name: &str) -> Option<std::path::PathBuf> {
    let path_var = std::env::var_os("PATH")?;
    let dirs = std::env::split_paths(&path_var);

    #[cfg(target_os = "windows")]
    let exts: Vec<String> = std::env::var_os("PATHEXT")
        .map(|e| {
            std::env::split_paths(&e)
                .map(|ext| ext.to_string_lossy().to_string())
                .collect()
        })
        .unwrap_or_else(|| vec![".exe".to_string(), ".cmd".to_string(), ".bat".to_string()]);

    for dir in dirs {
        for candidate in candidate_names(name) {
            let full = dir.join(&candidate);
            if full.is_file() {
                return Some(full);
            }
        }

        #[cfg(target_os = "windows")]
        {
            for ext in &exts {
                let full = dir.join(format!("{}{}", name, ext));
                if full.is_file() {
                    return Some(full);
                }
            }
        }
    }

    None
}

/// Return the possible file names for a program on the current platform.
#[cfg(target_os = "windows")]
fn candidate_names(name: &str) -> Vec<String> {
    let lower = name.to_ascii_lowercase();
    match lower.as_str() {
        "pnpm" => vec![
            "pnpm.exe".to_string(),
            "pnpm.cmd".to_string(),
            "pnpm".to_string(),
        ],
        "npm" => vec![
            "npm.cmd".to_string(),
            "npm.exe".to_string(),
            "npm".to_string(),
        ],
        "yarn" => vec![
            "yarn.cmd".to_string(),
            "yarn.exe".to_string(),
            "yarn".to_string(),
        ],
        "bun" => vec![
            "bun.exe".to_string(),
            "bun.cmd".to_string(),
            "bun".to_string(),
        ],
        "cargo" => vec!["cargo.exe".to_string(), "cargo".to_string()],
        _ => vec![
            format!("{}.exe", name),
            format!("{}.cmd", name),
            name.to_string(),
        ],
    }
}

#[cfg(not(target_os = "windows"))]
fn candidate_names(name: &str) -> Vec<String> {
    vec![name.to_string()]
}

/// Return well-known installation directories for package managers and other
/// common CLI tools.
#[cfg(target_os = "windows")]
fn known_fallback_dirs() -> Vec<std::path::PathBuf> {
    let mut dirs = Vec::new();

    if let Some(local_app_data) = std::env::var_os("LOCALAPPDATA") {
        let base = std::path::PathBuf::from(&local_app_data);
        dirs.push(base.join("pnpm"));
        dirs.push(base.join("Yarn").join("bin"));
        dirs.push(base.join("Microsoft").join("WinGet").join("Links"));
    }

    if let Some(app_data) = std::env::var_os("APPDATA") {
        let base = std::path::PathBuf::from(&app_data);
        dirs.push(base.join("npm"));
        dirs.push(
            base.join("npm")
                .join("node_modules")
                .join("pnpm")
                .join("bin"),
        );
    }

    if let Some(profile) = std::env::var_os("USERPROFILE") {
        let base = std::path::PathBuf::from(&profile);
        dirs.push(base.join(".cargo").join("bin"));
        dirs.push(base.join(".bun").join("bin"));
        dirs.push(base.join(".npm").join("global").join("bin"));
        dirs.push(base.join("scoop").join("shims"));
    }

    if let Some(pf) = std::env::var_os("ProgramFiles") {
        let base = std::path::PathBuf::from(&pf);
        dirs.push(base.join("nodejs"));
        dirs.push(base.join("Git").join("cmd"));
        dirs.push(base.join("Git").join("bin"));
    }

    if let Some(pf_x86) = std::env::var_os("ProgramFiles(x86)") {
        let base = std::path::PathBuf::from(&pf_x86);
        dirs.push(base.join("nodejs"));
    }

    dirs
}

#[cfg(not(target_os = "windows"))]
fn known_fallback_dirs() -> Vec<std::path::PathBuf> {
    let mut dirs = Vec::new();

    if let Some(home) = std::env::var_os("HOME") {
        let base = std::path::PathBuf::from(&home);
        dirs.push(base.join(".local").join("share").join("pnpm"));
        dirs.push(base.join(".cargo").join("bin"));
        dirs.push(base.join(".bun").join("bin"));
        dirs.push(base.join(".npm").join("global").join("bin"));
    }

    dirs.push(std::path::PathBuf::from("/usr/local/bin"));
    dirs.push(std::path::PathBuf::from("/opt/homebrew/bin"));
    dirs.push(std::path::PathBuf::from("/usr/bin"));
    dirs.push(std::path::PathBuf::from("/bin"));

    dirs
}

// -- Port utilities ------------------------------------------------------------

/// Check whether a local TCP port is currently in use.
pub fn check_port_in_use(port: u16) -> bool {
    // Binding to 0.0.0.0 covers both localhost-only and all-interface listeners.
    std::net::TcpListener::bind(("0.0.0.0", port)).is_err()
}

/// Find the PID of the process listening on `port` and kill it (plus its
/// children on Windows).
pub fn kill_process_by_port(port: u16) -> Result<(), String> {
    let pid = find_pid_by_port(port).ok_or_else(|| format!("No process found on port {port}"))?;
    kill_process_tree(pid).map_err(|e| format!("Failed to kill process {pid}: {e}"))
}

/// Kill a process and its children.
fn kill_process_tree(pid: u32) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let output = std::process::Command::new("taskkill")
            .args(["/T", "/F", "/PID", &pid.to_string()])
            .output()
            .map_err(|e| e.to_string())?;
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(stderr.to_string());
        }
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        // Try to kill the process group first, then the process itself.
        unsafe {
            let _ = libc::killpg(pid as i32, libc::SIGTERM);
        }
        std::thread::sleep(std::time::Duration::from_millis(200));
        unsafe {
            let _ = libc::killpg(pid as i32, libc::SIGKILL);
            let _ = libc::kill(pid as i32, libc::SIGKILL);
        }
        Ok(())
    }
}

#[cfg(target_os = "windows")]
fn find_pid_by_port(port: u16) -> Option<u32> {
    let output = std::process::Command::new("netstat")
        .args(["-ano"])
        .output()
        .ok()?;
    let stdout = String::from_utf8_lossy(&output.stdout);

    for line in stdout.lines() {
        let trimmed = line.trim();
        if !trimmed.contains(&format!(":{port}")) {
            continue;
        }

        let parts: Vec<&str> = trimmed.split_whitespace().collect();
        if parts.len() < 5 {
            continue;
        }

        let state = parts[3].to_ascii_lowercase();
        if !state.contains("abh") && state != "listening" {
            continue;
        }

        return parts[4].parse().ok();
    }

    None
}

#[cfg(not(target_os = "windows"))]
fn find_pid_by_port(port: u16) -> Option<u32> {
    // Try lsof first (available on macOS and most Linux distros).
    if let Ok(output) = std::process::Command::new("lsof")
        .args(["-ti", &format!(":{port}")])
        .output()
    {
        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines() {
            if let Ok(pid) = line.trim().parse::<u32>() {
                return Some(pid);
            }
        }
    }

    // Fallback to ss.
    if let Ok(output) = std::process::Command::new("ss")
        .args(["-tlnp", &format!("sport = :{port}")])
        .output()
    {
        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines() {
            if let Some(start) = line.find("pid=") {
                let rest = &line[start + 4..];
                let end = rest
                    .find(|c: char| !c.is_ascii_digit())
                    .unwrap_or(rest.len());
                if let Ok(pid) = rest[..end].parse::<u32>() {
                    return Some(pid);
                }
            }
        }
    }

    None
}
