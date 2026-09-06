use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;
use serde_json::json;

const SECURITY_STORE: &str = "security.json";
const TRUSTED_KEY: &str = "trusted_programs";

const HISTORY_STORE: &str = "history.json";
const HISTORY_KEY: &str = "history";
const HISTORY_LIMIT: usize = 200;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEntry {
    pub program: String,
    pub args: Vec<String>,
    pub exit_code: i32,
    pub success: bool,
    pub duration_ms: u128,
    pub timestamp: i64,
}

#[tauri::command]
pub fn is_program_trusted(app: AppHandle, program: String) -> Result<bool, String> {
    let store = app.store(SECURITY_STORE).map_err(|e| e.to_string())?;
    let trusted: Vec<String> = store
        .get(TRUSTED_KEY)
        .map(|v| serde_json::from_value(v).unwrap_or_default())
        .unwrap_or_default();
    Ok(trusted.iter().any(|p| p == &program))
}

#[tauri::command]
pub fn trust_program(app: AppHandle, program: String) -> Result<(), String> {
    let store = app.store(SECURITY_STORE).map_err(|e| e.to_string())?;
    let mut trusted: Vec<String> = store
        .get(TRUSTED_KEY)
        .map(|v| serde_json::from_value(v).unwrap_or_default())
        .unwrap_or_default();

    if !trusted.iter().any(|p| p == &program) {
        trusted.push(program);
    }

    store.set(TRUSTED_KEY.to_string(), json!(trusted));
    store.save().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_execution_history(app: AppHandle) -> Result<Vec<HistoryEntry>, String> {
    let store = app.store(HISTORY_STORE).map_err(|e| e.to_string())?;
    let history: Vec<HistoryEntry> = store
        .get(HISTORY_KEY)
        .map(|v| serde_json::from_value(v).unwrap_or_default())
        .unwrap_or_default();
    Ok(history)
}

/// Best-effort append — a failure to log history should never block
/// or fail the command execution itself.
pub fn record_execution(app: &AppHandle, entry: HistoryEntry) {
    let Ok(store) = app.store(HISTORY_STORE) else { return };
    let mut history: Vec<HistoryEntry> = store
        .get(HISTORY_KEY)
        .map(|v| serde_json::from_value(v).unwrap_or_default())
        .unwrap_or_default();

    history.push(entry);
    if history.len() > HISTORY_LIMIT {
        let overflow = history.len() - HISTORY_LIMIT;
        history.drain(0..overflow);
    }

    store.set(HISTORY_KEY.to_string(), json!(history));
    let _ = store.save();
}

#[tauri::command]
pub fn get_trusted_programs(app: AppHandle) -> Result<Vec<String>, String> {
    let store = app.store(SECURITY_STORE).map_err(|e| e.to_string())?;
    let trusted: Vec<String> = store
        .get(TRUSTED_KEY)
        .map(|v| serde_json::from_value(v).unwrap_or_default())
        .unwrap_or_default();
    Ok(trusted)
}

#[tauri::command]
pub fn revoke_program(app: AppHandle, program: String) -> Result<(), String> {
    let store = app.store(SECURITY_STORE).map_err(|e| e.to_string())?;
    let mut trusted: Vec<String> = store
        .get(TRUSTED_KEY)
        .map(|v| serde_json::from_value(v).unwrap_or_default())
        .unwrap_or_default();

    trusted.retain(|p| p != &program);

    store.set(TRUSTED_KEY.to_string(), json!(trusted));
    store.save().map_err(|e| e.to_string())
}
