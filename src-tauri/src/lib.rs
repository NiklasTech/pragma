mod commands {
    pub mod fs;
    pub mod pty;
}

use commands::pty::PtyManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(PtyManager::new())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::fs::read_text_file,
            commands::fs::write_text_file,
            commands::pty::create_pty,
            commands::pty::write_pty,
            commands::pty::resize_pty,
            commands::pty::kill_pty,
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
