pub mod ai;
pub mod cli;
pub mod commands;
pub mod modules;
pub mod platform;
pub mod window;

use ai::acp::AcpSessionManager;
use modules::lsp::LspManager;
use modules::pty::PtyManager;
use modules::run::RunManager;
use tauri::Manager;
use tauri_plugin_cli::CliExt;
use tauri_plugin_log::{Target, TargetKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let result = tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_cli::init())
        .manage(PtyManager::new())
        .manage(RunManager::new())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .target(Target::new(TargetKind::LogDir {
                    file_name: Some("pragma".into()),
                }))
                .build(),
        )
        .setup(|app| {
            std::panic::set_hook(Box::new(|info| {
                let _location = info
                    .location()
                    .map(|loc| format!("{}:{}", loc.file(), loc.line()))
                    .unwrap_or_else(|| "unknown".to_string());
            }));

            // Load shell environment in the background so slow shells (e.g. PowerShell
            // on Windows with Defender/AMSI cold start) do not block Tauri setup.
            std::thread::spawn(|| if let Err(_e) = modules::env_loader::load_shell_env() {});

            if let Err(_e) = tauri::async_runtime::block_on(modules::mcp::McpManager::initialize(
                app.handle().clone(),
            )) {}

            app.manage(AcpSessionManager::new(app.handle().clone()));
            app.manage(LspManager::managed(app.handle().clone()));

            let project_path = app
                .cli()
                .matches()
                .ok()
                .and_then(|matches| cli::extract_project_path(&matches));
            app.manage(cli::CliArgs { project_path });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            modules::fonts::get_app_data_dir,
            modules::fonts::download_font,
            modules::fonts::import_font_file,
            modules::fonts::delete_font,
            modules::fonts::list_fonts,
            modules::fs::read_text_file,
            modules::fs::write_text_file,
            modules::fs::list_directory,
            modules::fs::list_directory_recursive,
            modules::fs::create_file,
            modules::fs::create_directory,
            modules::fs::rename_file,
            modules::fs::delete_file,
            modules::pty::create_pty,
            modules::pty::create_pty_command,
            modules::pty::resolve_terminal_shell,
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
            modules::git::commands::git_commit_details,
            modules::git::commands::git_checkout_commit,
            modules::git::commands::git_create_branch_from_commit,
            modules::git::commands::git_cherry_pick_commit,
            modules::git::commands::git_revert_commit,
            modules::git::commands::git_reset_to_commit,
            modules::local_history::commands::local_history_entries,
            modules::lsp::lsp_did_open,
            modules::lsp::lsp_did_change,
            modules::lsp::lsp_did_save,
            modules::lsp::lsp_check_server,
            modules::lsp::lsp_install_server,
            modules::lsp::lsp_detect_project_languages,
            modules::lsp::lsp_completion,
            modules::lsp::lsp_completion_resolve,
            modules::lsp::lsp_definition,
            modules::lsp::lsp_did_close,
            modules::lsp::lsp_server_capabilities,
            modules::mcp::mcp_load_config,
            modules::mcp::mcp_save_config,
            modules::mcp::mcp_list_servers,
            modules::mcp::mcp_start_server,
            modules::mcp::mcp_stop_server,
            modules::mcp::mcp_restart_server,
            modules::mcp::mcp_list_tools,
            modules::mcp::mcp_call_tool,
            modules::local_history::commands::local_history_diff,
            modules::local_history::commands::local_history_restore,
            modules::local_history::commands::local_history_delete_older_than,
            modules::workspace::workspace_save,
            modules::workspace::workspace_load,
            modules::workspace::workspace_delete,
            modules::app_state::get_onboarding_completed,
            modules::app_state::set_onboarding_completed,
            modules::run::run_list_configs,
            modules::run::run_detect_configs,
            modules::run::run_save_configs,
            modules::run::check_port_in_use,
            modules::run::kill_process_by_port,
            modules::run::run_start,
            modules::run::run_stop,
            modules::run::run_restart,
            commands::ai::ai_store_key,
            commands::ai::ai_key_status,
            commands::ai::ai_delete_key,
            commands::ai::ai_chat,
            commands::ai::ai_chat_stream,
            commands::ai::cancel_ai_chat_stream,
            commands::ai::ai_test_connection,
            commands::ai::ai_list_models,
            commands::chat_storage::ai_load_sessions,
            commands::chat_storage::ai_load_session_messages,
            commands::chat_storage::ai_save_session,
            commands::chat_storage::ai_save_session_messages,
            commands::chat_storage::ai_delete_session,
            commands::chat_storage::ai_migrate_chat_storage,
            commands::ai::ai_inline_completion,
            commands::ai::ai_terminal_suggestion,
            commands::ai::ai_generate_chat_title,
            commands::ai::copilot_start_device_login,
            commands::ai::copilot_poll_device_login,
            commands::ai::copilot_auth_status,
            commands::ai::copilot_logout,
            commands::ai::open_external_url,
            commands::context::read_chat_context,
            commands::cli::cli_list_manifests,
            commands::cli::cli_check_status,
            commands::cli::cli_check_all_statuses,
            commands::cli::cli_install,
            commands::cli::cli_start_login,
            commands::cli::cli_logout,
            commands::cli::cli_chat,
            commands::cli::cli_chat_stream,
            commands::cli::cli_acp_chat_stream,
            commands::cli::cli_acp_cancel,
            commands::cli::cli_acp_approve,
            commands::docker::docker_list_containers,
            commands::docker::docker_start_container,
            commands::docker::docker_stop_container,
            commands::docker::docker_restart_container,
            commands::docker::docker_runtime_info,
            commands::docker::docker_compose_up,
            commands::docker::docker_compose_down,
            commands::docker::docker_compose_build,
            commands::docker::docker_compose_restart,
            commands::docker::docker_compose_changed_between_branches,
            commands::docker::docker_compose_up_build,
            commands::perf::memory_stats,
            commands::search::search_workspace,
            cli::get_cli_project_path,
            window::create_external_window,
            window::close_external_window,
        ])
        .build(tauri::generate_context!());

    match result {
        Ok(app) => {
            app.run(|app_handle, event| {
                if let tauri::RunEvent::ExitRequested { .. } = event {
                    if let Some(run_manager) = app_handle.try_state::<RunManager>() {
                        run_manager.stop_all();
                    }
                    if let Some(pty_manager) = app_handle.try_state::<PtyManager>() {
                        pty_manager.kill_all();
                    }
                    if let Some(lsp_manager) = app_handle.try_state::<LspManager>() {
                        tauri::async_runtime::block_on(lsp_manager.shutdown_all());
                    }
                }
            });
        }
        Err(_e) => {}
    }
}
