# Configuration

Pragma is configured through the in-app settings panel. Open it with `Cmd/Ctrl + ,` or from the command palette, then pick a category in the left column.

| Category   | What it controls                                           |
| ---------- | ---------------------------------------------------------- |
| Editor     | Font, indentation, VIM mode, auto save and formatting      |
| Terminal   | Shell, font, scrollback and AI command suggestions         |
| Agents     | AI provider, model, inline completion and CLI integration  |
| Theme      | Color mode, built-in themes and custom theme import        |
| MCP        | Model Context Protocol servers                             |
| Languages  | Language servers (LSP) per language                        |
| Extensions | Workspace extensions and their contributed commands/panels |
| Layout     | Panel sizes and status bar items                           |
| Keyboard   | Keyboard shortcut bindings                                 |
| About      | Version, updates and license                               |

## Editor

| Setting         | Default         | Notes                                             |
| --------------- | --------------- | ------------------------------------------------- |
| VIM mode        | Off             | Enables VIM keybindings in the editor             |
| Font size       | 14              |                                                   |
| Font family     | JetBrains Mono  | Selectable from the font manager                  |
| Tab size        | 2               |                                                   |
| Insert spaces   | On              |                                                   |
| Word wrap       | Off             |                                                   |
| Line numbers    | On              |                                                   |
| Auto save       | On focus change | Off, on focus change or after a delay             |
| Auto save delay | 1000 ms         | Used when auto save is set to after a delay       |
| Format on save  | Off             |                                                   |
| Sticky lines    | Off             | Keeps the enclosing scope visible while scrolling |

## Terminal

| Setting             | Default        | Notes                                                   |
| ------------------- | -------------- | ------------------------------------------------------- |
| Default shell       | System default | Path to the shell executable; empty uses the OS default |
| Font size           | 13             |                                                         |
| Font family         | JetBrains Mono |                                                         |
| Scrollback          | 10000 lines    | Clamped between 1000 and 100000                         |
| Command suggestions | On             | AI-powered suggestions while typing                     |

## Agents

See [AI Provider Setup](./ai-providers.md) for provider and model configuration. The Agents category also contains:

- Inline completion toggle and debounce (default 500 ms).
- Terminal suggestion provider and model.
- Agent mode with an auto-approve policy (`never`, `edits`, `all`), disabled by default.

## Languages

Language servers are enabled per language. Enabled by default: TypeScript, JavaScript, Rust, Python, Go, Java, C, C++, HTML and CSS. LSP is an experimental feature and can be disabled globally under the experimental settings.

## Layout and status bar

- Sidebar width, terminal height and chat panel width are stored as layout settings. A reset action restores the panel sizes to their defaults.
- The status bar can be hidden, and its items reordered: VIM mode, cursor, file type, encoding, end-of-line, Git branch, Git sync, problems, AI provider and theme.

## Import, export and reset

- **Export** writes the current settings to a file; **Import** merges a previously exported file back in.
- **Reset Defaults** restores all settings to their default values. Custom themes and API keys are not affected.

## Where Pragma stores data

- **Application settings** are persisted by the settings store under the `pragma.settings.v1` key and synchronized across Pragma windows.
- **Onboarding state** is stored in a Tauri store named `app.dat`.
- **MCP server configuration** is stored in `mcp.json`.
- **Extensions** live per workspace in `<workspace>/.pragma/extensions/`.

The Tauri store and `mcp.json` live in Pragma's application config directory, which is derived from the bundle identifier `dev.pragma.ide`:

| Platform | Location                                        |
| -------- | ----------------------------------------------- |
| Linux    | `~/.config/dev.pragma.ide/`                     |
| macOS    | `~/Library/Application Support/dev.pragma.ide/` |
| Windows  | `%APPDATA%\dev.pragma.ide\`                     |

API keys are never written to these files. They are stored in the operating system keychain.
