use serde::Serialize;
use std::fs;
use std::time::SystemTime;

#[derive(Debug, Clone, Serialize)]
pub struct LastShellDir {
    pub path: String,
    pub age_secs: u64,
}

fn state_file_path() -> Option<std::path::PathBuf> {
    let home = std::env::var("HOME").ok()?;
    Some(std::path::PathBuf::from(home).join(".cache/warpbar/last_dir"))
}

/// Reads whatever directory the shell-integration hook last recorded,
/// along with how long ago that was. Returns None if the hook was
/// never installed (no file), or if the file is empty/unreadable —
/// callers should treat None as "fall back to default behavior,"
/// never as an error.
#[tauri::command]
pub fn get_last_shell_dir() -> Option<LastShellDir> {
    let path = state_file_path()?;
    let metadata = fs::metadata(&path).ok()?;
    let modified = metadata.modified().ok()?;
    let age_secs = SystemTime::now().duration_since(modified).ok()?.as_secs();
    let content = fs::read_to_string(&path).ok()?;
    let trimmed = content.trim();
    if trimmed.is_empty() {
        return None;
    }
    Some(LastShellDir {
        path: trimmed.to_string(),
        age_secs,
    })
}
