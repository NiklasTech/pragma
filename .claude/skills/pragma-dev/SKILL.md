---
name: pragma-dev
description: Start Pragma Dev (the debug build of this repo) and drive it like Playwright - inspect the UI, click, type, press keys, take screenshots, read console and backend logs, trigger native menu items. Use when asked to run, see, test or screenshot the app, or to confirm a UI change in the real app.
---

# Driving Pragma Dev

Debug builds serve a local dev bridge (`src-tauri/src/modules/dev_bridge`). The `pragma-dev` MCP server from `.mcp.json` (`scripts/dev-bridge-mcp.mjs`) exposes it as `pragma_*` tools. Release builds contain none of this.

## Start

1. Run `pnpm run dev:desktop` as a background command (in the Bash tool: `run_in_background`, outside the sandbox). The first build takes a few minutes; later starts are incremental.
2. Call `pragma_status` until it lists the `main` window.

Frontend changes reload through Vite without a restart. Rust changes (and `page_agent.js`) make `tauri dev` rebuild and restart the app on its own; call `pragma_status` again afterwards.

Only one Pragma Dev runs at a time (single instance, Vite on port 5173). If another worktree's dev build is running, stop that one by PID (`pgrep -fl target/debug/app`). Never quit or kill the installed Pragma app; the user and this session run inside it.

## Loop

- `pragma_inspect` outlines the visible UI with refs like `[e12]`. Refs are valid until the next inspect.
- `pragma_click`, `pragma_type`, `pragma_press` take a `ref`, `selector`, visible `text` (`target_text` for type) or `x`/`y`.
  - Terminal: `pragma_type` with `selector: ".xterm"`, then `pragma_press` `Enter`.
  - Shortcuts: `pragma_press` with `Mod+P`, `Mod+Shift+F`, `Escape`. `Mod` is Cmd on macOS.
- `pragma_wait_for` waits for text or a selector to appear, or to disappear with `gone`.
- `pragma_screenshot` returns a PNG of the web content at device scale (2x on Retina); click coordinates are CSS pixels.
- `pragma_console_logs` and `pragma_backend_logs` read the webview console and `pragma.log`.
- `pragma_menu` lists the native macOS menu items or triggers one by id, e.g. `view.toggleTerminal`.
- `pragma_eval` runs JavaScript as an async function body; `return` the value.

The window does not need to be in front: debug builds keep rendering while covered, and no screen recording or accessibility permission is needed.

## Stop

Stop the background `pnpm run dev:desktop` task. That ends Vite and the app.
