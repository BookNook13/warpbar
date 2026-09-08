use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, State};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};
use tauri_plugin_store::StoreExt;

const SETTINGS_STORE: &str = "settings.json";
const SETTINGS_KEY: &str = "settings";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub hotkey: String,
    pub confirm_dangerous: bool,
    pub command_timeout_secs: u64,
}

impl Default for AppSettings {
    fn default() -> Self {
        AppSettings {
            hotkey: "ctrl+alt+space".to_string(),
            confirm_dangerous: true,
            command_timeout_secs: 30,
        }
    }
}

/// Tracks the currently-registered shortcut so the handler closure
/// (registered once at startup) can check incoming key events against
/// whatever the user has live-rebound it to, without needing to
/// re-register the closure itself.
pub struct ActiveHotkey(pub Mutex<Shortcut>);

pub fn parse_hotkey(spec: &str) -> Result<Shortcut, String> {
    let parts: Vec<String> = spec.split('+').map(|p| p.trim().to_lowercase()).collect();
    if parts.is_empty() {
        return Err("Empty hotkey".to_string());
    }

    let (modifier_parts, key_part) = parts.split_at(parts.len() - 1);
    let key_str = key_part[0].as_str();

    let mut modifiers = Modifiers::empty();
    for m in modifier_parts {
        match m.as_str() {
            "ctrl" | "control" => modifiers |= Modifiers::CONTROL,
            "alt" => modifiers |= Modifiers::ALT,
            "shift" => modifiers |= Modifiers::SHIFT,
            "super" | "meta" | "cmd" => modifiers |= Modifiers::SUPER,
            other => return Err(format!("Unknown modifier: {other}")),
        }
    }

    let code = match key_str {
        "space" => Code::Space,
        "enter" | "return" => Code::Enter,
        "tab" => Code::Tab,
        "escape" | "esc" => Code::Escape,
        k if k.len() == 1 && k.chars().next().unwrap().is_ascii_alphabetic() => {
            let c = k.chars().next().unwrap().to_ascii_uppercase();
            match c {
                'A' => Code::KeyA, 'B' => Code::KeyB, 'C' => Code::KeyC, 'D' => Code::KeyD,
                'E' => Code::KeyE, 'F' => Code::KeyF, 'G' => Code::KeyG, 'H' => Code::KeyH,
                'I' => Code::KeyI, 'J' => Code::KeyJ, 'K' => Code::KeyK, 'L' => Code::KeyL,
                'M' => Code::KeyM, 'N' => Code::KeyN, 'O' => Code::KeyO, 'P' => Code::KeyP,
                'Q' => Code::KeyQ, 'R' => Code::KeyR, 'S' => Code::KeyS, 'T' => Code::KeyT,
                'U' => Code::KeyU, 'V' => Code::KeyV, 'W' => Code::KeyW, 'X' => Code::KeyX,
                'Y' => Code::KeyY, 'Z' => Code::KeyZ,
                _ => return Err(format!("Unsupported key: {k}")),
            }
        }
        k if k.len() == 1 && k.chars().next().unwrap().is_ascii_digit() => match k {
            "0" => Code::Digit0, "1" => Code::Digit1, "2" => Code::Digit2, "3" => Code::Digit3,
            "4" => Code::Digit4, "5" => Code::Digit5, "6" => Code::Digit6, "7" => Code::Digit7,
            "8" => Code::Digit8, "9" => Code::Digit9,
            _ => unreachable!(),
        },
        other => return Err(format!("Unsupported key: {other}")),
    };

    if modifiers.is_empty() {
        return Err("At least one modifier (Ctrl/Alt/Shift/Super) is required".to_string());
    }

    Ok(Shortcut::new(Some(modifiers), code))
}

#[tauri::command]
pub fn get_settings(app: AppHandle) -> Result<AppSettings, String> {
    let store = app.store(SETTINGS_STORE).map_err(|e| e.to_string())?;
    let settings = store
        .get(SETTINGS_KEY)
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();
    Ok(settings)
}

