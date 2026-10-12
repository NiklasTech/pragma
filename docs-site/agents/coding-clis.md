# Coding CLIs in Agents

Pragma can run the official coding CLIs you have installed, such as Claude Code, Codex CLI or Gemini CLI, right in the Agents view. Installing and signing in to a CLI is described in [AI Provider Setup](../ai-providers.md#local-cli-integration).

Installed CLIs are listed under **Coding CLIs** in the **New session** menu. Each CLI offers up to two ways to work:

| Mode         | What you get                                                                                                     |
| ------------ | ---------------------------------------------------------------------------------------------------------------- |
| Conversation | A Pragma chat that talks to the CLI over the Agent Client Protocol, with Pragma's composer, approvals and review |
| Terminal     | The CLI's own interactive terminal UI in a pane, exactly as in your shell                                        |

All supported CLIs offer both modes, except DeepSeek Harness, which has no interactive terminal. When a CLI offers only one mode, the menu starts it directly.

## What a conversation receives

Before your first message, Pragma sends a Conversation session a short block of context:

- **Skills**: the catalog of the enabled [workspace skills](./skills.md). With a [named agent](./named-agents.md), the agent's brief, its memory and the skills selected on its **Skills** tab instead.
- **Project rules**: with **Use PRAGMA.md** turned on, the rules file of the project (`PRAGMA.md`, otherwise `AGENTS.md`, otherwise `CLAUDE.md`), but only when the CLI does not load that file on its own. Codex, Copilot, Cursor, OpenCode, Grok and Kimi read `AGENTS.md`, and Claude Code reads `CLAUDE.md`, so Pragma leaves those out to avoid sending them twice. No CLI reads `PRAGMA.md`, so Pragma always sends it.

Terminal sessions receive nothing from Pragma; the CLI starts exactly as in your shell.

## Terminal panes

A Terminal session starts the CLI in the session's folder and shows it in a full terminal pane. It is titled with the CLI name and the start time, for example `Claude Code 14:32`. Terminal panes use the font, size and scrollback from **Settings > Terminal**.

- Links in the output open in your browser.
- Drag a file from the file explorer onto the pane to type its quoted path at the prompt.
- With [hold to dictate](./voice-dictation.md#hold-to-dictate) bound, a held shortcut types the transcript into the terminal without pressing `Enter`.
- The pane header shows whether the CLI is working, and the exit code once it has quit.
- When the CLI prints a local URL such as `http://localhost:5173`, the pane header offers **Open in browser**, which shows it in a [browser pane](./browser-pane.md).

The process keeps running while you look at other panes. A CLI terminal cannot be resumed after it exits, so once its pane is closed and the process has ended, it is removed from the thread list.

## Run several CLIs side by side

**Pane layout > Launch coding CLIs** starts several instances of one CLI at once:

1. Pick the CLI.
2. Choose how many instances to start, from one to eight.
3. Select **Launch**.

The new terminals replace the panes on screen and are numbered (`Claude Code 14:32 #1`, `#2` and so on). Your other threads stay in the thread list.

All launched terminals work in the same folder, the open workspace.
