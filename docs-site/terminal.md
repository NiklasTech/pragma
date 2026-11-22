# Terminal

Pragma's terminal is a full terminal emulator (xterm.js on a real pseudo terminal), with your own shell, its configuration and its colors. You find it in two places:

- In the **code tab**, the terminal panel sits below the editor. `Cmd + J` on macOS or `` Ctrl + ` `` on Windows and Linux shows and hides it, and `Cmd/Ctrl + T` opens a new terminal tab.
- In an **agents tab**, a shell is a pane like any agent. **Open a terminal** on the start card or **Shell** in an empty pane starts one.

## Tabs, splits and the menu

Each terminal tab shows the folder it runs in, with the color of its space. `+` opens a new terminal; with several spaces open, Pragma asks which one it belongs to.

The `⋯` menu of a terminal and its right-click menu have the same actions:

| Action          | macOS | What it does                            |
| --------------- | ----- | --------------------------------------- |
| Find            | `⌘F`  | Searches the output                     |
| Copy all output |       | Copies everything the terminal printed  |
| Clear           | `⌘K`  | Clears the screen and the scrollback    |
| Split right     |       | Opens a second terminal beside this one |
| Close panel     |       | Closes the terminal panel               |

On macOS the terminal keeps the keys of Terminal.app while it has focus, see [Inside a terminal](./keyboard-shortcuts.md#inside-a-terminal).

## Working with commands

Pragma knows where each command starts and ends:

- `Cmd + Up` and `Cmd + Down` on macOS, `Ctrl + Up` and `Ctrl + Down` on Windows and Linux, jump to the previous or next command.
- When a command fails, a small bar shows its exit code. **Explain** asks the AI chat what went wrong, and **Send to session** hands the command and its output to the active agent session.
- With **Command Suggestions** on, the terminal suggests a command while you type. The model is set in **Settings > Editor > Models > Terminal Suggestions**.

## Links and files

- `Cmd + Click` on macOS or `Ctrl + Click` on Windows and Linux opens a file path in the editor, at its line and column when it has one, and a URL in the browser.
- Drag a file from the file tree onto a terminal to type its quoted path.
- In an agents tab, when a program prints a local URL such as `http://localhost:5173`, the pane header offers **Open in browser**, which shows the page in a [browser pane](./agents/browser-pane.md).

## Shell and settings

**Settings > Terminal** sets the shell, the font, the cursor, the scrollback and **Copy on Select**. Pragma uses the default shell of your system unless you enter another path, such as zsh, bash, fish or PowerShell.

**Settings > Spaces and layouts > Terminal environment** sets variables that every terminal of the project starts with.

After a restart, Pragma brings back your terminal tabs, splits and working directories. With **Restore Scrollback** on, it also brings back their output.

## Coding CLIs in a terminal

When you start Claude Code, Codex or another coding CLI by hand in a shell, Pragma notices it, and the pane header and the agent rail show the CLI's mark. CLIs that Pragma starts itself run in their own terminal panes, see [Coding CLIs in agents](./agents/coding-clis.md#terminal-panes).
