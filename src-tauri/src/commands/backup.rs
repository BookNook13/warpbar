use super::model::DevFlowCommand;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

const COMMANDS_STORE: &str = "commands.json";
const COMMANDS_KEY: &str = "commands";
const SECURITY_STORE: &str = "security.json";
const TRUSTED_KEY: &str = "trusted_programs";

#[derive(Debug, Serialize, Deserialize)]
struct BackupBundle {
    schema_version: u32,
    exported_at: i64,
    commands: Vec<DevFlowCommand>,
    trusted_programs: Vec<String>,
}

fn backups_dir() -> Result<PathBuf, String> {
    let home = std::env::var("HOME").map_err(|_| "HOME environment variable not set".to_string())?;
    let dir = PathBuf::from(home).join("Warpbar-Backups");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

#[tauri::command]
pub fn export_backup(app: AppHandle) -> Result<String, String> {
    let commands_store = app.store(COMMANDS_STORE).map_err(|e| e.to_string())?;
    let commands: Vec<DevFlowCommand> = commands_store
        .get(COMMANDS_KEY)
        .map(|v| serde_json::from_value(v).unwrap_or_default())
        .unwrap_or_default();

    let security_store = app.store(SECURITY_STORE).map_err(|e| e.to_string())?;
    let trusted_programs: Vec<String> = security_store
        .get(TRUSTED_KEY)
        .map(|v| serde_json::from_value(v).unwrap_or_default())
        .unwrap_or_default();

    let exported_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64;

    let bundle = BackupBundle {
        schema_version: 1,
        exported_at,
        commands,
        trusted_programs,
    };

    let dir = backups_dir()?;
    let filename = format!("warpbar-backup-{exported_at}.json");
    let path = dir.join(&filename);

    let json = serde_json::to_string_pretty(&bundle).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())?;

    Ok(path.to_string_lossy().to_string())
}

#[derive(Debug, Serialize)]
pub struct ImportSummary {
    pub commands_added: usize,
    pub commands_skipped: usize,
    pub programs_added: usize,
}

#[tauri::command]
pub fn import_backup(app: AppHandle, path: String) -> Result<ImportSummary, String> {
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Could not read '{path}': {e}"))?;
    let bundle: BackupBundle =
        serde_json::from_str(&content).map_err(|e| format!("Not a valid backup file: {e}"))?;

    let commands_store = app.store(COMMANDS_STORE).map_err(|e| e.to_string())?;
    let mut existing_commands: Vec<DevFlowCommand> = commands_store
        .get(COMMANDS_KEY)
        .map(|v| serde_json::from_value(v).unwrap_or_default())
        .unwrap_or_default();

    let existing_ids: std::collections::HashSet<String> =
        existing_commands.iter().map(|c| c.id.clone()).collect();

    let mut commands_added = 0;
    let mut commands_skipped = 0;

    for cmd in bundle.commands {
        if existing_ids.contains(&cmd.id) {
            commands_skipped += 1;
        } else {
            existing_commands.push(cmd);
            commands_added += 1;
        }
    }

    commands_store.set(COMMANDS_KEY.to_string(), serde_json::json!(existing_commands));
    commands_store.save().map_err(|e| e.to_string())?;

    let security_store = app.store(SECURITY_STORE).map_err(|e| e.to_string())?;
    let mut existing_trusted: Vec<String> = security_store
        .get(TRUSTED_KEY)
        .map(|v| serde_json::from_value(v).unwrap_or_default())
        .unwrap_or_default();

    let mut programs_added = 0;
    for program in bundle.trusted_programs {
        if !existing_trusted.contains(&program) {
            existing_trusted.push(program);
            programs_added += 1;
        }
    }

    security_store.set(TRUSTED_KEY.to_string(), serde_json::json!(existing_trusted));
    security_store.save().map_err(|e| e.to_string())?;

    Ok(ImportSummary {
        commands_added,
        commands_skipped,
        programs_added,
    })
}

#[tauri::command]
pub fn get_backups_dir() -> Result<String, String> {
    Ok(backups_dir()?.to_string_lossy().to_string())
}
