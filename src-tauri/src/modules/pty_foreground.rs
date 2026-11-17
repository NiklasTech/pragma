//! Which program runs in the foreground of a terminal, so a coding CLI started by hand in a shell
//! pane can be recognized.

use std::path::Path;

use sysinfo::{Pid, Process, ProcessRefreshKind, ProcessesToUpdate, System, UpdateKind};

/// Names reported per process: the process name and the first arguments, as file names only.
const MAX_NAMES: usize = 4;

/// The file name of a program or script path, without folders.
fn file_name(arg: &str) -> Option<String> {
    let name = Path::new(arg)
        .file_name()?
        .to_string_lossy()
        .trim()
        .to_string();
    (!name.is_empty() && !name.starts_with('-')).then_some(name)
}

/// The names that identify a process: its name, then its program and script arguments.
pub(crate) fn process_names(name: &str, cmd: &[String]) -> Vec<String> {
    let mut names: Vec<String> = Vec::new();
    for candidate in std::iter::once(name).chain(cmd.iter().map(String::as_str)) {
        if let Some(name) = file_name(candidate) {
            if !names.contains(&name) {
                names.push(name);
            }
        }
        if names.len() == MAX_NAMES {
            break;
        }
    }
    names
}

fn names_of(process: &Process) -> Vec<String> {
    let cmd: Vec<String> = process
        .cmd()
        .iter()
        .map(|arg| arg.to_string_lossy().into_owned())
        .collect();
    process_names(&process.name().to_string_lossy(), &cmd)
}

fn refresh_kind() -> ProcessRefreshKind {
    ProcessRefreshKind::nothing()
        .with_cmd(UpdateKind::Always)
        .without_tasks()
}

/// Shells that run wrapper scripts; a CLI started by such a script is their child, not the leader.
#[cfg(unix)]
const WRAPPER_SHELLS: [&str; 5] = ["bash", "sh", "zsh", "dash", "fish"];

/// Child processes looked at under a wrapper script.
#[cfg(unix)]
const MAX_CHILDREN: usize = 4;

#[cfg(unix)]
pub(crate) fn is_wrapper_shell(name: &str) -> bool {
    let name = Path::new(name)
        .file_name()
        .map(|file| file.to_string_lossy().to_ascii_lowercase())
        .unwrap_or_default();
    WRAPPER_SHELLS.contains(&name.trim_start_matches('-'))
}

#[cfg(any(unix, test))]
/// Adds names that are not in the list yet, keeping their order.
pub(crate) fn merge_names(names: &mut Vec<String>, more: Vec<String>) {
    for name in more {
        if !names.contains(&name) {
            names.push(name);
        }
    }
}

/// The names of the foreground process group leader and, when it is a shell running a script such
/// as a `claude` wrapper, of the programs that script started; `None` while the shell itself waits.
#[cfg(unix)]
pub(crate) fn foreground_names(shell_pid: Option<u32>, leader: Option<i32>) -> Option<Vec<String>> {
    let leader = u32::try_from(leader?).ok()?;
    if Some(leader) == shell_pid {
        return None;
    }
    let pid = Pid::from_u32(leader);
    let mut system = System::new();
    system.refresh_processes_specifics(ProcessesToUpdate::Some(&[pid]), true, refresh_kind());
    let process = system.process(pid)?;
    let mut names = names_of(process);
    if !is_wrapper_shell(&process.name().to_string_lossy()) {
        return Some(names);
    }

    system.refresh_processes_specifics(ProcessesToUpdate::All, true, ProcessRefreshKind::nothing());
    let children: Vec<Pid> = system
        .processes()
        .values()
        .filter(|child| child.parent() == Some(pid))
        .map(Process::pid)
        .take(MAX_CHILDREN)
        .collect();
    if children.is_empty() {
        return Some(names);
    }
    system.refresh_processes_specifics(ProcessesToUpdate::Some(&children), true, refresh_kind());
    for child in &children {
        if let Some(process) = system.process(*child) {
            merge_names(&mut names, names_of(process));
        }
    }
    Some(names)
}

/// Windows has no foreground process group; the newest program started under the shell stands in.
#[cfg(windows)]
pub(crate) fn foreground_names(shell_pid: Option<u32>) -> Option<Vec<String>> {
    const CONSOLE_HOSTS: [&str; 2] = ["conhost.exe", "openconsole.exe"];
    let shell = Pid::from_u32(shell_pid?);
    let mut system = System::new();
    system.refresh_processes_specifics(ProcessesToUpdate::All, true, refresh_kind());

    let mut newest: Option<&Process> = None;
    let mut parents = vec![shell];
    while let Some(parent) = parents.pop() {
        for process in system.processes().values() {
            if process.parent() != Some(parent) {
                continue;
            }
            parents.push(process.pid());
            let name = process.name().to_string_lossy().to_ascii_lowercase();
            if CONSOLE_HOSTS.contains(&name.as_str()) {
                continue;
            }
            let older =
                matches!(newest, Some(current) if process.start_time() < current.start_time());
            if !older {
                newest = Some(process);
            }
        }
    }
    newest.map(names_of)
}

#[cfg(test)]
mod tests {
    use super::{merge_names, process_names};

    fn args(list: &[&str]) -> Vec<String> {
        list.iter().map(|arg| arg.to_string()).collect()
    }

    #[test]
    fn names_a_native_cli_by_its_file_name() {
        assert_eq!(
            process_names(
                "claude",
                &args(&["/Users/me/.local/bin/claude", "--resume"])
            ),
            vec!["claude"]
        );
    }

    #[test]
    fn names_the_script_of_a_node_cli() {
        assert_eq!(
            process_names(
                "node",
                &args(&["node", "/opt/homebrew/bin/gemini", "-p", "hi"])
            ),
            vec!["node", "gemini", "hi"]
        );
    }

    #[test]
    fn skips_flags_and_stops_after_a_few_names() {
        let cmd = args(&["a", "--flag", "b", "c", "d", "e"]);
        assert_eq!(process_names("x", &cmd), vec!["x", "a", "b", "c"]);
    }

    #[test]
    fn adds_the_names_of_a_wrapper_child_once() {
        let mut names = vec!["bash".to_string(), "cla".to_string()];
        merge_names(&mut names, vec!["claude".to_string(), "bash".to_string()]);
        assert_eq!(names, vec!["bash", "cla", "claude"]);
    }

    #[cfg(unix)]
    #[test]
    fn treats_shells_running_a_script_as_wrappers() {
        use super::is_wrapper_shell;
        assert!(is_wrapper_shell("/bin/bash"));
        assert!(is_wrapper_shell("-zsh"));
        assert!(!is_wrapper_shell("claude"));
        assert!(!is_wrapper_shell("node"));
    }
}
