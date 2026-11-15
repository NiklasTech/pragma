# Dev Bridge: Let Agents Drive Pragma Dev

Pragma Dev, the debug build started with `pnpm run dev:desktop`, includes a dev bridge. Coding agents such as Claude Code use it to see and operate the running app, much like Playwright does for a web page. An agent can inspect the UI, click, type, press shortcuts, take screenshots, read the console and backend logs, and trigger native menu items.

Release builds do not contain the bridge. All of its Rust code is compiled only with `debug_assertions`.

## Quick Start

1. Start the app: `pnpm run dev:desktop` (agents run it as a background command).
2. Open a Claude Code session in the repository. Claude Code reads `.mcp.json` and offers the `pragma-dev` MCP server; approve it once.
3. Call `pragma_status`. Once it lists the `main` window, use the other tools.

Claude Code also loads the project skill `.claude/skills/pragma-dev/SKILL.md`, which describes this workflow. Other MCP clients can start the server with `node scripts/dev-bridge-mcp.mjs` from the repository root.

Frontend changes reach the running app through Vite hot reload. Rust changes make `tauri dev` rebuild and restart the app on its own, so the agent only calls `pragma_status` again.

## Tools

| Tool                  | Purpose                                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------------- |
| `pragma_status`       | Whether Pragma Dev runs, and its windows with label, URL, size and focus                                        |
| `pragma_inspect`      | Outline of the visible UI: interactive elements with refs like `[e12]`, headings, dialogs, menus and text       |
| `pragma_click`        | Click by `ref`, `selector`, visible `text` or `x`/`y`; right click, double click and modifiers                  |
| `pragma_type`         | Type into an input, the code editor or a terminal (`selector: ".xterm"`); `clear` and `submit` are optional     |
| `pragma_press`        | Press a key or shortcut such as `Enter`, `Escape`, `ArrowDown`, `Mod+P` (`Mod` is Cmd on macOS, Ctrl elsewhere) |
| `pragma_wait_for`     | Wait until text or a selector appears, or disappears with `gone`                                                |
| `pragma_screenshot`   | PNG of a window's web content at device scale (2x on Retina); click coordinates are CSS pixels                  |
| `pragma_console_logs` | Console messages, uncaught errors and unhandled rejections since the page loaded                                |
| `pragma_backend_logs` | Last lines of the Rust log file `pragma.log`                                                                    |
| `pragma_eval`         | Run JavaScript in the page as an async function body and return the result                                      |
| `pragma_menu`         | List the native macOS menu items, or trigger one by id, e.g. `view.toggleTerminal`                              |

Every page tool takes an optional `window` label. Without one, it targets the focused window, otherwise `main`.

## How It Works

- `src-tauri/src/modules/dev_bridge/` is a Tauri plugin registered only in debug builds. It binds a TCP port on `127.0.0.1`, creates a random token, and writes both to `dev-bridge.json` in the app data directory of Pragma Dev (`~/Library/Application Support/dev.pragma.ide.dev/` on macOS). The file is readable only by the user and is removed when the app exits.
- `page_agent.js` is injected into the app's own pages. It records the console and implements inspect, click, type, press and wait. Clicks dispatch the full pointer and mouse event sequence. Typing uses `insertText`, which also works for CodeMirror and xterm.js.
- Screenshots use the webview's own snapshot API (`WKWebView takeSnapshot` on macOS), so no screen recording or accessibility permission is needed.
- On macOS, debug builds turn off WebKit's window occlusion detection. Otherwise a Pragma Dev window covered by another app reports itself as hidden, pauses animation frames and throttles timers, which stalls focus changes and transitions while an agent drives it.
- `scripts/dev-bridge-mcp.mjs` is a dependency-free stdio MCP server. For each tool call it reads the discovery file, connects to the bridge, and forwards the request.

## Limits

- Only one Pragma Dev runs at a time: it is a single-instance app and Vite uses port 5173. Stop a dev build started from another worktree before you start a new one.
- Native dialogs (open file, alerts) and the window chrome are outside the webview and cannot be driven. The native menu bar is reachable only through `pragma_menu`.
- Synthetic events are not trusted events. Code that checks `event.isTrusted` ignores them.
