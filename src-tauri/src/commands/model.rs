use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum CommandAction {
    Shell { cmd: String, args: Vec<String> },
    Workflow { steps: Vec<String> },
    Open { path: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DevFlowCommand {
    pub id: String,
    pub title: String,
    pub subtitle: Option<String>,
    pub keywords: Vec<String>,
    pub action: CommandAction,
    pub is_custom: bool,
    pub use_count: u32,
    pub last_used_at: Option<i64>,
    pub created_at: i64,
    /// "fixed" (use cwd_path verbatim) or "lastShell" (use whatever the
    /// shell-integration hook last recorded). None means no working
    /// directory override — behaves exactly as before this feature.
    /// Both fields are optional and default to None when absent from
    /// older stored commands, so this is fully backward-compatible.
    pub cwd_mode: Option<String>,
    pub cwd_path: Option<String>,
}
