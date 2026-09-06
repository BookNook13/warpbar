import { useEffect, useState } from "react";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";

export function AutostartToggle() {
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    isEnabled().then(setEnabled).catch(() => setEnabled(false));
  }, []);

  const toggle = async () => {
    if (enabled === null) return;
    try {
      if (enabled) {
        await disable();
      } else {
        await enable();
      }
      setEnabled(!enabled);
    } catch {
      // Silently ignore — autostart is a nice-to-have, not critical path.
    }
  };

  if (enabled === null) return null;

  return (
    <button
      className="autostart-btn"
      onClick={toggle}
      type="button"
      title={enabled ? "Autostart on login: on" : "Autostart on login: off"}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v10" />
        <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
      </svg>
      <span className={`autostart-dot ${enabled ? "on" : ""}`} />
    </button>
  );
}
