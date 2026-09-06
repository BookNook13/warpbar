use super::security::{record_execution, HistoryEntry};
use serde::Serialize;
use std::collections::HashSet;
use std::path::Path;
use std::process::Stdio;
use std::time::Duration;
use tauri::AppHandle;
use tokio::process::Command as AsyncCommand;
use tokio::time::timeout;

const DEFAULT_TIMEOUT_SECS: u64 = 30;
const MAX_OUTPUT_BYTES: usize = 200_000;

/// Environment variables that are common code-injection vectors when
/// inherited by a spawned child process. Everything else from the
/// current environment is preserved, so ordinary tools (nvm, direnv,
/// language toolchains) keep working — only known-dangerous vectors
/// are stripped.
const ENV_DENYLIST: &[&str] = &[
    "LD_PRELOAD",
    "LD_LIBRARY_PATH",
    "LD_AUDIT",
    "DYLD_INSERT_LIBRARIES",
    "DYLD_LIBRARY_PATH",
    "PYTHONPATH",
    "NODE_OPTIONS",
    "PERL5LIB",
    "RUBYOPT",
    "BASH_ENV",
    "ENV",
    "IFS",
];

#[derive(Debug, Clone, Serialize)]
pub struct ExecutionResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
    pub success: bool,
    pub duration_ms: u128,
    pub truncated: bool,
}

#[tauri::command]
pub async fn execute_shell_command(
    app: AppHandle,
    program: String,
    args: Vec<String>,
    cwd: Option<String>,
    timeout_secs: Option<u64>,
) -> Result<ExecutionResult, String> {
    let program = program.trim();
    if program.is_empty() {
        return Err("Command name cannot be empty".to_string());
    }

    let denylist: HashSet<&str> = ENV_DENYLIST.iter().copied().collect();

    let mut command = AsyncCommand::new(program);
    command
        .args(&args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // Sanitize environment: start clean, then re-add everything except
    // known injection vectors, rather than an allowlist that would
    // silently break tools relying on less common but legitimate vars.
    command.env_clear();
    for (key, value) in std::env::vars() {
        if !denylist.contains(key.as_str()) {
            command.env(key, value);
        }
    }

    if let Some(dir) = &cwd {
        let path = Path::new(dir);
        if !path.is_dir() {
            return Err(format!("Working directory does not exist: {dir}"));
        }
        command.current_dir(path);
    }

    let start = std::time::Instant::now();

    let child = command
        .spawn()
        .map_err(|e| format!("Failed to start '{program}': {e}"))?;

    let wait_secs = timeout_secs.unwrap_or(DEFAULT_TIMEOUT_SECS);
    let output = timeout(Duration::from_secs(wait_secs), child.wait_with_output())
        .await
        .map_err(|_| format!("'{program}' timed out after {wait_secs}s"))?
        .map_err(|e| format!("Execution error while running '{program}': {e}"))?;

    let mut stdout_bytes = output.stdout;
    let mut stderr_bytes = output.stderr;
    let mut truncated = false;

    if stdout_bytes.len() > MAX_OUTPUT_BYTES {
        stdout_bytes.truncate(MAX_OUTPUT_BYTES);
        truncated = true;
    }
    if stderr_bytes.len() > MAX_OUTPUT_BYTES {
        stderr_bytes.truncate(MAX_OUTPUT_BYTES);
        truncated = true;
    }

    let duration_ms = start.elapsed().as_millis();
    let exit_code = output.status.code().unwrap_or(-1);
    let success = output.status.success();

    record_execution(
        &app,
        HistoryEntry {
            program: program.to_string(),
            args: args.clone(),
            exit_code,
            success,
            duration_ms,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as i64,
        },
    );

    Ok(ExecutionResult {
        stdout: String::from_utf8_lossy(&stdout_bytes).to_string(),
        stderr: String::from_utf8_lossy(&stderr_bytes).to_string(),
        exit_code,
        success,
        duration_ms,
        truncated,
    })
}