#[tauri::command]
pub fn update_settings(app: AppHandle, settings: AppSettings) -> Result<(), String> {
    let store = app.store(SETTINGS_STORE).map_err(|e| e.to_string())?;
    store.set(SETTINGS_KEY.to_string(), serde_json::to_value(&settings).unwrap());
    store.save().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_hotkey(
    app: AppHandle,
    active: State<ActiveHotkey>,
    hotkey: String,
) -> Result<(), String> {
    let new_shortcut = parse_hotkey(&hotkey)?;

    let mut current = active.0.lock().map_err(|e| e.to_string())?;

    app.global_shortcut()
        .unregister(*current)
        .map_err(|e| e.to_string())?;

    app.global_shortcut()
        .register(new_shortcut)
        .map_err(|e| format!("Could not register '{hotkey}' — it may already be in use by your desktop environment: {e}"))?;

    *current = new_shortcut;

    let store = app.store(SETTINGS_STORE).map_err(|e| e.to_string())?;
    let mut settings: AppSettings = store
        .get(SETTINGS_KEY)
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();
    settings.hotkey = hotkey;
    store.set(SETTINGS_KEY.to_string(), serde_json::to_value(&settings).unwrap());
    store.save().map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_a_simple_ctrl_alt_space_combo() {
        let result = parse_hotkey("ctrl+alt+space");
        assert!(result.is_ok());
    }

    #[test]
    fn parses_a_single_letter_key_with_one_modifier() {
        let result = parse_hotkey("ctrl+k");
        assert!(result.is_ok());
    }

    #[test]
    fn parses_a_digit_key() {
        let result = parse_hotkey("ctrl+alt+5");
        assert!(result.is_ok());
    }

    #[test]
    fn is_case_insensitive_and_trims_whitespace() {
        // Mirrors how the frontend sends captured combos — user input
        // could plausibly have mixed case or stray spaces around '+'.
        let lower = parse_hotkey("ctrl+alt+space");
        let upper = parse_hotkey("CTRL + ALT + SPACE");
        assert!(lower.is_ok());
        assert!(upper.is_ok());
    }

    #[test]
    fn accepts_super_and_its_aliases() {
        assert!(parse_hotkey("super+space").is_ok());
        assert!(parse_hotkey("meta+space").is_ok());
        assert!(parse_hotkey("cmd+space").is_ok());
    }

    #[test]
    fn rejects_a_hotkey_with_no_modifier() {
        // A bare key with no Ctrl/Alt/Shift/Super would either
        // conflict with normal typing or fail to register as a true
        // global shortcut — this must always be rejected.
        let result = parse_hotkey("space");
        assert!(result.is_err());
    }

    #[test]
    fn rejects_an_unknown_modifier() {
        let result = parse_hotkey("hyper+space");
        assert!(result.is_err());
    }

    #[test]
    fn rejects_an_unsupported_key() {
        let result = parse_hotkey("ctrl+alt+f13");
        assert!(result.is_err());
    }

    #[test]
    fn rejects_an_empty_string() {
        let result = parse_hotkey("");
        assert!(result.is_err());
    }

    #[test]
    fn accepts_multiple_modifiers_stacked() {
        let result = parse_hotkey("ctrl+alt+shift+k");
        assert!(result.is_ok());
    }

    #[test]
    fn accepts_enter_tab_and_escape_as_named_keys() {
        assert!(parse_hotkey("ctrl+enter").is_ok());
        assert!(parse_hotkey("ctrl+tab").is_ok());
        assert!(parse_hotkey("ctrl+escape").is_ok());
        assert!(parse_hotkey("ctrl+esc").is_ok());
    }

    #[test]
    fn default_settings_have_sane_values() {
        let defaults = AppSettings::default();
        assert_eq!(defaults.hotkey, "ctrl+alt+space");
        assert!(defaults.confirm_dangerous);
        assert_eq!(defaults.command_timeout_secs, 30);
    }
}
