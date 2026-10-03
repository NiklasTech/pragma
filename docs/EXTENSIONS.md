# Pragma Extensions

Pragma supports sandboxed JavaScript extensions per workspace. Extensions live in
`<workspace>/.pragma/extensions/<id>/` and run inside a sandboxed iframe
(`sandbox="allow-scripts"`, no same-origin access), communicating with the host
through a typed `postMessage` bridge. An extension can never crash the host: a
broken manifest or a runtime failure marks the extension as errored in the
Extension Manager (Settings > Extensions) and everything else keeps working.

## Directory layout

```
.pragma/extensions/hello-world/
  manifest.json   (required)
  main.js         (entry point, "main" in the manifest, default main.js)
  theme.json      (optional assets, referenced from the manifest)
```

Install an extension with Settings > Extensions > "Install from Folder" (copies
the folder into `.pragma/extensions/`) or by placing the folder there manually
and pressing "Reload".

## Manifest (`pragma-extension-v1`)

```json
{
  "format": "pragma-extension-v1",
  "id": "hello-world",
  "name": "Hello World",
  "version": "0.1.0",
  "description": "A minimal example extension",
  "main": "main.js",
  "contributes": {
    "commands": [{ "id": "hello", "title": "Hello: Say Hello", "category": "Examples" }],
    "themes": [{ "path": "theme.json" }],
    "panels": [
      {
        "id": "greeting",
        "title": "Greeting",
        "icon": "puzzle-piece",
        "html": "<p>Hello from an extension panel.</p>"
      }
    ],
    "keybindings": [{ "command": "hello", "key": "ctrl+alt+h", "mac": "cmd+alt+h" }]
  }
}
```

- `id`: 1-64 lowercase letters, numbers, hyphens. All contributed ids are
  namespaced by the host as `ext:<id>:<contributionId>`.
- `contributes.commands`: shown in the command palette. Running one sends a
  `command` event to the extension (see `pragma.onCommand`).
- `contributes.themes`: inline theme objects (`pragma-theme-v1`) or
  `{ "path": "theme.json" }` relative to the extension folder. Theme ids are
  prefixed automatically.
- `contributes.panels`: sidebar views under the Extensions sidebar tab. `icon`
  is one of: `puzzle-piece`, `chart-line`, `note`, `list-bullets`, `globe`,
  `star`, `heart`, `lightning`, `terminal`, `git-branch`, `calendar-blank`.
  `html` is rendered in a sandboxed iframe with the current theme CSS variables
  available (e.g. `var(--bg-root)`, `var(--fg-default)`).
