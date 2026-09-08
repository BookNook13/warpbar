import { describe, it, expect } from "vitest";
import { isDangerousCommand, needsInteractiveTerminal } from "./dangerCheck";

describe("isDangerousCommand", () => {
  it("flags rm -rf as dangerous", () => {
    expect(isDangerousCommand("rm", ["-rf", "/tmp/test"])).toBe(true);
  });

  it("flags shutdown as dangerous", () => {
    expect(isDangerousCommand("sudo", ["shutdown", "now"])).toBe(true);
  });

  it("flags a fork bomb pattern", () => {
    expect(isDangerousCommand("bash", ["-c", ":(){ :|:& };:"])).toBe(true);
  });

  it("flags chmod -R 777 as dangerous", () => {
    expect(isDangerousCommand("chmod", ["-R", "777", "/"])).toBe(true);
  });

  it("does not flag an ordinary rm without -rf", () => {
    expect(isDangerousCommand("rm", ["file.txt"])).toBe(false);
  });

  it("does not flag harmless commands", () => {
    expect(isDangerousCommand("ls", ["-la"])).toBe(false);
    expect(isDangerousCommand("echo", ["hello"])).toBe(false);
    expect(isDangerousCommand("git", ["status"])).toBe(false);
  });
});

describe("needsInteractiveTerminal", () => {
  it("flags sudo as needing an interactive terminal", () => {
    expect(needsInteractiveTerminal("sudo", ["apt", "update"])).toBe(true);
  });

  it("does not flag sudo -S, since that reads the password from stdin", () => {
    expect(needsInteractiveTerminal("sudo", ["-S", "apt", "update"])).toBe(false);
  });

  it("flags ssh, vim, and other interactive programs", () => {
    expect(needsInteractiveTerminal("ssh", ["user@host"])).toBe(true);
    expect(needsInteractiveTerminal("vim", ["file.txt"])).toBe(true);
    expect(needsInteractiveTerminal("htop", [])).toBe(true);
  });

  it("does not flag ordinary non-interactive programs", () => {
    expect(needsInteractiveTerminal("ls", ["-la"])).toBe(false);
    expect(needsInteractiveTerminal("git", ["log"])).toBe(false);
  });
});
