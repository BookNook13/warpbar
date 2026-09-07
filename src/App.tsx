import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openPath, openUrl } from "@tauri-apps/plugin-opener";
import { useCommandStore } from "./store/commandStore";
import { CommandAction, DevFlowCommand } from "./types/command";
import { AddCommandModal } from "./components/AddCommandModal";
import { AutostartToggle } from "./components/AutostartToggle";
import { TrustManager } from "./components/TrustManager";
import { isDangerousCommand, needsInteractiveTerminal } from "./lib/dangerCheck";
import { parseCommandString } from "./lib/parseCommand";
import "./App.css";

interface ExecutionResult {
  stdout: string;
  stderr: string;
  exit_code: number;
  success: boolean;
  duration_ms: number;
  truncated: boolean;
}

interface WorkflowStepResult {
  step: string;
  success: boolean;
  exit_code: number;
}

type RunState =
  | { status: "idle" }
  | { status: "confirm-trust"; cmd: DevFlowCommand; program: string }
  | { status: "confirm-danger"; cmd: DevFlowCommand }
  | { status: "confirm-workflow-trust"; cmd: DevFlowCommand; programs: string[] }
  | { status: "running" }
  | { status: "opened-terminal"; terminalName: string }
  | { status: "opened-path"; path: string }
  | { status: "workflow-done"; results: WorkflowStepResult[]; stoppedEarly: boolean }
  | { status: "done"; result: ExecutionResult }
  | { status: "error"; message: string };

const isUrl = (value: string) => /^https?:\/\//i.test(value.trim());

function ActionIcon({ action }: { action: CommandAction }) {
  if (action.type === "workflow") {
    return (
      <svg className="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 6h13M8 12h13M8 18h13" />
        <path d="M3 6h.01M3 12h.01M3 18h.01" />
      </svg>
    );
  }
  if (action.type === "open") {
    return (
      <svg className="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <path d="M15 3h6v6" />
        <path d="M10 14 21 3" />
      </svg>
    );
  }
  return (
    <svg className="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m4 17 6-6-6-6" />
      <path d="M12 19h8" />
    </svg>
  );
}

