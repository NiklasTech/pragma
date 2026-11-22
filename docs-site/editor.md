# Editor

The code tab is a complete editor built on CodeMirror 6. It shares the project, the terminal and the AI accounts with the agents tabs, so you can take over from an agent at any time. `Cmd/Ctrl + Shift + E` switches between the agents tab you used last and the code tab.

## Files and tabs

- **Files** in the sidebar is the file tree of the project. Right-click a file for actions such as rename, delete, **file history** and **local history**.
- **go to** (`Cmd/Ctrl + P`) opens any file by name, see [Go to](./window.md#go-to).
- `Cmd/Ctrl + \` splits the editor, and `Cmd/Ctrl + Shift + V` opens the preview panel.
- `Cmd/Ctrl + Shift + T` reopens the tab you closed last.
- When an open file changes on disk, for example because an agent wrote it, a notice above the editor offers to reload it, keep your version, compare the two or close the tab.

## Search

- `Cmd/Ctrl + F` searches the open file, and the replace field opens with `Cmd + Option + F` on macOS or `Ctrl + H` on Windows and Linux.
- **Search** in the sidebar (`Cmd/Ctrl + Shift + F`) searches and replaces across the project.

## Language servers

Pragma starts a language server for each language it supports and offers completion, hover, go to definition, peek definition, references, rename, formatting, signature help, code actions, inlay hints, folding and an outline. `Cmd/Ctrl + Shift + M` shows the **Problems** panel with the diagnostics of every server.

Language servers are programs of their own. **Settings > Editor > Language Servers** shows which ones are installed and copies the install command of a missing one. The same section turns language servers and inlay hints on or off. See [Language servers are unavailable](./troubleshooting.md#language-servers-are-unavailable) when one does not start.

## AI in the editor

These features use the provider and API key from **Settings > Editor > Models**, see [API keys](./ai-providers.md#api-keys).

- **Inline completion** shows a suggestion as gray text while you type. `Tab` accepts it.
- **Edit Selection with AI** (`Cmd/Ctrl + L`) rewrites the selected code from your instruction and shows the result as a diff beside the original, which you accept or reject.
- **Toggle AI Chat** (`Cmd/Ctrl + Shift + A`) opens a chat next to the code. Type `@` to add files and folders to the message.

## Vim mode

Turn on **Vim Mode** in **Settings > Editor** for Vim keybindings in the editor. The terminal and the rest of the app keep their usual keys.
