const DANGEROUS_PATTERNS: RegExp[] = [
  /\brm\b.*(-rf|-fr|--recursive)/i,
  /\bmkfs\b/i,
  /\bdd\b.*\bof=/i,
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\bhalt\b/i,
  /:\(\)\s*\{\s*:\|\s*:\s*&\s*\}\s*;\s*:/,
  /\bchmod\b.*-R.*\b777\b/i,
  /\bchown\b.*-R/i,
  />\s*\/dev\/sd/i,
];

export function isDangerousCommand(program: string, args: string[]): boolean {
  const full = [program, ...args].join(" ");
  return DANGEROUS_PATTERNS.some((pattern) => pattern.test(full));
}

const INTERACTIVE_PROGRAMS = new Set([
  "sudo",
  "su",
  "ssh",
  "passwd",
  "visudo",
  "vim",
  "vi",
  "nano",
  "less",
  "more",
  "top",
  "htop",
]);

export function needsInteractiveTerminal(program: string, args: string[]): boolean {
  if (INTERACTIVE_PROGRAMS.has(program)) {
    if (program === "sudo" && args.includes("-S")) return false;
    return true;
  }
  return false;
}
