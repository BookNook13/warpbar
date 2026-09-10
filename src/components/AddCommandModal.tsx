import { useState, FormEvent } from "react";
import { useCommandStore } from "../store/commandStore";
import { CommandAction, CwdMode, DevFlowCommand } from "../types/command";
import { parseCommandString, commandActionToString } from "../lib/parseCommand";

interface AddCommandModalProps {
  onClose: () => void;
  editingCommand?: DevFlowCommand;
}

type ActionKind = "shell" | "workflow" | "open";

function actionKindOf(action?: CommandAction): ActionKind {
  return action?.type ?? "shell";
}

export function AddCommandModal({ onClose, editingCommand }: AddCommandModalProps) {
  const add = useCommandStore((s) => s.add);
  const update = useCommandStore((s) => s.update);
  const isEditing = !!editingCommand;

  const [actionKind, setActionKind] = useState<ActionKind>(
    actionKindOf(editingCommand?.action)
  );

  const initialCommandString =
    editingCommand?.action.type === "shell" ? commandActionToString(editingCommand.action) : "";
  const initialSteps =
    editingCommand?.action.type === "workflow" ? editingCommand.action.steps.join("\n") : "";
  const initialPath =
    editingCommand?.action.type === "open" ? editingCommand.action.path : "";

  const [title, setTitle] = useState(editingCommand?.title ?? "");
  const [subtitle, setSubtitle] = useState(editingCommand?.subtitle ?? "");
  const [commandString, setCommandString] = useState(initialCommandString);
  const [stepsText, setStepsText] = useState(initialSteps);
  const [pathValue, setPathValue] = useState(initialPath);
  const [keywordsInput, setKeywordsInput] = useState(
    editingCommand?.keywords.join(", ") ?? ""
  );
  const [cwdMode, setCwdMode] = useState<CwdMode | "none">(editingCommand?.cwdMode ?? "none");
  const [cwdPath, setCwdPath] = useState(editingCommand?.cwdPath ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Title is required.");
      return;
    }

    let action: CommandAction;

    if (actionKind === "shell") {
      const trimmedCommand = commandString.trim();
      if (!trimmedCommand) {
        setError("Command is required.");
        return;
      }
      action = parseCommandString(trimmedCommand);
    } else if (actionKind === "workflow") {
      const steps = stepsText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      if (steps.length === 0) {
        setError("Add at least one step.");
        return;
      }
      action = { type: "workflow", steps };
    } else {
      const trimmedPath = pathValue.trim();
      if (!trimmedPath) {
        setError("A path or URL is required.");
        return;
      }
      action = { type: "open", path: trimmedPath };
    }

    if (actionKind === "shell" && cwdMode === "fixed" && !cwdPath.trim()) {
      setError("Enter a directory path, or choose a different working-directory option.");
      return;
    }

    const keywords = keywordsInput
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

    const cwdFields =
      actionKind === "shell" && cwdMode !== "none"
        ? { cwdMode: cwdMode as CwdMode, cwdPath: cwdMode === "fixed" ? cwdPath.trim() : undefined }
        : { cwdMode: undefined, cwdPath: undefined };

    setIsSaving(true);
    try {
      if (isEditing && editingCommand) {
        await update({
          ...editingCommand,
          title: trimmedTitle,
          subtitle: subtitle.trim() || undefined,
          keywords,
          action,
          ...cwdFields,
        });
      } else {
        await add({
          title: trimmedTitle,
          subtitle: subtitle.trim() || undefined,
          keywords,
          action,
          isCustom: true,
          ...cwdFields,
        });
      }
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">{isEditing ? "edit command" : "add command"}</h2>

        <div className="action-kind-tabs">
          <button
            type="button"
            className={actionKind === "shell" ? "action-kind-tab active" : "action-kind-tab"}
            onClick={() => setActionKind("shell")}
          >
            shell
          </button>
          <button
            type="button"
            className={actionKind === "workflow" ? "action-kind-tab active" : "action-kind-tab"}
            onClick={() => setActionKind("workflow")}
          >
            workflow
          </button>
          <button
            type="button"
            className={actionKind === "open" ? "action-kind-tab active" : "action-kind-tab"}
            onClick={() => setActionKind("open")}
          >
            open
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <label className="modal-label">
            title
            <input
              className="modal-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Restart Docker"
              autoFocus
            />
          </label>

          {actionKind === "shell" && (
            <label className="modal-label">
              command
              <input
                className="modal-input"
                value={commandString}
                onChange={(e) => setCommandString(e.target.value)}
                placeholder="e.g. apt update && apt upgrade -y"
              />
            </label>
          )}

          {actionKind === "workflow" && (
            <label className="modal-label">
              steps (one command per line, run in order)
              <textarea
                className="modal-input modal-textarea"
                value={stepsText}
                onChange={(e) => setStepsText(e.target.value)}
                placeholder={"npm run lint\nnpm run build\nnpm run deploy"}
                rows={4}
              />
            </label>
          )}

          {actionKind === "open" && (
            <label className="modal-label">
              path or URL
              <input
                className="modal-input"
                value={pathValue}
                onChange={(e) => setPathValue(e.target.value)}
                placeholder="e.g. https://github.com or /home/you/notes.md"
              />
            </label>
          )}

          {actionKind === "shell" && (
            <div className="modal-label">
              working directory
              <div className="cwd-mode-tabs">
                <button
                  type="button"
                  className={cwdMode === "none" ? "cwd-mode-tab active" : "cwd-mode-tab"}
                  onClick={() => setCwdMode("none")}
                >
                  default
                </button>
                <button
                  type="button"
                  className={cwdMode === "fixed" ? "cwd-mode-tab active" : "cwd-mode-tab"}
                  onClick={() => setCwdMode("fixed")}
                >
                  fixed path
                </button>
                <button
                  type="button"
                  className={cwdMode === "lastShell" ? "cwd-mode-tab active" : "cwd-mode-tab"}
                  onClick={() => setCwdMode("lastShell")}
                >
                  last shell dir
                </button>
              </div>
              {cwdMode === "fixed" && (
                <input
                  className="modal-input"
                  style={{ marginTop: 8 }}
                  value={cwdPath}
                  onChange={(e) => setCwdPath(e.target.value)}
                  placeholder="/home/you/projects/my-app"
                />
              )}
              {cwdMode === "lastShell" && (
                <div className="cwd-hint">
                  Runs in whatever directory your terminal was last in — requires the shell
                  integration hook (Settings → Shell Integration).
                </div>
              )}
            </div>
          )}

          <label className="modal-label">
            subtitle (optional)
            <input
              className="modal-input"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="shown under the title in the list"
            />
          </label>

          <label className="modal-label">
            keywords (comma-separated, optional)
            <input
              className="modal-input"
              value={keywordsInput}
              onChange={(e) => setKeywordsInput(e.target.value)}
              placeholder="docker, restart, service"
            />
          </label>

          {error && <div className="modal-error">{error}</div>}

          <div className="modal-actions">
            <button
              type="button"
              className="modal-btn modal-btn-secondary"
              onClick={onClose}
              disabled={isSaving}
            >
              cancel
            </button>
            <button type="submit" className="modal-btn modal-btn-primary" disabled={isSaving}>
              {isSaving ? "saving…" : isEditing ? "save changes" : "save command"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
