# Security

Pragma runs shells, reads and writes files, stores credentials and talks to AI providers — so security bugs matter. If you find one, please tell us before posting it publicly.

## Reporting

Email **info@nh-webdev.de**. Include:

- What the issue is and what it lets an attacker do
- Steps to reproduce (a small PoC is great)
- Version, OS and architecture

We'll get back to you within a few days. Once it's fixed, we'll credit you in the release notes — unless you'd rather stay anonymous.

Please don't open a public GitHub issue for security reports.

## Supported versions

Until 1.0.0, only the latest commit on `main` gets security fixes. Once versioned releases are available, supported versions will be listed here.

| Version       | Supported |
| ------------- | --------- |
| latest `main` | yes       |
| older commits | no        |

## What's in scope

- The Rust backend in `src-tauri/` (PTY, FS, IPC, plugins)
- The frontend in `src/` — anywhere untrusted input lands (terminal output, file content, AI tool results, credentials)
- Release artifacts on GitHub
- MCP server communication and lifecycle
- The Docker/Podman integration

## What's not

- Bugs in upstream dependencies (Tauri, xterm.js, CodeMirror, Vercel AI SDK, …) — report those upstream. We'll ship the fix once it's released.
- Anything that needs an already-compromised machine or a local attacker with shell access
- Older commits that are not on the latest `main`

## What we do to keep things safe

- **API keys live in the OS keychain** via `keyring` — not on disk, not in `localStorage`, not in logs.
- **No telemetry.** Pragma only talks to the network when you ask it to (AI requests, MCP servers, web preview).
- **AI tool approval.** File writes, shell commands and MCP tool calls need your OK before they run.
- **No Node in the renderer.** The frontend only reaches the host through the allow-listed Tauri commands.
- **Signed releases.** Updates are verified before they're applied once the release pipeline is in place.

## What we can't promise

- Pragma runs whatever you (or the agent) tell it to run, with your permissions. That's kind of the point of a terminal.
- AI providers see whatever you send them. Read their retention policies.
- Local LLM endpoints (Ollama, OpenAI-compatible) are trusted at the network level — only point Pragma at servers you control.
- MCP servers run with your local user permissions. Only connect servers you trust.
