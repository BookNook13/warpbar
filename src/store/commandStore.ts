import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { DevFlowCommand } from "../types/command";
import { fuzzyMatchCandidate } from "../lib/fuzzy";

interface CommandState {
  commands: DevFlowCommand[];
  query: string;
  isLoading: boolean;
  load: () => Promise<void>;
  add: (cmd: Omit<DevFlowCommand, "id" | "createdAt" | "useCount">) => Promise<void>;
  update: (cmd: DevFlowCommand) => Promise<void>;
  remove: (id: string) => Promise<void>;
  recordUsage: (id: string) => Promise<void>;
  setQuery: (q: string) => void;
  filtered: () => DevFlowCommand[];
}

export const useCommandStore = create<CommandState>((set, get) => ({
  commands: [],
  query: "",
  isLoading: false,

  load: async () => {
    set({ isLoading: true });
    const commands = await invoke<DevFlowCommand[]>("get_commands");
    set({ commands, isLoading: false });
  },

  add: async (partial) => {
    const cmd: DevFlowCommand = {
      ...partial,
      id: "",
      useCount: 0,
      createdAt: Date.now(),
    };
    const saved = await invoke<DevFlowCommand>("save_command", { cmd });
    set((s) => ({ commands: [...s.commands, saved] }));
  },

  update: async (cmd) => {
    await invoke("update_command", { cmd });
    set((s) => ({
      commands: s.commands.map((c) => (c.id === cmd.id ? cmd : c)),
    }));
  },

  remove: async (id) => {
    await invoke("delete_command", { id });
    set((s) => ({ commands: s.commands.filter((c) => c.id !== id) }));
  },

  recordUsage: async (id) => {
    const cmd = get().commands.find((c) => c.id === id);
    if (!cmd) return;
    const updated: DevFlowCommand = {
      ...cmd,
      useCount: cmd.useCount + 1,
      lastUsedAt: Date.now(),
    };
    await invoke("update_command", { cmd: updated });
    set((s) => ({
      commands: s.commands.map((c) => (c.id === id ? updated : c)),
    }));
  },

  setQuery: (q) => set({ query: q }),

  filtered: () => {
    const { commands, query } = get();

    if (!query.trim()) {
      // No query: show everything, most-used first, so your go-to
      // commands surface even before you start typing.
      return [...commands].sort((a, b) => b.useCount - a.useCount);
    }

    const scored = commands
      .map((cmd) => ({ cmd, score: fuzzyMatchCandidate(query, cmd) }))
      .filter((entry): entry is { cmd: DevFlowCommand; score: number } => entry.score !== null);

    // Usage acts as a tie-breaker/light boost on top of match quality,
    // not a replacement for it — a great match you've never run still
    // beats a mediocre match you happen to run daily.
    scored.sort((a, b) => b.score + b.cmd.useCount * 0.5 - (a.score + a.cmd.useCount * 0.5));

    return scored.map((entry) => entry.cmd);
  },
}));
