mod cmdline;
mod commands;
mod detection;
mod manager;
mod process;
mod types;

pub(crate) use cmdline::{parse_command, resolve_cwd};
pub use commands::{
    check_port_in_use, kill_process_by_port, run_detect_configs, run_list_configs, run_restart,
    run_save_configs, run_start, run_stop,
};
pub use manager::RunManager;
pub use types::{DebugConfig, RunConfig, RunStatus};

#[doc(hidden)]
pub use commands::{
    __cmd__check_port_in_use, __cmd__kill_process_by_port, __cmd__run_detect_configs,
    __cmd__run_list_configs, __cmd__run_restart, __cmd__run_save_configs, __cmd__run_start,
    __cmd__run_stop, __tauri_command_name_check_port_in_use,
    __tauri_command_name_kill_process_by_port, __tauri_command_name_run_detect_configs,
    __tauri_command_name_run_list_configs, __tauri_command_name_run_restart,
    __tauri_command_name_run_save_configs, __tauri_command_name_run_start,
    __tauri_command_name_run_stop,
};
