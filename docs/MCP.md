# Pragma's MCP Server

Pragma runs an MCP server named `pragma` that lets coding agents act inside Pragma. Every agent gets it:

- in Pragma chat, over ACP (`session/new` lists it in `mcpServers`)
- in a terminal pane, on the command line: Claude Code (`--mcp-config`), Codex (`-c mcp_servers.pragma...`) and Copilot (`--additional-mcp-config`). Which CLIs can take it is recorded in [CODING_CLIS.md](CODING_CLIS.md).

The server is the Pragma binary started with `--pragma-child-sessions-mcp`. It forwards each tool call over loopback TCP, with a per-launch token, to the running app, which answers it in the window that holds the agent's session. Replies are capped at 64 KiB of text.

## Approvals

Tools that only read need no approval. Tools that change files follow the agent setting for edits (Settings, Agent, auto-approve), like Pragma's own agent; with approval required, Pragma shows the request in the session and on the command line. Starting a child session always asks.

## Tools

Paths are absolute or relative to the session's working folder (its worktree, else the project). Lines are 1-based. Language server tools find a symbol by its `line` and its name (`symbol`), so an agent does not need to count columns.

### Sessions and browser

| Tool                       | Arguments                                          | What it does                                                     |
| -------------------------- | -------------------------------------------------- | ---------------------------------------------------------------- |
| `agent_spawn_session`      | `title`, `prompt`, `kind?`, `environment?`, `cli?` | Starts a child session (conversation or coding CLI); always asks |
| `agent_open_browser`       | `url`                                              | Opens an http(s) URL in Pragma's browser pane                    |
| `agent_browser_screenshot` |                                                    | Screenshot of the browser pane as an image                       |
| `agent_browser_console`    | `limit?`                                           | Recent console messages, errors and failed requests of the page  |

### Code intelligence

These use the language servers Pragma runs for the project. A file the editor has not opened is opened with its server for the call and closed again.

| Tool                    | Arguments                            | What it does                                                                                  |
| ----------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------- |
| `lsp_diagnostics`       | `path?`                              | Errors and warnings of a file, without running the build; without a path, of all open files   |
| `lsp_definition`        | `path`, `line`, `symbol`             | Where the symbol is defined                                                                   |
| `lsp_references`        | `path`, `line`, `symbol`             | Every reference to the symbol, with the line's text                                           |
| `lsp_hover`             | `path`, `line`, `symbol`             | Type and documentation, as the editor shows on hover                                          |
| `lsp_document_symbols`  | `path`                               | Outline of the file: classes, functions, variables with their lines                           |
| `lsp_workspace_symbols` | `query`, `path`                      | Symbols in the project matching the query; `path` picks the language server                   |
| `lsp_rename`            | `path`, `line`, `symbol`, `new_name` | Renames the symbol everywhere; lists the files that change and applies the edits once allowed |

Example: an agent that changed `src/store.ts` calls `lsp_diagnostics` with `{ "path": "src/store.ts" }` and gets

```text
1 errors, 0 warnings
/repo/src/store.ts:42:7: error: Type 'string' is not assignable to type 'number'. [typescript]
```

### Editor and review

| Tool                | Arguments       | What it does                                                                                                           |
| ------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `editor_open`       | `path`, `line?` | Opens the file in Pragma's editor at the line; a toast offers to switch to the editor instead of pulling the user away |
| `editor_show_diff`  | `path`          | Opens the file's uncommitted changes (else its staged ones) as a diff tab                                              |
| `editor_open_files` |                 | The files open in the editor, the active one and those with unsaved changes                                            |
| `editor_selection`  |                 | The text selected in the active file with its lines, or the cursor position                                            |
| `review_request`    | `message?`      | A notice with a Review button that opens the session's review view; the user's comments come back as a message         |

### Workspace

| Tool                    | Arguments        | What it does                                                                                                                                                                                                    |
| ----------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `workspace_info`        |                  | Project and working folder, worktree and its base branch, git branch with upstream and changed files, run configurations, and the stack detected from files like `package.json` or `Cargo.toml`                 |
| `local_history`         | `path`, `entry?` | The file's versions Pragma knows (snapshots from saves in the editor and edits of Pragma's own agent, plus git commits); with `entry`, that version's diff. Changes a coding CLI writes itself have no snapshot |
| `local_history_restore` | `path`, `entry`  | Restores the file to that version; follows the setting for edits                                                                                                                                                |

### The user

| Tool          | Arguments             | What it does                                                                                                                                                                                             |
| ------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ask_user`    | `question`, `options` | Shows a question with 2 to 9 answers on the session and on the command line (keys 1 to 9) and waits for the pick; returns the answer, or that the user dismissed it. The question goes after 14 minutes. |
| `notify_user` | `message`             | A notification titled with the session: a toast while Pragma is in front, a system notification in the background, as the notification settings allow.                                                   |

### Extension tools

Extensions can offer tools named `ext__<extension id>__<tool>`; see [EXTENSIONS.md](EXTENSIONS.md).

## Adding a tool group

1. Define the tools in a new file under `src-tauri/src/ai/child_sessions/tools/` and add its `definitions()` to `tools/mod.rs`.
2. Answer them in a new file under `src/features/ai/pragmaTools/` and add its handlers to `PRAGMA_TOOLS` in `useAcpPragmaTools.ts`. A test fails while a Rust tool has no handler.
3. Give each tool a label in `pragmaTools/labels.ts` and list it here.
