# Keyboard Shortcuts

Pragma ships with a default keymap. `Cmd` refers to the macOS Command key; on Windows and Linux the same binding uses `Ctrl`. Where macOS and the other platforms differ, both bindings are listed.

## File

| Action            | Default                |
| ----------------- | ---------------------- |
| Open File         | `Cmd/Ctrl + O`         |
| Open Folder       | None                   |
| Save File         | `Cmd/Ctrl + S`         |
| Close Tab         | `Cmd/Ctrl + W`         |
| Reopen Closed Tab | `Cmd/Ctrl + Shift + T` |
| Go to File        | `Cmd/Ctrl + P`         |

## Edit

| Action                 | Default           |
| ---------------------- | ----------------- |
| Edit Selection with AI | `Cmd/Ctrl + L`    |
| Format Document        | `Shift + Alt + F` |

## View

| Action                 | Default                                           |
| ---------------------- | ------------------------------------------------- |
| Toggle Sidebar         | `Cmd/Ctrl + B`                                    |
| Toggle Terminal        | macOS `Cmd + J`, Windows and Linux `` Ctrl + ` `` |
| New Terminal Tab       | `Cmd/Ctrl + T`                                    |
| Open Settings          | `Cmd/Ctrl + ,`                                    |
| Open Command Palette   | `Cmd/Ctrl + Shift + P`                            |
| Toggle Agents / Editor | `Cmd/Ctrl + Shift + E`                            |
| Split Editor           | `Cmd/Ctrl + \`                                    |
| Toggle Problems        | `Cmd/Ctrl + Shift + M`                            |
| Toggle Preview         | `Cmd/Ctrl + Shift + V`                            |
| Switch to Agents       | `Cmd/Ctrl + 2`                                    |
| Switch to Editor       | `Cmd/Ctrl + 1`                                    |
| Next Tab               | `Ctrl + Tab`                                      |
| Previous Tab           | `Ctrl + Shift + Tab`                              |
| Zoom In (UI scale)     | `Cmd/Ctrl + Plus`                                 |
| Zoom Out (UI scale)    | `Cmd/Ctrl + Minus`                                |
| Reset Zoom (UI scale)  | `Cmd/Ctrl + 0`                                    |

## Search

| Action          | Default                                                |
| --------------- | ------------------------------------------------------ |
| Find in Files   | `Cmd/Ctrl + Shift + F`                                 |
| Find in File    | `Cmd/Ctrl + F`                                         |
| Replace in File | macOS `Cmd + Option + F`, Windows and Linux `Ctrl + H` |

## AI and chat

| Action            | Default                |
| ----------------- | ---------------------- |
| Toggle AI Chat    | `Cmd/Ctrl + Shift + A` |
| Toggle Agent Mode | None                   |
| Send Chat Message | `Enter`                |

## Debugging

| Action                     | Default       |
| -------------------------- | ------------- |
| Start / Continue Debugging | `F5`          |
| Stop Debugging             | `Shift + F5`  |
| Step Over                  | `F10`         |
| Step Into                  | `F11`         |
| Step Out                   | `Shift + F11` |
| Toggle Breakpoint          | `F9`          |

## Terminal links

In every terminal, including coding CLI sessions such as Claude Code, `Cmd + Click` on macOS or `Ctrl + Click` on Windows and Linux opens what is under the pointer:

- **File paths** open in the editor, at the line and column when the path has one, for example `src/app.tsx:12:5` or `src/lib.rs(7,3)`. Relative paths are resolved against the terminal's working directory; absolute paths, `~/` and Windows paths work too.
- **URLs** open in the browser.

A plain click only selects text.

## Customize shortcuts

1. Open **Settings > Keyboard**.
2. Select the action you want to change.
3. Record a new binding in the dialog. Press `Escape` to cancel.
4. If the binding conflicts with another action, Pragma reports the conflict before it is saved.

Each action can be reset to its default, and all shortcuts can be reset at once. On macOS the menu bar shows your shortcuts and uses them too.

When a default changes in an update, a shortcut you never changed moves to the new default. A shortcut you set yourself is kept. Editor VIM keybindings are separate and configured with the VIM mode toggle in the editor settings.
