import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

interface AppSettings {
  hotkey: string;
  confirmDangerous: boolean;
  commandTimeoutSecs: number;
}

interface SettingsPanelProps {
  onClose: () => void;
}

const MODIFIER_KEYS = new Set(["Control", "Alt", "Shift", "Meta"]);

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedCombo, setCapturedCombo] = useState<string | null>(null);
  const [hotkeyError, setHotkeyError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [shellHookStatus, setShellHookStatus] = useState<{ path: string; age_secs: number } | null | "checking">("checking");

  useEffect(() => {
    invoke<AppSettings>("get_settings").then(setSettings);
  }, []);

  const checkShellHook = useCallback(() => {
    setShellHookStatus("checking");
    invoke<{ path: string; age_secs: number } | null>("get_last_shell_dir")
      .then(setShellHookStatus)
      .catch(() => setShellHookStatus(null));
  }, []);

  useEffect(() => {
    checkShellHook();
  }, [checkShellHook]);

  const captureKey = useCallback((e: React.KeyboardEvent) => {
    e.preventDefault();
    if (MODIFIER_KEYS.has(e.key)) return;

    const parts: string[] = [];
    if (e.ctrlKey) parts.push("ctrl");
    if (e.altKey) parts.push("alt");
    if (e.shiftKey) parts.push("shift");
    if (e.metaKey) parts.push("super");

    if (parts.length === 0) {
      setHotkeyError("Include at least one modifier (Ctrl, Alt, Shift, or Super).");
      return;
    }

    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase();
    parts.push(key === " " ? "space" : key);

    setHotkeyError(null);
    setCapturedCombo(parts.join("+"));
    setIsCapturing(false);
  }, []);

  const applyHotkey = async () => {
    if (!capturedCombo || !settings) return;
    setIsSaving(true);
    setHotkeyError(null);
    try {
      await invoke("update_hotkey", { hotkey: capturedCombo });
      setSettings({ ...settings, hotkey: capturedCombo });
      setCapturedCombo(null);
    } catch (err) {
      setHotkeyError(String(err));
    } finally {
      setIsSaving(false);
    }
  };

  const toggleConfirmDangerous = async () => {
    if (!settings) return;
    const updated = { ...settings, confirmDangerous: !settings.confirmDangerous };
    setSettings(updated);
    await invoke("update_settings", { settings: updated });
  };

  const changeTimeout = async (value: number) => {
    if (!settings) return;
    const updated = { ...settings, commandTimeoutSecs: value };
    setSettings(updated);
    await invoke("update_settings", { settings: updated });
  };

  if (!settings) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">settings</h2>

        <div className="settings-section">
          <div className="settings-row">
            <div>
              <div className="settings-label">Global hotkey</div>
              <div className="settings-sublabel">Toggles the Warpbar window from anywhere</div>
            </div>
            {isCapturing ? (
              <input
                className="modal-input hotkey-capture-input"
                autoFocus
                readOnly
                value="press a key combination…"
                onKeyDown={captureKey}
                onBlur={() => setIsCapturing(false)}
              />
            ) : (
              <button
                type="button"
                className="hotkey-display"
                onClick={() => {
                  setIsCapturing(true);
                  setCapturedCombo(null);
                  setHotkeyError(null);
                }}
              >
                {capturedCombo ?? settings.hotkey}
              </button>
            )}
          </div>

          {hotkeyError && <div className="modal-error">{hotkeyError}</div>}

          {capturedCombo && (
            <div className="settings-row settings-row-tight">
              <span className="settings-sublabel">New: {capturedCombo}</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="modal-btn modal-btn-secondary"
                  onClick={() => setCapturedCombo(null)}
                >
                  cancel
                </button>
                <button
                  type="button"
                  className="modal-btn modal-btn-primary"
                  onClick={applyHotkey}
                  disabled={isSaving}
                >
                  {isSaving ? "applying…" : "apply"}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="settings-section">
          <div className="settings-row">
            <div>
              <div className="settings-label">Confirm destructive commands</div>
              <div className="settings-sublabel">
                Require a second confirmation for commands that look like they could delete
                data or restart the system
              </div>
            </div>
            <button
              type="button"
              className={`settings-toggle ${settings.confirmDangerous ? "on" : ""}`}
              onClick={toggleConfirmDangerous}
            >
              <span className="settings-toggle-dot" />
            </button>
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-row">
            <div>
              <div className="settings-label">Command timeout</div>
              <div className="settings-sublabel">
                Commands running longer than this are stopped automatically
              </div>
            </div>
            <select
              className="modal-input settings-select"
              value={settings.commandTimeoutSecs}
              onChange={(e) => changeTimeout(Number(e.target.value))}
            >
              <option value={10}>10 seconds</option>
              <option value={30}>30 seconds</option>
              <option value={60}>1 minute</option>
              <option value={300}>5 minutes</option>
            </select>
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-label">Shell integration</div>
          <div className="settings-sublabel" style={{ marginBottom: 10 }}>
            Lets commands run in "last shell directory" mode — wherever your terminal was
            last active, not a fixed path.
          </div>

          <div className="shell-hook-status">
            {shellHookStatus === "checking" && "checking…"}
            {shellHookStatus === null && "not detected — install the hook below"}
            {shellHookStatus && shellHookStatus !== "checking" && (
              <>
                connected — last updated {shellHookStatus.age_secs}s ago
                <span className="cwd-hint" style={{ display: "block", marginTop: 2 }}>
                  {shellHookStatus.path}
                </span>
              </>
            )}
          </div>

          <div className="settings-sublabel" style={{ marginTop: 10, marginBottom: 4 }}>
            bash — add to ~/.bashrc:
          </div>
          <textarea
            className="modal-input modal-textarea shell-hook-code"
            readOnly
            rows={3}
            onFocus={(e) => e.target.select()}
            value={`mkdir -p "$HOME/.cache/warpbar"\nwarpbar_track_dir() { pwd > "$HOME/.cache/warpbar/last_dir" 2>/dev/null; }\nPROMPT_COMMAND="warpbar_track_dir\${PROMPT_COMMAND:+;$PROMPT_COMMAND}"`}
          />

          <div className="settings-sublabel" style={{ marginTop: 10, marginBottom: 4 }}>
            zsh — add to ~/.zshrc:
          </div>
          <textarea
            className="modal-input modal-textarea shell-hook-code"
            readOnly
            rows={4}
            onFocus={(e) => e.target.select()}
            value={`mkdir -p "$HOME/.cache/warpbar"\nwarpbar_track_dir() { pwd > "$HOME/.cache/warpbar/last_dir" 2>/dev/null; }\nautoload -Uz add-zsh-hook\nadd-zsh-hook precmd warpbar_track_dir`}
          />

          <button
            type="button"
            className="modal-btn modal-btn-secondary"
            style={{ marginTop: 10 }}
            onClick={checkShellHook}
          >
            re-check status
          </button>
        </div>

        <div className="modal-actions">
          <button className="modal-btn modal-btn-primary" type="button" onClick={onClose}>
            done
          </button>
        </div>
      </div>
    </div>
  );
}