export default function App() {
  const { load, setQuery, filtered, isLoading, remove, recordUsage } = useCommandStore();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [runState, setRunState] = useState<RunState>({ status: "idle" });
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isTrustManagerOpen, setIsTrustManagerOpen] = useState(false);
  const [editingCommand, setEditingCommand] = useState<DevFlowCommand | undefined>();
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const results = filtered();

  useEffect(() => {
    load();
    inputRef.current?.focus();
  }, [load]);

  useEffect(() => {
    setSelectedIndex((prev) => Math.min(prev, Math.max(results.length - 1, 0)));
  }, [results.length]);

  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const runSingleShell = useCallback(async (program: string, args: string[]) => {
    if (needsInteractiveTerminal(program, args)) {
      const terminalName = await invoke<string>("execute_in_terminal", { program, args });
      return { terminal: terminalName as string | null, result: null as ExecutionResult | null };
    }
    const result = await invoke<ExecutionResult>("execute_shell_command", { program, args });
    return { terminal: null, result };
  }, []);

  const executeShellNow = useCallback(
    async (cmd: DevFlowCommand) => {
      if (cmd.action.type !== "shell") return;
      setRunState({ status: "running" });
      try {
        const { terminal, result } = await runSingleShell(cmd.action.cmd, cmd.action.args);
        if (terminal) {
          setRunState({ status: "opened-terminal", terminalName: terminal });
        } else if (result) {
          setRunState({ status: "done", result });
        }
        recordUsage(cmd.id);
      } catch (err) {
        setRunState({ status: "error", message: String(err) });
      }
    },
    [runSingleShell, recordUsage]
  );

  const executeWorkflowNow = useCallback(
    async (cmd: DevFlowCommand) => {
      if (cmd.action.type !== "workflow") return;
      const steps = cmd.action.steps;
      const parsedSteps = steps.map((s) => parseCommandString(s));

      const anyInteractive = parsedSteps.some(
        (a) => a.type === "shell" && needsInteractiveTerminal(a.cmd, a.args)
      );

      setRunState({ status: "running" });
      try {
        if (anyInteractive) {
          const joined = steps.join(" && ");
          const terminalName = await invoke<string>("execute_in_terminal", {
            program: "bash",
            args: ["-c", joined],
          });
          setRunState({ status: "opened-terminal", terminalName });
          recordUsage(cmd.id);
          return;
        }

        const stepResults: WorkflowStepResult[] = [];
        let stoppedEarly = false;

        for (let i = 0; i < parsedSteps.length; i++) {
          const action = parsedSteps[i];
          if (action.type !== "shell") continue;
          const result = await invoke<ExecutionResult>("execute_shell_command", {
            program: action.cmd,
            args: action.args,
          });
          stepResults.push({ step: steps[i], success: result.success, exit_code: result.exit_code });
          if (!result.success) {
            stoppedEarly = i < parsedSteps.length - 1;
            break;
          }
        }

        setRunState({ status: "workflow-done", results: stepResults, stoppedEarly });
        recordUsage(cmd.id);
      } catch (err) {
        setRunState({ status: "error", message: String(err) });
      }
    },
    [recordUsage]
  );

  const executeOpenNow = useCallback(
    async (cmd: DevFlowCommand) => {
      if (cmd.action.type !== "open") return;
      setRunState({ status: "running" });
      try {
        if (isUrl(cmd.action.path)) {
          await openUrl(cmd.action.path);
        } else {
          await openPath(cmd.action.path);
        }
        setRunState({ status: "opened-path", path: cmd.action.path });
        recordUsage(cmd.id);
      } catch (err) {
        setRunState({ status: "error", message: String(err) });
      }
    },
    [recordUsage]
  );

  const proceedPastTrust = useCallback(
    (cmd: DevFlowCommand) => {
      if (cmd.action.type === "shell") {
        if (isDangerousCommand(cmd.action.cmd, cmd.action.args)) {
          setRunState({ status: "confirm-danger", cmd });
          return;
        }
        executeShellNow(cmd);
      } else if (cmd.action.type === "workflow") {
        const anyDangerous = cmd.action.steps.some((step) => {
          const a = parseCommandString(step);
          return a.type === "shell" && isDangerousCommand(a.cmd, a.args);
        });
        if (anyDangerous) {
          setRunState({ status: "confirm-danger", cmd });
          return;
        }
        executeWorkflowNow(cmd);
      } else {
        executeOpenNow(cmd);
      }
    },
    [executeShellNow, executeWorkflowNow, executeOpenNow]
  );

  const runCommand = useCallback(
    async (cmd: DevFlowCommand) => {
      if (cmd.action.type === "open") {
        proceedPastTrust(cmd);
        return;
      }

      if (cmd.action.type === "shell") {
        const program = cmd.action.cmd;
        try {
          const trusted = await invoke<boolean>("is_program_trusted", { program });
          if (!trusted) {
            setRunState({ status: "confirm-trust", cmd, program });
            return;
          }
        } catch {
          setRunState({ status: "confirm-trust", cmd, program });
          return;
        }
        proceedPastTrust(cmd);
        return;
      }

      const parsedSteps = cmd.action.steps.map((s) => parseCommandString(s));
      const programs = Array.from(
        new Set(
          parsedSteps
            .filter((a): a is Extract<CommandAction, { type: "shell" }> => a.type === "shell")
            .map((a) => a.cmd)
        )
      );

      const trustChecks = await Promise.all(
        programs.map(async (p) => {
          try {
            return await invoke<boolean>("is_program_trusted", { program: p });
          } catch {
            return false;
          }
        })
      );
      const untrusted = programs.filter((_, i) => !trustChecks[i]);

      if (untrusted.length > 0) {
        setRunState({ status: "confirm-workflow-trust", cmd, programs: untrusted });
        return;
      }

      proceedPastTrust(cmd);
    },
    [proceedPastTrust]
  );

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (isAddModalOpen || isTrustManagerOpen) return;

      if (e.key === "n" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setEditingCommand(undefined);
        setIsAddModalOpen(true);
        return;
      }

      if (runState.status === "confirm-trust") {
        if (e.key === "Enter") {
          e.preventDefault();
          invoke("trust_program", { program: runState.program })
            .then(() => proceedPastTrust(runState.cmd))
            .catch((err) => setRunState({ status: "error", message: String(err) }));
        } else if (e.key === "Escape") {
          e.preventDefault();
          setRunState({ status: "idle" });
        }
        return;
      }

      if (runState.status === "confirm-workflow-trust") {
        if (e.key === "Enter") {
          e.preventDefault();
          Promise.all(runState.programs.map((p) => invoke("trust_program", { program: p })))
            .then(() => proceedPastTrust(runState.cmd))
            .catch((err) => setRunState({ status: "error", message: String(err) }));
        } else if (e.key === "Escape") {
          e.preventDefault();
          setRunState({ status: "idle" });
        }
        return;
      }

      if (runState.status === "confirm-danger") {
        if (e.key === "Enter") {
          e.preventDefault();
          if (runState.cmd.action.type === "workflow") {
            executeWorkflowNow(runState.cmd);
          } else {
            executeShellNow(runState.cmd);
          }
        } else if (e.key === "Escape") {
          e.preventDefault();
          setRunState({ status: "idle" });
        }
        return;
      }

      const isPrintable = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
      if (isPrintable && document.activeElement !== inputRef.current) {
        inputRef.current?.focus();
      }

      if (results.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter": {
          e.preventDefault();
          const cmd = results[selectedIndex];
          if (cmd) runCommand(cmd);
          break;
        }
        case "Escape":
          setRunState({ status: "idle" });
          break;
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [
    results,
    selectedIndex,
    runCommand,
    runState,
    executeShellNow,
    executeWorkflowNow,
    proceedPastTrust,
    isAddModalOpen,
    isTrustManagerOpen,
  ]);

  const statusLabel = useMemo(() => {
    if (isLoading) return "loading";
    if (results.length === 0) return "no matches";
    return `${results.length} command${results.length === 1 ? "" : "s"}`;
  }, [isLoading, results.length]);

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirmingDeleteId === id) {
      remove(id);
      setConfirmingDeleteId(null);
    } else {
      setConfirmingDeleteId(id);
    }
  };

  const handleEditClick = (e: React.MouseEvent, cmd: DevFlowCommand) => {
    e.stopPropagation();
    setEditingCommand(cmd);
    setIsAddModalOpen(true);
  };

  return (
    <div className="palette-root">
      <div className="brand">
        <span className="brand-mark" />
        <span className="brand-name">devflow</span>
      </div>

      <div className="palette-frame">
        <div className="palette-shell">
          <div className="palette-header">
            <input
              ref={inputRef}
              className="palette-input"
              placeholder="> type a command"
              autoFocus
              onChange={(e) => setQuery(e.target.value)}
            />
            <span className="shortcut-hint">
              <kbd>ctrl</kbd>
              <kbd>n</kbd>
            </span>
            <button
              className="add-command-btn"
              onClick={() => setIsTrustManagerOpen(true)}
              title="Manage trusted programs"
              type="button"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
              </svg>
            </button>
            <AutostartToggle />
            <button
              className="add-command-btn"
              onClick={() => {
                setEditingCommand(undefined);
                setIsAddModalOpen(true);
              }}
              title="Add command"
              type="button"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>

          <div className="palette-status">
            <span className={`status-dot ${isLoading ? "" : "active"}`} />
            {statusLabel}
          </div>

          {results.length === 0 && !isLoading ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="empty-icon">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <div className="empty-title">no commands match your search</div>
              <div className="empty-hint">
                press <kbd>ctrl</kbd>+<kbd>n</kbd> to add a new one
              </div>
            </div>
          ) : (
            <div className="palette-list-wrap">
              <ul className="palette-list" ref={listRef}>
                {results.map((cmd, i) => (
                  <li
                    key={cmd.id}
                    className={i === selectedIndex ? "palette-item selected" : "palette-item"}
                    onMouseEnter={() => setSelectedIndex(i)}
                    onMouseLeave={() =>
                      setConfirmingDeleteId((prev) => (prev === cmd.id ? null : prev))
                    }
                    onClick={() => runCommand(cmd)}
                  >
                    <span className="item-title-wrap">
                      <ActionIcon action={cmd.action} />
                      <span className="item-title">{cmd.title}</span>
                    </span>

                    <span className="item-right">
                      {cmd.isCustom && (
                        <span className="item-actions">
                          <button
                            className="item-action-btn"
                            type="button"
                            title="Edit"
                            onClick={(e) => handleEditClick(e, cmd)}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                            </svg>
                          </button>
                          <button
                            className={
                              confirmingDeleteId === cmd.id
                                ? "item-action-btn item-action-danger confirming"
                                : "item-action-btn item-action-danger"
                            }
                            type="button"
                            title={confirmingDeleteId === cmd.id ? "Click again to confirm" : "Delete"}
                            onClick={(e) => handleDeleteClick(e, cmd.id)}
                          >
                            {confirmingDeleteId === cmd.id ? (
                              "sure?"
                            ) : (
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 6h18" />
                                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                              </svg>
                            )}
                          </button>
                        </span>
                      )}
                      {cmd.subtitle && <span className="item-subtitle">{cmd.subtitle}</span>}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="list-fade-top" />
              <div className="list-fade-bottom" />
            </div>
          )}

          <OutputPanel state={runState} />

          <div className="key-hints">
            <span className="key-hint">
              <kbd>↑</kbd>
              <kbd>↓</kbd> navigate
            </span>
            <span className="key-hint">
              <kbd>enter</kbd> run
            </span>
            <span className="key-hint">
              <kbd>esc</kbd> dismiss
            </span>
            <span className="key-hint">
              <kbd>ctrl</kbd>
              <kbd>alt</kbd>
              <kbd>space</kbd> toggle window
            </span>
          </div>
        </div>
      </div>

      {isAddModalOpen && (
        <AddCommandModal
          onClose={() => {
            setIsAddModalOpen(false);
            setEditingCommand(undefined);
          }}
          editingCommand={editingCommand}
        />
      )}

      {isTrustManagerOpen && <TrustManager onClose={() => setIsTrustManagerOpen(false)} />}
    </div>
  );
}

function OutputPanel({ state }: { state: RunState }) {
  if (state.status === "idle") return null;

  if (state.status === "confirm-trust") {
    return (
      <div className="output-panel output-trust">
        <div className="danger-title">first time running "{state.program}"</div>
        <div className="danger-body">
          Warpbar hasn't run this program before. Press <kbd>enter</kbd> to trust it and run —
          you won't be asked again for this program — or <kbd>esc</kbd> to cancel.
        </div>
      </div>
    );
  }

  if (state.status === "confirm-workflow-trust") {
    return (
      <div className="output-panel output-trust">
        <div className="danger-title">first time running: {state.programs.join(", ")}</div>
        <div className="danger-body">
          This workflow uses program(s) Warpbar hasn't run before. Press <kbd>enter</kbd> to
          trust all of them and run the workflow, or <kbd>esc</kbd> to cancel.
        </div>
      </div>
    );
  }

  if (state.status === "confirm-danger") {
    return (
      <div className="output-panel output-danger">
        <div className="danger-title">⚠ potentially destructive command</div>
        <div className="danger-body">
          "{state.cmd.title}" looks like it could delete data, wipe a disk, or restart the
          system. Press <kbd>enter</kbd> again to run it anyway, or <kbd>esc</kbd> to cancel.
        </div>
      </div>
    );
  }

  if (state.status === "opened-terminal") {
    return (
      <div className="output-panel output-terminal">
        <div className="danger-title">opened in {state.terminalName}</div>
        <div className="danger-body">
          This needs an interactive terminal (a password prompt, editor, etc.) — check the new
          window that just opened.
        </div>
      </div>
    );
  }

  if (state.status === "opened-path") {
    return (
      <div className="output-panel output-terminal">
        <div className="danger-title">opened {state.path}</div>
        <div className="danger-body">Launched with the system's default application.</div>
      </div>
    );
  }

  if (state.status === "workflow-done") {
    return (
      <div className={`output-panel ${state.stoppedEarly ? "output-fail" : "output-success"}`}>
        <div className="output-meta">
          <span>{state.results.length} step{state.results.length === 1 ? "" : "s"} ran</span>
          {state.stoppedEarly && <span>stopped early</span>}
        </div>
        {state.results.map((r, i) => (
          <div
            key={i}
            className={r.success ? "workflow-step ok" : "workflow-step fail"}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <span className="workflow-step-num">{i + 1}</span>
            <span className="workflow-step-icon">{r.success ? "✓" : "✗"}</span>
            <span className="workflow-step-text">{r.step}</span>
          </div>
        ))}
      </div>
    );
  }

  if (state.status === "running") {
    return <div className="output-panel output-running">running</div>;
  }

  if (state.status === "error") {
    return <div className="output-panel output-error">{state.message}</div>;
  }

  const { result } = state;
  return (
    <div className={`output-panel ${result.success ? "output-success" : "output-fail"}`}>
      <div className="output-meta">
        <span>exit {result.exit_code}</span>
        <span>{result.duration_ms}ms</span>
        {result.truncated && <span>output truncated</span>}
      </div>
      {result.stdout && <pre className="output-stdout">{result.stdout}</pre>}
      {result.stderr && <pre className="output-stderr">{result.stderr}</pre>}
    </div>
  );
}
