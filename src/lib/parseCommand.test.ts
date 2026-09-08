import { describe, it, expect } from "vitest";
import { parseCommandString, commandActionToString } from "./parseCommand";

describe("parseCommandString", () => {
  it("splits a simple command into program and args", () => {
    const action = parseCommandString("df -h");
    expect(action).toEqual({ type: "shell", cmd: "df", args: ["-h"] });
  });

  it("wraps compound commands with && in bash -c, instead of splitting them apart", () => {
    // This is the exact bug that shipped and broke "apt update && apt
    // upgrade -y" — naive whitespace splitting turned '&&' and the
    // second 'apt' into literal arguments to the first apt invocation.
    const action = parseCommandString("sudo apt update && sudo apt upgrade -y");
    expect(action).toEqual({
      type: "shell",
      cmd: "bash",
      args: ["-c", "sudo apt update && sudo apt upgrade -y"],
    });
  });

  it("wraps commands with a pipe the same way", () => {
    const action = parseCommandString("ps aux | grep node");
    expect(action).toEqual({
      type: "shell",
      cmd: "bash",
      args: ["-c", "ps aux | grep node"],
    });
  });

  it("wraps commands with a semicolon the same way", () => {
    const action = parseCommandString("echo one; echo two");
    expect(action).toEqual({
      type: "shell",
      cmd: "bash",
      args: ["-c", "echo one; echo two"],
    });
  });

  it("trims surrounding whitespace before parsing", () => {
    const action = parseCommandString("   ls -la   ");
    expect(action).toEqual({ type: "shell", cmd: "ls", args: ["-la"] });
  });

  it("handles a bare command with no arguments", () => {
    const action = parseCommandString("whoami");
    expect(action).toEqual({ type: "shell", cmd: "whoami", args: [] });
  });
});

describe("commandActionToString", () => {
  it("reconstructs a simple shell command back into its original string shape", () => {
    const str = commandActionToString({ type: "shell", cmd: "df", args: ["-h"] });
    expect(str).toBe("df -h");
  });

  it("unwraps a bash -c compound command back to the raw string, not the wrapper", () => {
    const str = commandActionToString({
      type: "shell",
      cmd: "bash",
      args: ["-c", "sudo apt update && sudo apt upgrade -y"],
    });
    expect(str).toBe("sudo apt update && sudo apt upgrade -y");
  });

  it("returns an empty string for non-shell action types", () => {
    expect(commandActionToString({ type: "open", path: "https://example.com" })).toBe("");
    expect(commandActionToString({ type: "workflow", steps: ["a", "b"] })).toBe("");
  });
});
