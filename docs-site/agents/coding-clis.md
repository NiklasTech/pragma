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
3. Choose where they work in **Work in**.
4. Select **Launch**.

The new terminals replace the panes on screen and are numbered (`Claude Code 14:32 #1`, `#2` and so on). Your other threads stay in the thread list.

| Work in                  | Effect                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------ |
| Each in its own worktree | Every instance gets a new [worktree](./worktrees.md) on its own `pragma/...` branch  |
| One shared worktree      | Pragma creates one new worktree, and all instances use it as their working directory |
| This checkout            | All instances work in the open workspace                                             |

Worktrees are created one after another, so their creation never races on the repository. With **One shared worktree** or **This checkout** and more than one instance, the dialog warns that the instances edit the same files.

The dialog starts with **Each in its own worktree**. To change that for a project, set **Settings > Project > Agent > Launch coding CLIs in**, stored as `agent.launchCliEnvironment` (`"isolated"`, `"shared"` or `"checkout"`) in `.pragma/settings.json`. In a folder that is not a git repository, every instance works in the folder itself.

## Skills and agents from coding CLIs

A repository set up for Claude Code, Codex, Copilot, Cursor or another coding CLI often keeps skills and subagents in that tool's own folder. Pragma reads these folders when a workspace opens and whenever a file in them changes, so they work in Pragma without copying anything. Only the project folders below are read; Pragma never changes a file in them.

| Kind   | Path                               | Format                          | Read by                                                   |
| ------ | ---------------------------------- | ------------------------------- | --------------------------------------------------------- |
| Skills | `.agents/skills/<name>/SKILL.md`   | Agent Skills                    | Codex, Gemini CLI, Copilot, Cursor, OpenCode, Antigravity |
| Skills | `.claude/skills/<name>/SKILL.md`   | Agent Skills                    | Claude Code, Copilot, Cursor                              |
| Skills | `.github/skills/<name>/SKILL.md`   | Agent Skills                    | Copilot                                                   |
| Skills | `.cursor/skills/<name>/SKILL.md`   | Agent Skills                    | Cursor                                                    |
| Skills | `.gemini/skills/<name>/SKILL.md`   | Agent Skills                    | Gemini CLI                                                |
| Skills | `.opencode/skills/<name>/SKILL.md` | Agent Skills                    | OpenCode                                                  |
| Agents | `.claude/agents/<name>.md`         | Markdown with YAML front matter | Claude Code, Cursor                                       |
| Agents | `.codex/agents/<name>.toml`        | TOML                            | Codex                                                     |
| Agents | `.gemini/agents/<name>.md`         | Markdown with YAML front matter | Gemini CLI                                                |
| Agents | `.github/agents/<name>.agent.md`   | Markdown with YAML front matter | Copilot (`<name>.md` is accepted too)                     |
| Agents | `.cursor/agents/<name>.md`         | Markdown with YAML front matter | Cursor                                                    |
| Agents | `.opencode/agents/<name>.md`       | Markdown with YAML front matter | OpenCode                                                  |
| Agents | `.grok/agents/<name>.md`           | Markdown with YAML front matter | Grok Build                                                |

The table reflects the documentation of each tool in October 2026. Only files directly in an agent folder are read, not files in its subfolders.

### Skills

Skills from these folders appear in **Settings > Agents > Skills** and on the **Skills** tab of named agents, labeled with their folder, for example `.claude` or `.agents`. They follow the [SKILL.md format](./skills.md#skillmd) with one difference: without `name`, the folder name is used, as Claude Code does.

- A discovered skill starts disabled. Its switch is stored on this machine, because Pragma does not write to CLI folders.
- Named agents can select discovered skills on their **Skills** tab like `.pragma` skills.
- **Copy to .pragma** copies the skill folder to `.pragma/skills/<name>/`, including text files next to `SKILL.md`, and adds `name` when it is missing.

### Agents

Agents from these folders appear in the agent list as project agents, labeled with their folder, for example `.claude - Claude Code`. They are read-only: Pragma uses `name`, `description` and the instructions (the Markdown body, or `developer_instructions` in a Codex TOML file) and ignores tool-specific fields such as `tools` or `model`. A missing `name` falls back to the file name.

A discovered agent runs on the CLI it came from, for example Claude Code for `.claude/agents/`. Start a chat with **New chat** as with any other agent; memory works as for project agents. To change the engine, the brief, skills or folders, choose **Copy to .pragma** in the export menu. It writes `.pragma/agents/<name>.md` in the [project agent format](./named-agents.md#project-agents), which you can then edit.

### Precedence and errors

- A skill or agent in `.pragma/` wins over one with the same id in a CLI folder; the CLI entry is not listed. After **Copy to .pragma**, the copy replaces the discovered entry.
- When several CLI folders use the same id, the first folder in the table above wins.
- A discovered agent whose name another project agent already uses is listed with an error.
- A malformed file, for example invalid YAML or TOML or missing instructions, is listed with its error and does not affect the other entries.

Skill and agent folders in your home directory, such as `~/.claude/skills`, plugin skills and CLI commands are not read.
