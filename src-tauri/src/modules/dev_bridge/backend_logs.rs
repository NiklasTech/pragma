use std::io::{Read, Seek, SeekFrom};

use tauri::{AppHandle, Manager};

use super::protocol::BridgeReply;

/// The file tauri-plugin-log writes for the `LogDir { file_name: "pragma" }` target.
const LOG_FILE: &str = "pragma.log";
const MAX_TAIL_BYTES: u64 = 1024 * 1024;

/// The last `lines` lines of the backend log file.
pub fn read(app: &AppHandle, lines: u64) -> Result<BridgeReply, String> {
    let path = app
        .path()
        .app_log_dir()
        .map_err(|e| format!("no log dir: {e}"))?
        .join(LOG_FILE);
    let mut file =
        std::fs::File::open(&path).map_err(|e| format!("failed to open {path:?}: {e}"))?;
    let size = file
        .metadata()
        .map_err(|e| format!("failed to read {path:?}: {e}"))?
        .len();
    file.seek(SeekFrom::Start(size.saturating_sub(MAX_TAIL_BYTES)))
        .map_err(|e| format!("failed to read {path:?}: {e}"))?;
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes)
        .map_err(|e| format!("failed to read {path:?}: {e}"))?;
    let text = tail(&String::from_utf8_lossy(&bytes), lines as usize);
    Ok(BridgeReply::text(format!("{}\n{text}", path.display())))
}

fn tail(text: &str, lines: usize) -> String {
    let all: Vec<&str> = text.lines().collect();
    all[all.len().saturating_sub(lines)..].join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tail_keeps_the_last_lines() {
        assert_eq!(tail("a\nb\nc\n", 2), "b\nc");
        assert_eq!(tail("a\nb", 5), "a\nb");
        assert_eq!(tail("", 3), "");
    }
}
