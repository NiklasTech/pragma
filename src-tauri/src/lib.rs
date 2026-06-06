mod commands;

use commands::pty::PtyManager;
use commands::run::RunManager;

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
            commands::fs::read_text_file,
            commands::fs::write_text_file,
            commands::fs::list_directory,
            commands::fs::create_file,
            commands::fs::create_directory,
            commands::fs::rename_file,
            commands::fs::delete_file,
            commands::pty::create_pty,
            commands::pty::write_pty,
            commands::pty::resize_pty,
            commands::pty::kill_pty,
            commands::git::git_status,
            commands::ai::ai_list_providers,
            commands::lsp::lsp_list_servers,
            commands::mcp::mcp_list_servers,
            commands::run::run_list_configs,
            commands::run::run_start,
            commands::run::run_stop,
            commands::run::run_restart,
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
