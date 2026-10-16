# Configuration

Pragma is configured through the in-app settings panel. Open it with `Cmd/Ctrl + ,` or from the command palette, then pick a category in the left column.

| Category   | What it controls                                           |
| ---------- | ---------------------------------------------------------- |
| Editor     | Font, indentation, VIM mode, auto save and formatting      |
| Terminal   | Shell, font, scrollback and AI command suggestions         |
| Agents     | AI provider, model, inline completion and CLI integration  |
| Appearance | Themes, density, UI scale and interface font               |
| MCP        | Model Context Protocol servers                             |
| Languages  | Language servers (LSP) per language                        |
| Extensions | Workspace extensions and their contributed commands/panels |
| Layout     | Panel sizes and status bar items                           |
| Keyboard   | Keyboard shortcut bindings                                 |
| About      | Version, updates and license                               |

## Editor

| Setting                | Default         | Notes                                             |
| ---------------------- | --------------- | ------------------------------------------------- |
| VIM mode               | Off             | Enables VIM keybindings in the editor             |
| Font size              | 14              |                                                   |
| Font family            | JetBrains Mono  | Selectable from the font manager                  |
| Tab size               | 2               |                                                   |
| Insert spaces          | On              |                                                   |
| Word wrap              | Off             |                                                   |
| Line numbers           | On              |                                                   |
| Auto save              | On focus change | Off, on focus change or after a delay             |
| Auto save delay        | 1000 ms         | Used when auto save is set to after a delay       |
| Format on save         | Off             |                                                   |
| Sticky lines           | Off             | Keeps the enclosing scope visible while scrolling |
| Font weight            | 400             | 100 to 900                                        |
| Letter spacing         | 0 px            | -2 to 4 px                                        |
| Editor padding         | 8 px            | Space above and below the text, 0 to 48 px        |
| Highlight current line | Off             |                                                   |
| Scroll past end        | Off             | Lets the last line scroll up to the top           |

## Terminal

| Setting             | Default        | Notes                                                   |
| ------------------- | -------------- | ------------------------------------------------------- |
| Default shell       | System default | Path to the shell executable; empty uses the OS default |
| Font size           | 13             |                                                         |
| Font family         | JetBrains Mono |                                                         |
| Scrollback          | 10000 lines    | Clamped between 1000 and 100000                         |
| Command suggestions | On             | AI-powered suggestions while typing                     |

## Appearance

Themes are described in the [Theming Guide](./theming.md). The **Interface** section sets how large and dense the UI is, independently of the theme. **Reset to Default** restores all three settings.

| Setting  | Default | Notes                                                                                       |
| -------- | ------- | ------------------------------------------------------------------------------------------- |
| Density  | Default | Compact, Default or Comfortable; scales row, tab and bar heights and spacing                |
| UI scale | 100%    | 80% to 150% in steps of 10; scales UI text and sizes, not the editor and terminal font size |
| UI font  | Geist   | Any installed font or a custom font name; empty uses the default                            |

`Cmd/Ctrl + Plus`, `Cmd/Ctrl + Minus` and `Cmd/Ctrl + 0` change and reset the UI scale. While the editor or a terminal has focus, the same keys change their own font size instead.

The **Editor** section gives the editor and the terminals their own colors:

- **Editor theme**: "Same as UI theme" (default) or the editor and syntax colors of any other theme, so a light editor can sit in a dark UI and the other way round. It changes the editor, its gutters and the diff views, not the UI.
- **Terminal theme**: "Same as UI theme" or the terminal colors of another theme.
- **Colors**: override the editor background or single syntax colors (keywords, strings, comments, functions, variables, numbers, types, tags, attributes, properties and operators). Overrides are kept when you switch themes and can be reset one by one or all at once.

The **Background** section shows an image behind the interface and lets it, or the desktop, show through:

| Setting              | Default       | Notes                                                                                                           |
| -------------------- | ------------- | --------------------------------------------------------------------------------------------------------------- |
| Background image     | None          | PNG, JPEG, WebP or GIF up to 25 MB; Pragma copies it into its application data directory                        |
| Fit and position     | Cover, center | Cover, contain, tile or center; center, top, bottom, left or right                                              |
| Blur                 | 0 px          | 0 to 40 px                                                                                                      |
| Dim                  | 60%           | How much of the theme's background color covers the image                                                       |
| Transparency         | 0%            | How much the background shows through sidebar, panels and bars, up to 80%; limited so text keeps 4.5:1 contrast |
| Transparent editor   | Off           | Lets the background show through the editor too                                                                 |
| Transparent terminal | Off           | Lets the background show through terminals opened after the change                                              |
| Window translucency  | Off           | macOS vibrancy (Sidebar, Under Window, HUD) or Windows Mica or Acrylic; takes effect after a restart            |

Menus and dialogs stay opaque. Window translucency is not available on Linux.

### Repository colors

Every open repository gets its own color, handed out from a fixed palette in the order repositories are opened. It shows as a small dot wherever a repository is named: the workspace menu and title bar, the repository overview, thread groups, pane headers, terminal tabs, editor tabs of other repositories, the explorer's repository folders and the git panel. With one repository open, the dot only shows once you pick a color yourself.

Change the active repository's color with **Repository Color** in the workspace menu: **Automatic**, a preset or a custom color. **Use as Accent Color** makes the active repository's color the accent color while it is active, adjusted for contrast like the accent color. Repository colors are personal settings stored per repository path in the app settings, not in `.pragma/settings.json`.

### Accessibility

| Setting                            | Default       | Notes                                                                                                           |
| ---------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------- |
| Reduce motion                      | Follow System | Follows the operating system's reduce motion setting or forces it on or off; removes transitions and animations |
| Always show focus outlines         | Off           | A thick outline on the focused control, also after mouse clicks                                                 |
| Color blind friendly status colors | Off           | Git, diff and status colors that stay apart with red-green color vision deficiency                              |

Status is never shown by color alone: the explorer and the git panel show a letter per file, diff views mark lines with `+` and `-`, and in the editor gutter deleted lines use a triangle. With color blind friendly colors on, modified lines also get a striped marker. For low vision, pick High Contrast Dark or High Contrast Light.

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
