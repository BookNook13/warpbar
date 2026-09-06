use std::process::Stdio;
use tokio::process::Command as AsyncCommand;

fn candidates(shell_cmd: &str) -> Vec<(&'static str, Vec<String>)> {
    let keep_open = format!(
        "{shell_cmd}; echo; echo '--- press enter to close ---'; read _"
    );

    vec![
        ("gnome-terminal", vec!["--".into(), "bash".into(), "-c".into(), keep_open.clone()]),
        ("konsole", vec!["-e".into(), "bash".into(), "-c".into(), keep_open.clone()]),
        ("xfce4-terminal", vec!["--command".into(), format!("bash -c '{}'", keep_open.replace('\'', "'\\''"))]),
        ("x-terminal-emulator", vec!["-e".into(), "bash".into(), "-c".into(), keep_open.clone()]),
        ("xterm", vec!["-e".into(), "bash".into(), "-c".into(), keep_open]),
    ]
}

fn shell_quote(s: &str) -> String {
    format!("'{}'", s.replace('\'', "'\\''"))
}

async fn binary_exists(name: &str) -> bool {
    AsyncCommand::new("which")
        .arg(name)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .await
        .map(|s| s.success())
        .unwrap_or(false)
}

#[tauri::command]
pub async fn execute_in_terminal(
    program: String,
    args: Vec<String>,
    cwd: Option<String>,
) -> Result<String, String> {
    let full_cmd = std::iter::once(shell_quote(&program))
        .chain(args.iter().map(|a| shell_quote(a)))
        .collect::<Vec<_>>()
        .join(" ");

    for (terminal_bin, term_args) in candidates(&full_cmd) {
        if !binary_exists(terminal_bin).await {
            continue;
        }

        let mut command = AsyncCommand::new(terminal_bin);
        command.args(&term_args);
        if let Some(dir) = &cwd {
            command.current_dir(dir);
        }

        match command.spawn() {
            Ok(_) => return Ok(terminal_bin.to_string()),
            Err(_) => continue,
        }
    }

    Err("No terminal emulator found (tried gnome-terminal, konsole, xfce4-terminal, x-terminal-emulator, xterm). Install one of these, or run this command manually.".to_string())
}
