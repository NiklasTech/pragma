# The Pragma window

Pragma keeps its controls in one strip at the top and one line at the bottom. Everything else is your work: agent panes, the editor or the activity page.

## The strip

From left to right:

| Part        | What it does                                                                                                            |
| ----------- | ----------------------------------------------------------------------------------------------------------------------- |
| Space name  | The open project with its color and branch. Click it to open the [spaces overview](./spaces.md)                         |
| Tabs        | The tabs of this space, numbered for `Cmd/Ctrl + 1` to `9`                                                              |
| `+`         | Adds a tab: **New agents tab**, **Show code tab** or **Activity tab**                                                   |
| Status pill | One cell per running agent in every space. Click it for the [overview of all agents](./agents/watching.md#the-overview) |
| **go to**   | Search files, symbols, agents, commands and text (`Cmd/Ctrl + P`)                                                       |
| **new**     | Starts a task in a dialog where you pick the agent, the layout and the place (`Cmd/Ctrl + N`)                           |

On macOS the other commands live in the menu bar. On Windows and Linux a **Menu** button next to the space name holds the same menus, and Pragma draws its own window buttons. On Linux they sit on the side your desktop uses.

## Tabs

A space has three kinds of tabs:

- **Agents tabs** hold up to eight agent panes each. Add more of them, for example one per feature.
- The **Code tab** is the editor with the file tree, Git, a terminal and the debugger. Each space has one.
- The **Activity tab** lists what your agents do, see [Watch your agents](./agents/watching.md#the-activity-tab).

Right-click a tab to rename it, add an agents tab, show the code tab or close tabs. `Cmd/Ctrl + Shift + E` switches between the agents tab you used last and the code tab.

## The command line

The line at the bottom of the window talks to the focused agent:

- Type a message and press `Enter` to send it to the agent in the focused pane. With no agent on screen, the text starts a new task instead.
- Type `/` to search the commands of the command palette.
- When an agent waits for a permission, the line shows the question. Answer with `y` to allow once or `n` to deny. When the agent offers it, `a` allows the request from now on. `Enter` jumps to the agent's pane.

`Cmd + K` on macOS or `Ctrl + Alt + K` on Windows and Linux puts the keyboard into the command line. Inside a terminal on macOS, `Cmd + K` clears the terminal instead.

## Go to

**go to** (`Cmd/Ctrl + P`) is one search field for files, symbols, agents, commands and text in the project, with a preview of the highlighted result. A prefix limits the search to one group:

| Prefix | Searches                                          |
| ------ | ------------------------------------------------- |
| `>`    | Commands                                          |
| `@`    | Symbols from the language server of the open file |
| `#`    | Agents                                            |

The command palette (`Cmd/Ctrl + Shift + P`) lists the commands alone.

## The agent rail

In an agents tab, a narrow rail on the left shows one cell per agent pane of the space, with its state. Click a cell to show that pane, or right-click it for the agent's menu. The buttons at the bottom of the rail:

| Button      | What it does                                                                               |
| ----------- | ------------------------------------------------------------------------------------------ |
| Show agents | Opens the [agents sheet](./agents/index.md#the-agents-sheet) with every agent of the space |
| Show files  | Opens the file tree beside the panes                                                       |
| New         | Same as **new** in the strip                                                               |

## The sidebar

In the code tab, the sidebar has four views at the top: **Files**, **Search**, **Changes** and **History**. More views sit behind the `⋯` button: **Debug**, **Docker**, **Processes** and **Extensions**. `Cmd/Ctrl + B` hides and shows the sidebar. The pin button keeps the sidebar beside the editor instead of letting it float over it.
