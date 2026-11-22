<script setup>
import ShortcutTable from "./.vitepress/components/ShortcutTable.vue";
</script>

# Keyboard shortcuts

These are the default shortcuts. The tables are built from the keymap in Pragma's source code, so they always match the app. Change any shortcut in **Settings > Keys**.

<ShortcutTable />

## Inside a terminal

On macOS a terminal keeps the keys of Terminal.app while it has focus. They win over the app shortcuts above.

| Keys        | Action                                      |
| ----------- | ------------------------------------------- |
| `⌘K`        | Clear the terminal                          |
| `⌘C` / `⌘V` | Copy and paste                              |
| `⌘A`        | Select everything in the terminal           |
| `⌘←` / `⌘→` | Jump to the start or end of the line        |
| `⌥←` / `⌥→` | Jump one word back or forward               |
| `⌘⌫` / `⌥⌫` | Delete to the start of the line or one word |

On Windows and Linux, clear the terminal from its `⋯` menu or the right-click menu. The same menus have **Find**, **Copy all output**, **Split right** and **Close panel**.

`Cmd + Click` on macOS or `Ctrl + Click` on Windows and Linux opens what is under the pointer in any terminal, including coding CLI sessions:

- **File paths** open in the editor, at the line and column when the path has one, for example `src/app.tsx:12:5` or `src/lib.rs(7,3)`. Relative paths are resolved against the terminal's working directory. Absolute paths, `~/` and Windows paths work too.
- **URLs** open in the browser.

A plain click only selects text.

## Letter keys in menus

Right-click menus of agents, tabs and terminals show a letter next to each action. While the menu is open, pressing that letter runs the action, so `r` renames and `w` closes a tab.

## Change a shortcut

1. Open **Settings > Keys**.
2. Click the binding of the action you want to change.
3. Press the new keys. `Escape` cancels.
4. If the keys are already taken, Pragma names the other action before it saves.

Each action can be reset to its default, and all shortcuts can be reset at once. On macOS the menu bar shows your shortcuts and uses them too.

When a default changes in an update, a shortcut you never changed moves to the new default. A shortcut you set yourself is kept. Vim keybindings in the editor are separate and are turned on with **Vim Mode** in **Settings > Editor**.
