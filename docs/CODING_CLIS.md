# Coding CLIs: Verified Facts

Pragma runs coding CLIs in two ways: as a terminal pane (the CLI's own TUI in a PTY) and as Pragma chat over the Agent Client Protocol (ACP). The manifests live in `src-tauri/src/ai/cli/manifest.rs`. This page records what each CLI does, as verified in a lab run, so that manifest changes and new integrations rest on facts instead of guesses.

Lab run: 2026-11-28, macOS 27 arm64, Node 24.21, npm 11.19. Every CLI was installed with `npm install --prefix <scratch>` and run with an empty scratch `HOME`, so nothing was signed in and no global config was read. Facts marked _help_ come from the CLI's `--help` output, _code_ from reading the installed package, _run_ from a recorded run.

## ACP handshake

`node scripts/acp-handshake.mjs` (or `pnpm run check:acp`) starts each manifest's ACP command, sends `initialize` and `session/new`, and reports what the agent answers. It needs no login. The `Coding CLI Handshake` workflow runs it on Linux, macOS and Windows when a manifest changes and once a week. Pass provider ids to check only some, `--json` for machine-readable output, and `--require a,b` to exit with an error when one of them fails.

| id                        | Agent (`agentInfo`)                             | `loadSession` | `sessionCapabilities`          | MCP over         | Auth methods                                               | `session/new` without login                 |
| ------------------------- | ----------------------------------------------- | ------------- | ------------------------------ | ---------------- | ---------------------------------------------------------- | ------------------------------------------- |
| `anthropic-claude`        | `@agentclientprotocol/claude-agent-acp` 0.113.0 | yes           | list, resume, close, fork, ... | stdio, http, sse | none                                                       | ok (uses the macOS keychain login)          |
| `openai-codex`            | `@agentclientprotocol/codex-acp` 2.12.1         | yes           | list, resume, close, fork, ... | stdio, http      | `api-key`, `chat-gpt`                                      | auth required                               |
| `google-gemini`           | `gemini-cli` 0.71.1                             | yes           | none                           | stdio, http, sse | `oauth-personal`, `gemini-api-key`, `vertex-ai`, `gateway` | auth required ("Gemini API key is missing") |
| `github-copilot`          | `Copilot` 1.0.117                               | yes           | list, close                    | stdio, http, sse | `copilot-login`                                            | auth required                               |
| `xai-grok`                | none reported (`grok` 1.0.92)                   | yes           | list, resume, close            | stdio, http, sse | `grok.com`                                                 | auth required                               |
| `moonshot-kimi`           | `Kimi Code CLI` 2.8.1                           | yes           | list, resume, close, fork, ... | stdio, http, sse | `login`                                                    | auth required                               |
| `opencode`                | `OpenCode` 2.4.2                                | yes           | list, resume, close, fork, ... | stdio, http      | `opencode-login`                                           | ok (free models, no login)                  |
| `deepseek-harness`        | `deepseek-harness-acp` 0.0.1                    | no            | list, resume, close            | stdio, http      | none                                                       | ok                                          |
| `cursor-agent`            | not run                                         |               |                                |                  |                                                            |                                             |
| `hermes-agent`            | not run                                         |               |                                |                  |                                                            |                                             |
| Qwen Code (not in Pragma) | `qwen-code` 0.28.7, `qwen --acp`                | yes           | list, resume                   | stdio, http, sse | `openai`                                                   | auth required                               |

All agents speak protocol version 1 and answer `initialize` without a login. Every "auth required" answer is JSON-RPC error `-32000`, which Pragma turns into its sign-in card. Claude Code and OpenCode also sent `available_commands_update` right after `session/new` (49 and 5 commands). Cursor and Hermes install through a shell script that the lab did not run; their rows stay open.

## Install

| id                 | Install                                        | Version command and output                                                        | Windows                                                       |
| ------------------ | ---------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `anthropic-claude` | `npm i -g @anthropic-ai/claude-code`           | `claude --version`: `2.1.332 (Claude Code)`                                       | native win32 x64/arm64 package                                |
| `openai-codex`     | `npm i -g @openai/codex`                       | `codex --version`: `codex-cli 0.172.0`                                            | native win32 x64/arm64 package                                |
| `google-gemini`    | `npm i -g @google/gemini-cli`                  | `gemini --version`: `0.71.1`                                                      | Node, win32 PTY package                                       |
| `github-copilot`   | `npm i -g @github/copilot`                     | `copilot --version`: two lines, `GitHub Copilot CLI 1.0.117.` then an update hint | native win32 x64/arm64 package                                |
| `xai-grok`         | `npm i -g @xai-official/grok`                  | `grok --version`: `grok 1.0.92 (b06756fd6256) [stable]`                           | native win32 x64/arm64 package                                |
| `moonshot-kimi`    | `npm i -g @moonshot-ai/kimi-code`              | `kimi --version`: `2.8.1`                                                         | Node only, no native package                                  |
| `opencode`         | `npm i -g @opencode/cli`                       | `opencode --version`: `opencode v2.4.2`                                           | native windows x64/arm64 package                              |
| `deepseek-harness` | `npm i -g @deepseek-ai/dsh`                    | `dsh --version`: `0.2.2-rc.5`                                                     | Node only, needs Node 24.9 or later                           |
| `cursor-agent`     | `curl https://cursor.com/install -fsS \| bash` | `cursor-agent --version`                                                          | the bash script supports Linux and macOS; Windows not checked |
| `hermes-agent`     | install script                                 | `hermes --version`                                                                | not checked                                                   |

- npm 11 no longer runs install scripts unless they are allowed (`allowScripts`). All eight npm CLIs above still started and printed their version without them (_run_).
- `@opencode/cli` (2.x, created 2026-09) and `opencode-ai` (1.x) are both published by the OpenCode maintainer; `@opencode/cli` is the current line.
- The Cursor script installs to `~/.local/share/cursor-agent` and links both `~/.local/bin/agent` (the primary name now) and `~/.local/bin/cursor-agent` (_code_).

## Login

| id                 | Terminal login                                        | Other auth                                                          |
| ------------------ | ----------------------------------------------------- | ------------------------------------------------------------------- |
| `anthropic-claude` | `claude auth login`                                   | `ANTHROPIC_API_KEY`                                                 |
| `openai-codex`     | `codex login`                                         | `OPENAI_API_KEY` (ACP method `api-key`)                             |
| `google-gemini`    | none; `/auth` inside the TUI                          | `GEMINI_API_KEY`, Vertex AI                                         |
| `github-copilot`   | `copilot login`                                       |                                                                     |
| `xai-grok`         | `grok login`, `grok logout`                           | `XAI_API_KEY`                                                       |
| `moonshot-kimi`    | `kimi login` (device code)                            |                                                                     |
| `opencode`         | `opencode auth login`                                 | free models need no login                                           |
| Qwen Code          | none; `/auth` inside the TUI (`qwen auth` is removed) | OpenAI-compatible key, Anthropic, Gemini, Vertex; no free tier left |

## MCP in terminal panes

Pragma chat hands its MCP server to every agent in `session/new`. A terminal pane has to add it on the command line or through the environment, without touching the user's global config. The fake-server test started each CLI in a PTY with a stdio MCP server that logs when it is launched.

| id                 | Per-run option                                                              | Result                                                                                                                                                                                                                                              |
| ------------------ | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `anthropic-claude` | `--mcp-config <file>` (`{"mcpServers": {...}}`)                             | used by Pragma                                                                                                                                                                                                                                      |
| `openai-codex`     | `-c mcp_servers.<name>.command=...`, `.args=[...]`, `.env_vars=[...]`       | used by Pragma: the server's args carry the config file's path, and Pragma's bridge reads its port and token from that file, so no secret is on the command line; `codex mcp get` shows the server (_run_); the TUI starts servers only after login |
| `github-copilot`   | `--additional-mcp-config @<file>`, same file format as Claude Code          | used by Pragma; server started before login, env passed, all tools enabled (_run_)                                                                                                                                                                  |
| Qwen Code          | `--mcp-config <file>`, same file format as Claude Code                      | server started before login, env passed (_run_)                                                                                                                                                                                                     |
| `opencode`         | `OPENCODE_CONFIG=<file>` with `{"mcp": {"<name>": {"type": "local", ...}}}` | started only with `--standalone`; the default background service does not see the variable (_run_)                                                                                                                                                  |
| `xai-grok`         | `GROK_CONFIG_PATH=<file>` overlay; documented for `grok agent stdio`        | not shown by `grok mcp list`; TUI not testable without login                                                                                                                                                                                        |
| `google-gemini`    | none                                                                        | system settings from `GEMINI_CLI_SYSTEM_SETTINGS_PATH` and `GEMINI_CLI_SYSTEM_DEFAULTS_PATH` are skipped unless root owns the file (_run_); the other sources are `~/.gemini/settings.json`, the project's `.gemini/settings.json` and extensions   |
| `moonshot-kimi`    | none                                                                        | reads only `$KIMI_CODE_HOME/mcp.json` and `<cwd>/.kimi-code/mcp.json` (_code_)                                                                                                                                                                      |

Pragma builds these options in `src-tauri/src/ai/child_sessions/cli_config.rs`.

## Resume

| id                 | New session with a given id                            | Resume by id                            | Notes                                                    |
| ------------------ | ------------------------------------------------------ | --------------------------------------- | -------------------------------------------------------- |
| `anthropic-claude` | `--session-id <uuid>`                                  | `--resume <id>`                         | Pragma reads the id from a `SessionStart` hook           |
| `openai-codex`     | none                                                   | `codex resume <id>`, `--last`           |                                                          |
| `google-gemini`    | `--session-id <uuid>`                                  | `--resume <uuid>`, `latest` or an index | ids are matched in the project's `chats` folder (_code_) |
| `github-copilot`   | `--session-id <uuid>`                                  | `--resume <id>`, `--continue`           |                                                          |
| `xai-grok`         | `-s, --session-id <uuid>`                              | `-r, --resume <id or title>`, `-c`      |                                                          |
| `moonshot-kimi`    | none                                                   | `-S, --session <id>`, `-c`              |                                                          |
| `opencode`         | `-s, --session <id>` creates it when it does not exist | `-s <id>`, `-c`                         |                                                          |
| Qwen Code          | `--session-id <id>`                                    | `-r, --resume <id>`, `-c`               |                                                          |

Every CLI with a "new session with a given id" option lets Pragma pick the id at launch and resume it later, without a hook that reports it.

## Attention

Pragma marks a terminal pane as "needs input" or "finished" from a bell, an OSC 9 notification or an OSC 777 notification in the PTY output (`src/features/ai/terminal/attentionSignals.ts`).

| id                 | What the CLI sends                                                                                                                            |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `anthropic-claude` | nothing in an unknown terminal; Pragma adds hooks with `--settings` that print OSC 777                                                        |
| `openai-codex`     | OSC 9 with `-c tui.notifications=true`, which Pragma passes                                                                                   |
| `google-gemini`    | OSC 9, OSC 777 or a bell when `general.enableNotifications` is `true` in its settings; "needs your attention" and "session complete" (_code_) |
| `moonshot-kimi`    | OSC 9 when `TERM_PROGRAM` is iTerm, WezTerm, ghostty or Warp, otherwise a bell (_code_)                                                       |
| others             | not checked                                                                                                                                   |

## Config folders per account

| id                 | Variable                                               |
| ------------------ | ------------------------------------------------------ |
| `anthropic-claude` | `CLAUDE_CONFIG_DIR` (used by Pragma)                   |
| `openai-codex`     | `CODEX_HOME` (used by Pragma)                          |
| `google-gemini`    | `GEMINI_CLI_HOME`                                      |
| `github-copilot`   | `COPILOT_HOME`                                         |
| `xai-grok`         | `GROK_HOME`                                            |
| `moonshot-kimi`    | `KIMI_CODE_HOME`                                       |
| `opencode`         | `OPENCODE_CONFIG_DIR` (config), `XDG_DATA_HOME` (data) |

These names come from the packages' code; only Claude Code and Codex are tested with several accounts.

## Usage and limits

- Grok: `grok usage` prints the plan's usage limit (_help_).
- Claude Code and Codex: Pragma reads usage itself (`src-tauri/src/ai/subscription_usage.rs`).
- The others show usage only inside their TUI.

## Rerun the lab

```bash
LAB=$(mktemp -d)
npm install --prefix "$LAB/npm" @openai/codex @agentclientprotocol/codex-acp @google/gemini-cli \
  @github/copilot @xai-official/grok @moonshot-ai/kimi-code @opencode/cli @deepseek-ai/dsh
HOME="$LAB/home" PATH="$LAB/npm/node_modules/.bin:$PATH" node scripts/acp-handshake.mjs
```

With a scratch `HOME`, `npx` caches `claude-agent-acp` and `codex-acp` under that home as well.
