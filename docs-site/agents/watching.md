# Watch your agents

With several agents at work you mostly want to know which one needs you. Pragma shows that in four places, from a glance to the full picture.

## The status pill

The pill in the strip has one cell per running agent in every space, colored by its [state](./index.md#agent-states). It reads **all quiet** when nothing runs. Click it to open the overview.

## The overview

The overview shows every agent of every space as a card with its latest output, the space and branch it works in, and **Peek** and **Open**.

- The filters at the top show **All**, **Needs you**, **Working**, **Done** or **Idle**, each with a count.
- **Group by** sorts the cards into columns by **Status** or by **Space**.
- **Views** on the left are saved filters: **Everything**, **Waiting on me** and **Ready to review**. **Save this view** keeps the current filter as a new view.
- **Spaces** on the left limit the cards to one space.

`Escape` closes the overview.

## Peek

**Peek** slides an agent in from the right without giving it a pane. It has two parts:

- **Session** shows the conversation or the terminal of the agent. To reply, open the session as a pane.
- **Changes** lists the files the agent changed in its folder, with a diff per file. Edits of Pragma's own agent can be accepted or rejected here, and a changed file in your checkout can be restored from `HEAD`.

The footer has **Stop**, and **Review** opens the full [review](./review.md).

## The activity tab

The activity tab is a page for everything your agents do. Add it with `+` in the strip > **Activity tab**, or press `Cmd + Option + 0` on macOS or `Ctrl + Alt + 0` on Windows and Linux.

- **Plans** shows the usage of each Claude Code account: the current session window and the week, with the time until each resets. The account with the most room left is marked, so you know where to start the next task. Pragma reads the usage that Claude Code caches and lets the CLI refresh it, without touching a running session or your credentials. Other CLIs do not report their usage yet.
- **Needs you** lists the agents that wait for you. Answer a permission right in the row with `y`, `a` or `n`, or go to the pane.
- **Running** lists the agents at work with their last line of output, who runs them, where they work, how long they have been running and their tokens. Click a title for details: the last output, the account, the changes and the context used.
- Below come the sessions that ended today, finished or failed, each with **review** or **open**.

**this space** and **all spaces** switch the scope, and `/` filters the sessions.

## Notifications

**Settings > Agents > When an agent needs you** decides how Pragma tells you that an agent waits:

| Option              | What happens                                                                  |
| ------------------- | ----------------------------------------------------------------------------- |
| Card                | A small card at the bottom right while you work in Pragma                     |
| System notification | A notification of the operating system, only when Pragma is in the background |
| Sound               | A short tone, once per request                                                |

**Also notify** adds two more occasions: **When an agent finishes** and **When an agent fails**.
