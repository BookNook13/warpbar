import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface TrustManagerProps {
  onClose: () => void;
}

export function TrustManager({ onClose }: TrustManagerProps) {
  const [programs, setPrograms] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [revokingProgram, setRevokingProgram] = useState<string | null>(null);

  useEffect(() => {
    invoke<string[]>("get_trusted_programs")
      .then(setPrograms)
      .finally(() => setIsLoading(false));
  }, []);

  const handleRevoke = async (program: string) => {
    if (revokingProgram !== program) {
      setRevokingProgram(program);
      return;
    }
    await invoke("revoke_program", { program });
    setPrograms((prev) => prev.filter((p) => p !== program));
    setRevokingProgram(null);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">trusted programs</h2>

        {isLoading ? (
          <div className="trust-empty">loading…</div>
        ) : programs.length === 0 ? (
          <div className="trust-empty">
            no programs trusted yet — you'll be asked to trust each new program the first time
            you run it
          </div>
        ) : (
          <ul className="trust-list">
            {programs.map((program) => (
              <li key={program} className="trust-item">
                <span className="trust-program-name">{program}</span>
                <button
                  className={
                    revokingProgram === program
                      ? "modal-btn modal-btn-secondary trust-revoke confirming"
                      : "modal-btn modal-btn-secondary trust-revoke"
                  }
                  type="button"
                  onClick={() => handleRevoke(program)}
                >
                  {revokingProgram === program ? "confirm revoke" : "revoke"}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="modal-actions">
          <button className="modal-btn modal-btn-primary" type="button" onClick={onClose}>
            done
          </button>
        </div>
      </div>
    </div>
  );
}
