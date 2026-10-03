# Agents Workspace

The Agents view is where you talk to AI agents, run coding CLIs and review what they changed. Switch between the Agents view and the editor with `Cmd/Ctrl + Shift + E`.

The view has three parts:

- **Thread list** on the left: every session of the open folder, your [named agents](./named-agents.md) and the [task board](./tasks.md).
- **Pane grid** in the middle: up to eight sessions side by side.
- **Context pane** on the right: the [review pane](./review-pane.md) and the changed files of the focused session.

## Session types

Start a session with **New session** in the thread list or from the empty pane.

| Type       | What it does                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------ |
| Ask        | Talk about the code without changing files                                                       |
| Agent      | Plans, edits files and runs commands, in this checkout or in a [new worktree](./worktrees.md)    |
| Coding CLI | A [Conversation or Terminal](./coding-clis.md) session with an installed CLI such as Claude Code |

Sessions can also be started by other sessions, see [child sessions](./child-sessions.md). A pane can show a [browser](./browser-pane.md) instead of a session.

## Session panes

Every open session gets its own pane. Panes are tiled automatically in a grid: opening a session adds a pane, closing one lets the others fill the space. Drag the border between two panes to resize them.

The grid holds at most **eight panes**. When it is full, opening another session is blocked until you close a pane.

### Opening and splitting

- Click a thread in the thread list to open it in a new pane, or to focus its pane if it is already open.
- Use **New session** (the `+` button) in a pane header to start a session of the same kind next to it. For a coding CLI the button is named after it, for example **New Claude Code**.
- An empty pane offers **Recent threads** and a search field, so you can pick which session it shows.

### Layout presets

The **Pane layout** menu in the toolbar arranges your most recently focused threads:

| Preset       | Panes |
| ------------ | ----- |
| Focus        | One   |
| Pair         | Two   |
| Grid of four | Four  |

The same menu has **Open browser** and **Launch coding CLIs**, which starts one to eight instances of a CLI at once and shows exactly those in the grid. Open threads stay in the thread list.

### Maximizing

Maximize a pane with the maximize button in its header, from **Pane actions**, or by double-clicking the header. A maximized pane covers the whole grid. Restore it with the same button, a second double-click or `Escape`. Focusing another pane, opening a new one or closing the maximized pane also restores the grid.

### Dragging

Drag a pane by its header and drop it onto another pane to swap their positions. The target pane is highlighted while you drag.

### Pane actions

The `...` menu in a pane header has:

- **Rename**: change the session title.
- **Maximize** or **Restore**.
- **New session**: same as the `+` button.
- **Close other panes** and **Close pane**.

Closing a pane does not delete the session; it stays in the thread list. If the session is still running or waiting for an approval, Pragma asks before it closes the pane. A standalone CLI terminal cannot be resumed, so it disappears from the thread list once its pane is closed and the process has exited.

### Status

The dot in each pane header shows the session status: idle, running (working), waiting for an approval, done, error or cancelled. Terminal panes show running or the exit code.

The pane layout is saved per folder and restored when you open the folder again.
