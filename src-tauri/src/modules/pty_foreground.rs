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

/// The names of the foreground process group leader, or `None` while the shell itself waits.
#[cfg(unix)]
pub(crate) fn foreground_names(shell_pid: Option<u32>, leader: Option<i32>) -> Option<Vec<String>> {
    let leader = u32::try_from(leader?).ok()?;
    if Some(leader) == shell_pid {
        return None;
    }
    let pid = Pid::from_u32(leader);
    let mut system = System::new();
    system.refresh_processes_specifics(ProcessesToUpdate::Some(&[pid]), true, refresh_kind());
    system.process(pid).map(names_of)
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
    use super::process_names;

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
}
