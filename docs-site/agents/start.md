# Hand out tasks

The start card of an agents tab gives each task to its own agent. If you pay for two Claude Code plans, or for Claude Code and Codex, every plan gets work at the same time.

## One task per line

Write each task on its own line. With more than one line, Pragma lists the tasks under the field and shows which agent takes which task. **Start** then reads **Start 3** for three tasks, and `Cmd/Ctrl + Enter` starts them all.

A tab holds eight panes, so a start takes at most eight tasks. Empty lines are skipped.

## Pick who works

The row under the field lists every installed coding CLI that runs in a terminal, once per [account](../ai-providers.md#several-accounts-of-one-cli), and **Pragma** for Pragma's own agent.

- A plain click picks one agent. It takes every task.
- `Cmd + Click` on macOS or `Ctrl + Click` on Windows and Linux adds another agent to the ones that share the tasks, or takes it out again.

The tasks are handed out in turn: with two Claude Code accounts and three tasks, the first account gets tasks one and three, the second account gets task two. To give a task to someone else, pick another agent in the dropdown next to that task.

If you pick several agents and write no task, each of them opens with an empty session. With **Pragma** picked, the whole text goes to one chat with Pragma's agent, however many lines it has.

## Where they work

Agents that start together would edit the same files, so each of them gets its own [worktree](./worktrees.md) on its own branch. The text next to **Start** says what will happen:

| Text                        | Meaning                                                          |
| --------------------------- | ---------------------------------------------------------------- |
| each in its own worktree    | Several agents, each in a new worktree                           |
| all in this folder          | Several agents in your checkout, because the project asks for it |
| all in this folder (no Git) | The folder is not a Git repository, so there are no worktrees    |
| in a new worktree           | One agent in a new worktree                                      |
| in this folder              | One agent in your checkout                                       |

A project can keep its agents in the checkout with **Writing sessions work in** in **Settings > Spaces and layouts**, see [Choose where writing sessions work](./worktrees.md#choose-where-writing-sessions-work).

## When they are done

Each agent shows up as its own pane and in the [status pill](./watching.md). When an agent is finished, [review its changes](./review.md), keep or undo each part, and commit them or open a pull request.
