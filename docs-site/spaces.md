# Spaces

Every project folder you open becomes a space. A space keeps its own tabs, agent panes, saved layouts and agent worktrees. Agents keep running when you switch to another space, and the status pill in the strip still counts them.

<figure class="screen">
  <img src="/screens/spaces.webp" alt="The spaces overview with the worktrees of three agents, the tabs and the saved layouts of a project">
</figure>

## Open and switch spaces

Click the space name at the left of the strip to open the spaces overview. The left column lists every open space with its number of agents and tabs and a dot for its state. Select a space to see its details, and click a tab or a worktree there to go to it.

**Folders and files** at the bottom of the left column opens more:

| Item             | What it does                                                   |
| ---------------- | -------------------------------------------------------------- |
| Open Folder      | Opens a folder as a new space                                  |
| Open File        | Opens a single file in the editor                              |
| Close Repository | Closes the active space                                        |
| Repository Color | The color of the active space, see [below](#repository-colors) |
| Favorites        | Folders you open often. **Add Current Folder** adds this one   |
| Open Recent      | Folders you opened before                                      |

Closing a space with running sessions asks first, because closing stops them.

## What the overview shows

The right side of the overview shows the selected space:

- **Worktrees**: your checkout (**this folder**) and every worktree of an agent, with its branch and the agents that work in it. **Open** goes to the latest agent of that worktree. See [Worktrees](./agents/worktrees.md).
- **Tabs**: every tab of the space with its number of panes. Click one to show it.
- **Layouts**: the layouts saved in this project. Click one to open it as a new agents tab.

## Layouts

A layout is an arrangement of panes that you can start again, for example an agent next to two shells for the tests and the dev server. Pragma comes with three:

| Layout                   | Panes                                          |
| ------------------------ | ---------------------------------------------- |
| Just the agent           | One agent                                      |
| Agent, tests, dev server | The agent on the left, two shells on the right |
| Two agents, one task     | Two agents side by side on the same task       |

To save your own, arrange the panes of an agents tab and choose **Save tab as layout…** in the **Pane layout** menu of the [thread list](./agents/index.md#the-thread-list). Saved layouts appear in the start dialog (`Cmd/Ctrl + N`) and in the spaces overview. A saved layout starts its shells and coding CLIs again in a new agents tab.

## Repository colors

Every space gets its own color from a fixed palette. It shows as a small dot wherever the space is named: the strip, the spaces overview, pane headers, terminal tabs and the Git panel. With one space open, the dot only shows once you pick a color yourself.

Change the color of the active space with **Folders and files > Repository Color** in the spaces overview: **Automatic**, a preset or a custom color. **Use as Accent Color** makes the space's color the accent color while the space is active. Repository colors are stored per folder in your app settings, not in `.pragma/settings.json`.
