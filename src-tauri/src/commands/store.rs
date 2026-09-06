use super::model::{CommandAction, DevFlowCommand};
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;
use serde_json::json;

const STORE_PATH: &str = "commands.json";
const KEY: &str = "commands";

#[tauri::command]
pub fn get_commands(app: AppHandle) -> Result<Vec<DevFlowCommand>, String> {
    let store = app.store(STORE_PATH).map_err(|e| e.to_string())?;
    let commands = store
        .get(KEY)
        .map(|v| serde_json::from_value(v).unwrap_or_default())
        .unwrap_or_default();
    Ok(commands)
}

#[tauri::command]
pub fn save_command(app: AppHandle, mut cmd: DevFlowCommand) -> Result<DevFlowCommand, String> {
    let store = app.store(STORE_PATH).map_err(|e| e.to_string())?;
    let mut commands: Vec<DevFlowCommand> = store
        .get(KEY)
        .map(|v| serde_json::from_value(v).unwrap_or_default())
        .unwrap_or_default();

    if cmd.id.is_empty() {
        cmd.id = uuid::Uuid::new_v4().to_string();
    }
    cmd.created_at = now_ms();
    commands.push(cmd.clone());

    store.set(KEY.to_string(), json!(commands));
    store.save().map_err(|e| e.to_string())?;
    Ok(cmd)
}

#[tauri::command]
pub fn update_command(app: AppHandle, cmd: DevFlowCommand) -> Result<(), String> {
    let store = app.store(STORE_PATH).map_err(|e| e.to_string())?;
    let mut commands: Vec<DevFlowCommand> = store
        .get(KEY)
        .map(|v| serde_json::from_value(v).unwrap_or_default())
        .unwrap_or_default();

    if let Some(existing) = commands.iter_mut().find(|c| c.id == cmd.id) {
        *existing = cmd;
    }
    store.set(KEY.to_string(), json!(commands));
    store.save().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_command(app: AppHandle, id: String) -> Result<(), String> {
    let store = app.store(STORE_PATH).map_err(|e| e.to_string())?;
    let mut commands: Vec<DevFlowCommand> = store
        .get(KEY)
        .map(|v| serde_json::from_value(v).unwrap_or_default())
        .unwrap_or_default();

    commands.retain(|c| c.id != id);
    store.set(KEY.to_string(), json!(commands));
    store.save().map_err(|e| e.to_string())
}

pub fn seed_defaults_if_empty(app: &AppHandle) -> Result<(), String> {
    let store = app.store(STORE_PATH).map_err(|e| e.to_string())?;
    let existing: Vec<DevFlowCommand> = store
        .get(KEY)
        .map(|v| serde_json::from_value(v).unwrap_or_default())
        .unwrap_or_default();

    if !existing.is_empty() {
        return Ok(());
    }

    let defaults = vec![
        DevFlowCommand {
            id: uuid::Uuid::new_v4().to_string(),
            title: "List files".to_string(),
            subtitle: Some("ls -la".to_string()),
            keywords: vec!["ls".to_string(), "files".to_string(), "list".to_string()],
            action: CommandAction::Shell {
                cmd: "ls".to_string(),
                args: vec!["-la".to_string()],
            },
            is_custom: false,
            use_count: 0,
            last_used_at: None,
            created_at: now_ms(),
        },
        DevFlowCommand {
            id: uuid::Uuid::new_v4().to_string(),
            title: "Show disk usage".to_string(),
            subtitle: Some("df -h".to_string()),
            keywords: vec!["disk".to_string(), "df".to_string(), "storage".to_string()],
            action: CommandAction::Shell {
                cmd: "df".to_string(),
                args: vec!["-h".to_string()],
            },
            is_custom: false,
            use_count: 0,
            last_used_at: None,
            created_at: now_ms(),
        },
    ];

    store.set(KEY.to_string(), json!(defaults));
    store.save().map_err(|e| e.to_string())
}

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64
}