- `contributes.keybindings`: runs a command of the extension. See
  [Keybindings](#keybindings) for the key format.

## Runtime API

`main.js` runs with a global `pragma` object. Type declarations for extension
authors are in [docs/pragma-extension.d.ts](./pragma-extension.d.ts).

```js
// commands registered in the manifest fire here
pragma.onCommand(({ commandId }) => {
  if (commandId === "hello") {
    pragma.notifications.show("Hello from the extension!", "success");
  }
});

// dynamic command registration
await pragma.commands.register({ id: "bye", title: "Hello: Say Goodbye" });

// themes (validated against pragma-theme-v1, id is prefixed automatically)
await pragma.themes.register({ format: "pragma-theme-v1", metadata: { id: "my-theme", name: "My Theme" }, ... });

// sidebar panels
await pragma.panels.register({ id: "status", title: "Status", html: "<p>live panel</p>" });

// per-extension persisted settings (JSON-serializable)
const previous = await pragma.settings.get();
await pragma.settings.set({ runs: (previous?.runs ?? 0) + 1 });

// read-only editor access
const file = await pragma.editor.getActiveFile();
// -> { path, name, language, cursor: { line, column } } or null

// active editor buffer (v2)
const text = await pragma.editor.getText();
await pragma.editor.setText("replaced buffer contents");
const cursor = await pragma.editor.getSelection();
// -> { line, column } of the active cursor, or null

// workspace file access (v2), paths relative to the workspace root
const doc = await pragma.workspace.readFile("notes/todo.md");
// -> { path, name, content }
await pragma.workspace.writeFile("notes/todo.md", doc.content + "\n- new item");
const entries = await pragma.workspace.list("notes");
// -> [{ path, name, isDirectory }]
```

All `pragma.*` methods return promises and time out after 5 seconds
(`terminal.sendText` waits up to 15 seconds for a new shell to start).

### Events

`pragma.on(event, handler)` subscribes to editor and workspace events and returns
a function that unsubscribes.

| Event               | Data                                         | When                                                    |
| ------------------- | -------------------------------------------- | ------------------------------------------------------- |
| `workspaceOpened`   | `{ root }`                                   | Once after the extension starts                         |
| `activeFileChanged` | `{ path, name, language, cursor }` or `null` | The active editor tab changes                           |
| `fileSaved`         | `{ path, language }`                         | A file is saved from the editor                         |
| `sessionFinished`   | `{ sessionId, title, status }`               | A chat or agent run ends (`done`, `error`, `cancelled`) |

```js
pragma.on("fileSaved", ({ path }) => pragma.notifications.show(`Saved ${path}`));
```

### Status bar items

```js
await pragma.statusBar.set({
  id: "words",
  text: "120 words",
  tooltip: "Words in the active file",
  command: "count-words", // optional, runs on click
  alignment: "right", // or "left"
});
await pragma.statusBar.remove("words");
```

Setting an item with an existing id replaces it. An extension can show up to 10
items.

### Keybindings

```js
await pragma.keybindings.register({ command: "count-words", key: "ctrl+alt+w", mac: "cmd+alt+w" });
```

Keys are `+`-separated: modifiers `ctrl`, `alt`, `shift`, `cmd`/`meta` and `mod`
(Cmd on macOS, Ctrl elsewhere), then a letter, digit, punctuation, `enter`,
`escape`, `tab`, `space`, arrow keys or `f1`-`f12`. A binding needs `ctrl`,
`alt` or `cmd` unless it is a function key. Pragma's own shortcuts win: a binding
that conflicts with one of them (Settings > Keyboard) is ignored.

### Diagnostics and completions

Providers are registered per Pragma language id (`typescript`, `python`,
`markdown`, ...) or `"*"` for every language. Both return a function that
unregisters the provider.

```js
await pragma.languages.registerDiagnosticsProvider("markdown", (document) =>
  document.text.includes("TODO")
    ? [{ line: 1, column: 1, message: "Contains a TODO", severity: "info" }]
    : [],
);

await pragma.languages.registerCompletionProvider(
  "markdown",
  ({ prefix }) => [{ label: "pragma", detail: "Pragma IDE", kind: "keyword" }],
  { triggerCharacters: [":"] },
);
```

Diagnostics run when the active file changes, while it is edited (debounced)
and after it is saved. They appear in the editor and the Problems panel with the
source `ext:<id>`. Completions join the language server's completions. A
provider must answer within 5 seconds (diagnostics) or 1.5 seconds
(completions); a slow or failing provider is skipped.

### Agent tools

```js
await pragma.agent.registerTool(
  {
    name: "count_words",
    description: "Count the words of a workspace file",
    inputSchema: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    },
    readOnly: true,
  },
  async ({ path }) => {
    const file = await pragma.workspace.readFile(path);
    return { words: file.content.split(/\s+/).filter(Boolean).length };
  },
);
```

Agents see the tool as `ext__<extension id>__<name>` (at most 64 characters).
Built-in agents in Agent Mode and child sessions offer it, and coding CLIs that
use ACP get it through Pragma's MCP bridge. Tools that are not `readOnly` follow
the same approval rules as Pragma's own tools: they ask for approval unless
Auto-approve is on or the agent settings approve all actions. The handler has 60
seconds; its return value (a string or JSON) becomes the tool result.

### Terminal

```js
const terminal = await pragma.terminal.create({ name: "Build", cwd: "packages/app" });
await pragma.terminal.sendText(terminal.id, "pnpm build");
```

`cwd` is relative to the workspace root. An extension can only write to
terminals it created.

### Workspace file access (v2)

`pragma.workspace.readFile`, `writeFile` and `list` accept paths relative to the
workspace root. The host resolves every path against the root and rejects
absolute paths, `..` traversal and symlinks that point outside the workspace.
Writes go through the same local-history snapshots as the agent, so replacing an
existing file stays undoable.

### Editor access (v2)

`editor.getText` returns the active editor buffer (or `null` when no file is
open), `editor.setText` replaces the buffer through the editor store (the tab is
marked modified; nothing is written to disk until the user saves) and
`editor.getSelection` returns the active cursor position. The host does not track
a selection range, so `getSelection` reports the cursor anchor only.

## Bridge protocol (host side)

- Extension to host: `{ kind: "request", id, method, params }`, answered with
  `{ kind: "response", id, ok, result | error }`.
- Host to extension: `{ kind: "event", event, data }` for commands and the
  events above, and `{ kind: "call", id, method, params }` when the host needs an
  answer (diagnostics, completions, agent tool calls). The extension replies with
  `{ kind: "result", id, ok, result | error }`; the SDK does this for registered
  providers and tools.
- Every message is validated before acting; requests from unknown sources are
  ignored.

## Settings storage

Per-extension state is persisted under the `extensions` key of the settings
store (`pragma.settings.v1`): `Record<extensionId, { enabled, settings }>`.
Disabling an extension tears down its iframe and unregisters all of its
commands, panels, status bar items, keybindings, providers, diagnostics and agent
tools; contributed themes stay installed.
