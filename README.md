# ⚡ Warpbar

**A blazing-fast, keyboard-first developer command palette for Linux.**

Warpbar lives in your system tray and pops up instantly with a global hotkey — search, run, and manage your everyday shell commands, scripts, and workflows without ever touching a mouse.

Built with [Tauri](https://tauri.app) (Rust backend, React/TypeScript frontend) for a native-feeling desktop app that's fast, lightweight, and secure by default.

---

## Features

- **Instant global toggle** — `Ctrl+Alt+Space` summons Warpbar from anywhere, even when it's minimized to the tray.
- **Fuzzy search** — typo-tolerant, subsequence-based matching (type "rd" to find "**R**estart **D**ocker") with usage-based ranking, so your most-used commands surface first.
- **Three action types**:
  - **Shell** — run any command, with full stdout/stderr capture and exit codes.
  - **Workflow** — chain multiple commands together, run in sequence, stop on first failure.
  - **Open** — launch a URL or file path with your system's default application.
- **Security by design**:
  - Commands run as direct process invocations, never through a shell string — eliminating an entire class of shell-injection bugs.
  - **Trust-on-first-use**: the first time Warpbar runs a program it hasn't seen before, it asks you to confirm. A built-in Trust Manager lets you review and revoke trusted programs at any time.
  - **Destructive-command detection**: commands that look like they could wipe data, format a disk, or restart the system require an explicit second confirmation.
  - Sandboxed execution with a sanitized environment (known code-injection environment variables like `LD_PRELOAD` are stripped), output size limits, and a persistent execution audit log.
- **Interactive terminal handoff** — commands that need real interactive input (`sudo`, `ssh`, editors) are automatically handed off to a real terminal window instead of failing silently.
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
| `Ctrl+Alt+Space` | Toggle the Warpbar window from anywhere |
| `↑` / `↓` | Navigate the command list |
| `Enter` | Run the selected command |
| `Esc` | Dismiss confirmations / clear output |
| `Ctrl+N` | Add a new command |

Click the shield icon to open the **Trust Manager** and review or revoke programs Warpbar has been allowed to run. Click the power icon to toggle **autostart on login**.

---

## Project structure

warpbar/
├── src/ # React/TypeScript frontend
│ ├── components/ # Modal, trust manager, autostart toggle
│ ├── lib/ # Fuzzy search, danger detection, command parsing
│ ├── store/ # Zustand state management
│ └── App.tsx
├── src-tauri/ # Rust backend
│ └── src/
│ ├── commands/
│ │ ├── store.rs # JSON-backed command persistence
│ │ ├── exec.rs # Sandboxed shell execution
│ │ ├── security.rs # Trust-on-first-use + audit log
│ │ └── terminal.rs # Interactive terminal handoff
│ └── lib.rs # Tray, global shortcut, window lifecycle
└── deploy.sh # Build + install script


---

## Building a release package

```bash
./deploy.sh
```

This kills any running instance, builds an optimized release binary, packages it as a `.deb`, and installs it — the full loop in one command.

---

## Contributing

Issues and pull requests are welcome. This project is still evolving — planned areas of active work include context-aware working-directory detection and deeper command allowlisting policies.

## License

MIT

## Running tests

```bash
npm run test
```

Covers command parsing (including compound `&&`/`|`/`;` commands), fuzzy search scoring, and destructive-command/interactive-terminal detection — the logic most prone to regression.
