# Configuration

Open the settings with `Cmd/Ctrl + ,` or from the command palette. A row of tabs at the top switches between the categories; most tabs carry the category's first word, **look** stands for Appearance and **tools** for Extensions and tools. The search field filters every setting at once. The menu of changed settings lists everything you set away from its default.

| Category             | What it holds                                                                                                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| General              | Version, updates and open source licenses                                                                                                                                                                     |
| Agents               | [Coding CLIs and accounts](./ai-providers.md#coding-clis), chat context, project rules, [approvals](./agents/tool-approvals.md), child sessions, notifications and [voice input](./agents/voice-dictation.md) |
| Appearance           | [Theme](./theming.md), interface size, editor and terminal colors, accessibility                                                                                                                              |
| Editor               | Typing, display, [models and API keys](./ai-providers.md#api-keys) and language servers                                                                                                                       |
| Terminal             | Shell, font, scrollback and command suggestions                                                                                                                                                               |
| Git and worktrees    | What happens to the [worktrees](./agents/worktrees.md) agents work in                                                                                                                                         |
| Spaces and layouts   | Panel sizes, terminal variables and the settings this project shares                                                                                                                                          |
| Keys                 | Every [keyboard shortcut](./keyboard-shortcuts.md). Click a binding to change it                                                                                                                              |
| Extensions and tools | [MCP servers](./mcp-servers.md), [skills](./agents/skills.md) and [extensions](./extensions.md)                                                                                                               |

**export** writes your settings to a file, **import** reads such a file back in, and **reset all** restores every default. Custom themes and API keys are not touched by a reset.

## Editor

| Setting                  | Default         | Notes                                             |
| ------------------------ | --------------- | ------------------------------------------------- |
| Font Size                | 14              |                                                   |
| Font Family              | JetBrains Mono  | Pick any installed font from the font manager     |
| Tab Size                 | 2               |                                                   |
| Insert Spaces            | On              |                                                   |
| Word Wrap                | Off             |                                                   |
| Vim Mode                 | Off             | Vim keybindings in the editor                     |
| Auto Save                | On focus change | Off, on focus change or after a delay             |
| Auto Save Delay          | 1000 ms         | Used when auto save waits for a delay             |
| Format on Save           | Off             |                                                   |
| Trim Trailing Whitespace | Off             |                                                   |
| Insert Final Newline     | Off             |                                                   |
| Sticky Lines             | Off             | Keeps the enclosing scope visible while scrolling |
| Line Numbers             | On              |                                                   |

**Display** has the finer settings: line height (1.6), font weight (400), letter spacing, padding, ligatures, cursor style and blinking, whitespace, rulers, indent guides, bracket pair colors, the current line, scroll past end, the markers in the scroll bar, and **Mark lines an agent wrote**, which colors the gutter of lines an agent changed in its worktree.

## Terminal

| Setting             | Default        | Notes                                                                               |
| ------------------- | -------------- | ----------------------------------------------------------------------------------- |
| Default Shell       | System default | Path to the shell. Empty uses the default of the operating system                   |
| Font Size           | 13             |                                                                                     |
| Font Family         | JetBrains Mono |                                                                                     |
| Scrollback          | 10000 lines    | Between 1000 and 100000                                                             |
| Cursor Style        | Block          |                                                                                     |
| Copy on Select      | Off            | Copies selected text right away                                                     |
| Restore Scrollback  | Off            | Also restores the output after a restart. Tabs, splits and folders always come back |
| Command Suggestions | On             | AI suggestions while you type, with the model from **Settings > Editor > Models**   |

## Appearance

Themes are described in the [theming guide](./theming.md). **Interface** sets how large and dense the UI is, independent of the theme:

| Setting  | Default | Notes                                                                               |
| -------- | ------- | ----------------------------------------------------------------------------------- |
| Density  | Default | Compact, Default or Comfortable. Scales the height of rows, tabs and bars           |
| UI Scale | 100%    | 80% to 150%. Scales the text and sizes of the UI, not the editor and terminal fonts |
| UI Font  | Default | Any installed font                                                                  |

`Cmd/Ctrl + Plus`, `Cmd/Ctrl + Minus` and `Cmd/Ctrl + 0` change and reset the UI scale. While the editor or a terminal has focus, the same keys change their font size instead.

The **Editor** section gives the editor and the terminals their own colors:

- **Editor Theme** uses the editor and syntax colors of another theme, so a light editor can sit in a dark UI and the other way round.
- **Terminal Theme** does the same for the terminal colors.
- **Editor Colors** overrides the editor background or single syntax colors. Overrides stay when you switch themes and can be reset one by one.

### Accessibility

| Setting                            | Default       | Notes                                                                                 |
| ---------------------------------- | ------------- | ------------------------------------------------------------------------------------- |
| Reduce Motion                      | Follow system | Follows the system setting or forces it on or off. Removes transitions and animations |
| Always Show Focus Outlines         | Off           | A thick outline on the focused control, also after mouse clicks                       |
| Color Blind Friendly Status Colors | Off           | Git, diff and status colors that stay apart with red-green color blindness            |

Status is never shown by color alone. The file tree and the Git panel show a letter per file, diffs mark lines with `+` and `-`, and in the editor gutter deleted lines use a triangle. For low vision, pick High Contrast Dark or High Contrast Light.

## Spaces and layouts

This category holds what belongs to the open project:

- **Panels**: **Reset Layout** restores the panel sizes.
- **Terminal environment**: variables that every terminal of this project starts with.
- **Editor**: tab size and rulers for this project only.
- **Agent**: where [writing sessions](./agents/worktrees.md#choose-where-writing-sessions-work), [coding CLI launches](./agents/coding-clis.md#run-several-clis-side-by-side), [parallel tasks](./agents/tasks.md#start-tasks-in-parallel) and [child sessions](./agents/child-sessions.md#environments) work, and a step limit for the project.
- **Language servers**: per-project overrides.
- **Folder trust**: see below.
- **Coding CLI sync**: see [Sync .pragma to coding CLI folders](./agents/coding-clis.md#sync-pragma-to-coding-cli-folders).

The project settings are stored in `.pragma/settings.json` in the project, so everyone who opens the folder gets them.

### Folder trust

A folder you do not trust opens in **Restricted mode**: it runs no extensions, worktree scripts, language servers, run configurations or debugger, and its allowed commands still ask first. The section shows whether the folder is trusted, and what a trusted folder runs: its **Extensions** when the folder opens, and its **Worktree scripts** when a session gets its own worktree.

## Where Pragma stores data

- **App settings** are kept by the settings store under the key `pragma.settings.v1` and shared between Pragma windows.
- **MCP servers** are stored in `mcp.json` in the app config folder.
- **Extensions** live per project in `<project>/.pragma/extensions/`.
- **Project settings** live in `<project>/.pragma/settings.json`.

| Platform | App config folder                               |
| -------- | ----------------------------------------------- |
| Linux    | `~/.config/dev.pragma.ide/`                     |
| macOS    | `~/Library/Application Support/dev.pragma.ide/` |
| Windows  | `%APPDATA%\dev.pragma.ide\`                     |

API keys are never written to these files. They live in the keychain of the operating system.
