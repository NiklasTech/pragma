pub mod ai;
pub mod commands;
pub mod modules;

use modules::pty::PtyManager;
use modules::run::RunManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(PtyManager::new())
        .manage(RunManager::new())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            modules::fs::read_text_file,
            modules::fs::write_text_file,
            modules::fs::list_directory,
            modules::fs::create_file,
            modules::fs::create_directory,
            modules::fs::rename_file,
            modules::fs::delete_file,
            modules::pty::create_pty,
            modules::pty::write_pty,
            modules::pty::resize_pty,
            modules::pty::kill_pty,
            modules::git::commands::git_status,
            modules::git::commands::git_branches,
            modules::git::commands::git_log,
            modules::git::commands::git_log_entries,
            modules::git::commands::git_commit_files,
            modules::git::commands::git_stage,
            modules::git::commands::git_unstage,
            modules::git::commands::git_discard,
            modules::git::commands::git_diff,
            modules::git::commands::git_diff_content,
            modules::git::commands::git_commit,
            modules::git::commands::git_checkout_branch,
            modules::git::commands::git_create_branch,
            modules::git::commands::git_delete_branch,
            modules::git::commands::git_has_uncommitted_changes,
            modules::git::commands::git_remotes,
            modules::git::commands::git_remote_branches,
            modules::git::commands::git_fetch,
            modules::git::commands::git_pull,
            modules::git::commands::git_push,
            modules::git::commands::git_show_commit,
            modules::git::commands::git_commit_file_diff,
            modules::git::commands::git_remote_url,
            modules::git::commands::git_stash_push,
            modules::git::commands::git_stash_pop,
            modules::git::commands::git_stash_list,
            modules::git::commands::git_smart_checkout,
            modules::local_history::commands::local_history_snapshots,
            modules::local_history::commands::local_history_diff,
            modules::local_history::commands::local_history_restore,
            modules::local_history::commands::local_history_delete_older_than,
            modules::workspace::workspace_save,
            modules::workspace::workspace_load,
            modules::workspace::workspace_delete,
            modules::run::run_list_configs,
            modules::run::run_start,
            modules::run::run_stop,
            modules::run::run_restart,
            commands::ai::ai_store_key,
            commands::ai::ai_get_key,
            commands::ai::ai_key_status,
            commands::ai::ai_delete_key,
            commands::ai::ai_chat,
            commands::ai::ai_chat_stream,
            commands::cli::cli_list_manifests,
            commands::cli::cli_check_status,
            commands::cli::cli_check_all_statuses,
            commands::cli::cli_install,
            commands::cli::cli_start_login,
            commands::cli::cli_logout,
            commands::cli::cli_chat,
            commands::cli::cli_chat_stream,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
