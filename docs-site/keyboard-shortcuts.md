# Keyboard Shortcuts

Pragma ships with a default keymap. `Cmd` refers to the macOS Command key; on Windows and Linux the same binding uses `Ctrl`.

## File

| Action      | Default        |
| ----------- | -------------- |
| Open File   | `Cmd/Ctrl + O` |
| Open Folder | None           |
| Save File   | `Cmd/Ctrl + S` |
| Close Tab   | `Cmd/Ctrl + W` |
| Go to File  | `Cmd/Ctrl + P` |

## Edit

| Action                 | Default           |
| ---------------------- | ----------------- |
| Edit Selection with AI | `Cmd/Ctrl + L`    |
| Format Document        | `Shift + Alt + F` |

## View

| Action                 | Default                |
| ---------------------- | ---------------------- |
| Toggle Sidebar         | `Cmd/Ctrl + B`         |
| Toggle Terminal        | `Cmd/Ctrl + Shift + T` |
| New Terminal Tab       | `Cmd/Ctrl + T`         |
| Open Settings          | `Cmd/Ctrl + ,`         |
| Open Command Palette   | `Cmd/Ctrl + Shift + P` |
| Toggle Agents / Editor | `Cmd/Ctrl + Shift + E` |
| Split Editor           | `Cmd/Ctrl + \`         |
| Toggle Problems        | `Cmd/Ctrl + Shift + M` |
| Toggle Preview         | `Cmd/Ctrl + Shift + V` |
| Switch to Agents       | None                   |
| Switch to Editor       | None                   |
| Next Tab               | `Ctrl + Tab`           |
| Previous Tab           | `Ctrl + Shift + Tab`   |

## Search

| Action          | Default                |
| --------------- | ---------------------- |
| Find in Files   | `Cmd/Ctrl + Shift + F` |
| Find in File    | `Cmd/Ctrl + F`         |
| Replace in File | `Cmd/Ctrl + H`         |

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

## Customize shortcuts

1. Open **Settings > Keyboard**.
2. Select the action you want to change.
3. Record a new binding in the dialog. Press `Escape` to cancel.
4. If the binding conflicts with another action, Pragma reports the conflict before it is saved.

Each action can be reset to its default, and all shortcuts can be reset at once. Editor VIM keybindings are separate and configured with the VIM mode toggle in the editor settings.
