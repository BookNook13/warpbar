# ⚡ Warpbar

![CI](https://github.com/BookNook13/warpbar/actions/workflows/ci.yml/badge.svg)

**A blazing-fast, keyboard-first developer command palette for Linux.**

Warpbar lives in your system tray and pops up instantly with a global hotkey — search, run, and manage your everyday shell commands, scripts, and workflows without ever touching a mouse.

Built with [Tauri](https://tauri.app) (Rust backend, React/TypeScript frontend) for a native-feeling desktop app that's fast, lightweight, and secure by default.

---

## Features

- **Instant global toggle** — a rebindable hotkey (`Ctrl+Alt+Space` by default) summons Warpbar from anywhere, even when it's minimized to the tray.
- **Fuzzy search** — typo-tolerant, subsequence-based matching (type "rd" to find "**R**estart **D**ocker") with usage-based ranking, so your most-used commands surface first.
- **Three action types**:
  - **Shell** — run any command, with full stdout/stderr capture and exit codes.
  - **Workflow** — chain multiple commands together, run in sequence, stop on first failure.
  - **Open** — launch a URL or file path with your system's default application.
- **Context-aware working directories** — scope any shell command to a **fixed path**, or to **"last shell directory"** mode via an opt-in shell-integration hook, so commands run where you actually mean them to, not wherever Warpbar's own process happens to live.
- **Security by design**:
  - Commands run as direct process invocations, never through a shell string — eliminating an entire class of shell-injection bugs.
  - **Trust-on-first-use**: the first time Warpbar runs a program it hasn't seen before, it asks you to confirm. A small built-in safe-list of common read-only tools (`ls`, `cat`, `df`, `grep`, `git`, and similar) is auto-trusted with no prompt, since friction should scale with actual risk, not novelty.
  - A built-in **Trust Manager** lets you review and revoke trusted programs at any time.
  - **Destructive-command detection**: commands that look like they could wipe data, format a disk, or restart the system require an explicit second confirmation — toggleable in Settings.
  - Sandboxed execution with a sanitized environment (known code-injection environment variables like `LD_PRELOAD` are stripped), output size limits, a configurable timeout, and a persistent execution audit log.
- **Interactive terminal handoff** — commands that need real interactive input (`sudo`, `ssh`, editors) are automatically handed off to a real terminal window instead of failing silently.
- **Settings** — rebind the global hotkey by pressing a new combination directly, toggle destructive-command confirmation, adjust the command timeout, and manage shell integration, all from one panel.
- **Lives in the background** — closing the window hides it to the tray instead of quitting; a tray icon gives you an explicit Show/Quit menu.
- **Single-instance safe** — launching Warpbar twice just focuses the existing window instead of conflicting.
- **Autostart on login** — one click to have Warpbar ready the moment you log in.
- **Fully keyboard-driven** — arrow keys to navigate, Enter to run, Escape to dismiss, `Ctrl+N` to add a new command.

---

## Installation

### From a `.deb` package (Ubuntu/Debian)

```bash
git clone https://github.com/BookNook13/warpbar.git
cd warpbar
npm install
./deploy.sh
```

This builds a release bundle and installs it system-wide. Once installed, launch **Warpbar** from your applications menu, or run `warpbar` from a terminal.

### Development setup

```bash
git clone https://github.com/BookNook13/warpbar.git
cd warpbar
npm install
npm run tauri dev
```

**Requirements:**
- Node.js and npm
- Rust and Cargo
- Linux system libraries: `libwebkit2gtk-4.1-dev`, `libxdo-dev`, `libssl-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`, `build-essential`

```bash
sudo apt update
sudo apt install -y libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

---

## Usage

| Shortcut | Action |
|---|---|
| Global hotkey (default `Ctrl+Alt+Space`) | Toggle the Warpbar window from anywhere |
| `↑` / `↓` | Navigate the command list |
| `Enter` | Run the selected command |
| `Esc` | Dismiss confirmations / clear output |
| `Ctrl+N` | Add a new command |

In the header: click the **gear icon** for Settings (hotkey, danger confirmation, timeout, shell integration), the **shield icon** for the Trust Manager, and the **power icon** to toggle autostart on login.

### Context-aware working directories

Any shell command can be scoped to run from a specific directory instead of Warpbar's own working directory:

- **Fixed path** — always runs from a directory you specify.
- **Last shell directory** — runs from wherever your terminal was last active. Requires the shell-integration hook, available under Settings → Shell Integration, which adds a small `precmd`/`PROMPT_COMMAND` hook to your `.bashrc` or `.zshrc` that records your current directory as you work.

---

## Project structure

warpbar/
├── src/ # React/TypeScript frontend
│ ├── components/ # Add/edit modal, trust manager, settings panel, autostart toggle
│ ├── lib/ # Fuzzy search, danger detection, command parsing
│ ├── store/ # Zustand state management
│ └── App.tsx
├── src-tauri/ # Rust backend
│ └── src/
│ ├── commands/
│ │ ├── model.rs # Command data model
│ │ ├── store.rs # JSON-backed command persistence
│ │ ├── exec.rs # Sandboxed shell execution
│ │ ├── security.rs # Trust-on-first-use, safe-list, audit log
│ │ ├── terminal.rs # Interactive terminal handoff
│ │ ├── settings.rs # Hotkey parsing/rebinding, app settings
│ │ └── shell_context.rs # Reads the shell-integration state file
│ └── lib.rs # Tray, global shortcut, window lifecycle
├── .github/workflows/ci.yml # CI: frontend + backend tests and builds
└── deploy.sh # Build + install script


---

## Building a release package

```bash
./deploy.sh
```

This kills any running instance, builds an optimized release binary, packages it as a `.deb`, and installs it — the full loop in one command.

---

## Running tests

Frontend (command parsing, fuzzy search, danger detection):

```bash
npm run test
```

Backend (hotkey parsing, safe-list boundaries):

```bash
cd src-tauri
cargo test
```

Both suites run automatically on every push via GitHub Actions.

---

## Contributing

Issues and pull requests are welcome. Areas of active interest: deeper command allowlisting policies, workflow-level working-directory support, and additional distribution formats (AppImage).

## License

MIT
