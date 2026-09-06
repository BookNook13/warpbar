import { CommandAction } from "../types/command";

/** Characters that only make sense when interpreted by a real shell —
 * their presence means naive whitespace-splitting will silently
 * produce a broken invocation (exactly the "apt update && apt
 * upgrade" bug: split apart, `&&` and the second `apt` become literal
 * arguments to the first `apt` command). */
const SHELL_OPERATOR_PATTERN = /[&|;<>]/;

/**
 * Builds a CommandAction from a raw command string typed into the
 * Add/Edit form. Simple commands (`df -h`) are split into
 * program + args directly, matching how the sandboxed executor spawns
 * processes without a shell. Commands containing shell operators are
 * instead wrapped as `bash -c "<raw>"`, so `&&`, `|`, `;` etc. are
 * interpreted correctly rather than passed through as literal args.
 */
export function parseCommandString(raw: string): CommandAction {
  const trimmed = raw.trim();

  if (SHELL_OPERATOR_PATTERN.test(trimmed)) {
    return { type: "shell", cmd: "bash", args: ["-c", trimmed] };
  }

  const parts = trimmed.split(/\s+/);
  const [cmd, ...args] = parts;
  return { type: "shell", cmd, args };
}

/** Reverses parseCommandString, for displaying an existing command
 * back in the edit form as the original human-typed string. */
export function commandActionToString(action: CommandAction): string {
  if (action.type !== "shell") return "";
  if (action.cmd === "bash" && action.args[0] === "-c" && action.args.length === 2) {
    return action.args[1];
  }
  return [action.cmd, ...action.args].join(" ");
}
