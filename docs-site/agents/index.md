# The agents tab

An agents tab holds up to eight agent panes side by side. A pane shows a coding CLI such as Claude Code or Codex, a shell, a chat with Pragma's own agent or a [browser](./browser-pane.md). Add more agents tabs with `+` in the strip.

<figure class="screen">
  <img src="/screens/agents.webp" alt="Three Claude Code agents side by side in one agents tab">
</figure>

## The start card

An empty agents tab shows the start card:

- The field takes your task. Write one task per line to [start several agents at once](./start.md).
- Below it you pick who runs the tasks: an installed coding CLI, one of its accounts, or **Pragma** for Pragma's own agent.
- The text next to **Start** says where the agents will work, for example **in this folder** or **each in its own worktree**.
- `Cmd/Ctrl + Enter` starts.

The three cards below the field open a shell, search for a file (`Cmd/Ctrl + P`) or open the start dialog (`Cmd/Ctrl + N`) with its [layouts](../spaces.md#layouts).

The start dialog does the same as the start card with more choices: who runs the task, which layout opens, and whether it works in a **New worktree** or **This folder**. It opens the result as a new tab. Which of the two places it suggests is set with **New agents start in** in **Settings > Agents**.

## Panes

Each pane has a header with the agent's mark, its title, the folder or worktree it works in and, for chats, the tokens it used.

| To do this                   | Do this                                                                                               |
| ---------------------------- | ----------------------------------------------------------------------------------------------------- |
| Zoom a pane to the whole tab | Double-click its header, use the zoom button or `Cmd/Ctrl + Shift + Enter`                            |
| Restore the zoomed pane      | The same again, or `Escape`                                                                           |
| Swap two panes               | Drag a pane by its header onto another pane                                                           |
| Resize panes                 | Drag the border between them                                                                          |
| Split a pane                 | **Split right** or **Split down** in the pane's `⋯` menu, or `Cmd + D` and `Cmd + Shift + D` on macOS |
| Move focus to a neighbor     | `Cmd + Option + Arrow` on macOS, `Ctrl + Alt + Arrow` on Windows and Linux                            |

The `⋯` menu of a pane also has **Rename**, **Export**, **New session**, **Close other panes** and **Close pane**. Right-clicking a header opens the agent's menu with letter keys, for example `v` to [review its changes](./review.md) and `z` to zoom.

Closing a pane does not delete the session. For a terminal, the right-click menu offers **close, keep running** and **stop and close**.

An empty pane offers **New session**, a shell and every installed coding CLI and account.

## Agent states

Every agent has one of four states. The rail, the agents sheet, the status pill and the overview all use the same marks.

| State     | Meaning                                                |
| --------- | ------------------------------------------------------ |
| Needs you | The agent waits for an answer or a permission          |
| Working   | The agent is running                                   |
| Done      | The agent finished and you have not looked at it since |
| Idle      | Nothing happens                                        |

## The agents sheet

**Show agents** at the bottom of the agent rail opens the agents sheet. It lists the agents of the space by state, in the order needs you, working, done and idle, with earlier threads below. Type `/` to filter. **all threads** at the bottom opens the thread list.

## The thread list

The thread list holds every session of every space, including finished ones:

- **Sessions** and **Agents** switch between your sessions and your [named agents](./named-agents.md).
- **New session** starts a chat with Pragma's agent, a coding CLI as a chat or a terminal, or joins the [worktree](./worktrees.md#join-another-session-s-worktree) of another session.
- **Tasks** opens the [task board](./tasks.md).
- **This repository** and **All repositories** switch between the sessions of this space and of every space.
- The buttons next to **Threads** are **Group by worktree**, **Select threads** and the **Pane layout** menu.

The **Pane layout** menu arranges your recent threads as **Focus** (one pane), **Pair** (two) or **Grid of four**, opens a [browser pane](./browser-pane.md), starts [several instances of a coding CLI](./coding-clis.md#run-several-clis-side-by-side) and saves the tab as a [layout](../spaces.md#layouts).

The **Thread actions** menu (`⋯`) of a thread that works in a [worktree](./worktrees.md) has **Finish** and **Discard worktree**.
