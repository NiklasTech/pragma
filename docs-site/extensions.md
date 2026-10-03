# Extensions

Extensions add commands, themes and sidebar panels to Pragma. They are small JavaScript packages that live in the workspace and run in a sandbox, so a broken extension can never crash the editor.

## Install an extension

Extensions are installed per workspace in `<workspace>/.pragma/extensions/<id>/`. Manage them in **Settings > Extensions**:

- **Install from Folder** copies an extension folder into `.pragma/extensions/`.
- **Open Folder** opens `.pragma/extensions/` in your file manager, so you can place extensions there yourself.
- **Reload** picks up extensions that were added or changed on disk.
- The switch next to each extension enables or disables it.

An extension with a broken manifest or a runtime error is marked as errored in the list; everything else keeps working. Disabling an extension removes its commands and panels. Themes it contributed stay installed.

Extension panels appear in the **Extensions** view of the sidebar, and extension commands in the command palette.

## Write an extension

An extension is a folder with a manifest and an entry script:

```
.pragma/extensions/hello-world/
  manifest.json   required
  main.js         entry point, "main" in the manifest, default main.js
  theme.json      optional assets referenced from the manifest
```

### Manifest

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
    ]
  }
}
```

| Field                  | Description                                                                                                                  |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `id`                   | 1 to 64 lowercase letters, numbers and hyphens. Contributed ids are namespaced as `ext:<id>:<contributionId>`                |
| `contributes.commands` | Shown in the command palette. Running one sends a `command` event to the extension                                           |
| `contributes.themes`   | Inline `pragma-theme-v1` themes, or `{ "path": "theme.json" }` relative to the extension folder. See [Theming](./theming.md) |
| `contributes.panels`   | Sidebar panels. `html` is rendered in a sandboxed frame with the theme CSS variables available, such as `var(--bg-root)`     |

Panel icons: `puzzle-piece`, `chart-line`, `note`, `list-bullets`, `globe`, `star`, `heart`, `lightning`, `terminal`, `git-branch`, `calendar-blank`.

### Runtime API

`main.js` runs with a global `pragma` object. Every method returns a promise and times out after 5 seconds. Type declarations are in [`docs/pragma-extension.d.ts`](https://github.com/NiklasTech/pragma/blob/main/docs/pragma-extension.d.ts).

```js
// Commands from the manifest arrive here.
pragma.onCommand(({ commandId }) => {
  if (commandId === "hello") {
    pragma.notifications.show("Hello from the extension!", "success");
  }
});

// Register commands, themes and panels at runtime.
await pragma.commands.register({ id: "bye", title: "Hello: Say Goodbye" });
await pragma.panels.register({ id: "status", title: "Status", html: "<p>live panel</p>" });

// Settings for this extension, persisted as JSON.
const previous = await pragma.settings.get();
await pragma.settings.set({ runs: (previous?.runs ?? 0) + 1 });

// The active editor.
const file = await pragma.editor.getActiveFile(); // { path, name, language, cursor } or null
const text = await pragma.editor.getText();
await pragma.editor.setText("replaced buffer contents");
const cursor = await pragma.editor.getSelection(); // { line, column } or null

// Workspace files, with paths relative to the workspace root.
const doc = await pragma.workspace.readFile("notes/todo.md");
await pragma.workspace.writeFile("notes/todo.md", doc.content + "\n- new item");
const entries = await pragma.workspace.list("notes"); // [{ path, name, isDirectory }]
```

| API                          | Notes                                                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `pragma.editor.setText`      | Replaces the buffer and marks the tab as modified; nothing is saved until the user saves                                              |
| `pragma.editor.getSelection` | Returns the cursor position only, not a selection range                                                                               |
| `pragma.workspace.*`         | Absolute paths, `..` and symlinks that leave the workspace are rejected. Writes create local history snapshots, so they can be undone |

## Security model

Each extension runs in an iframe with `sandbox="allow-scripts"` and no same-origin access. It talks to Pragma only through a message bridge: Pragma validates every request, ignores messages from unknown sources and answers with a result or an error. An extension has no access to Pragma's window, storage or desktop APIs; files and the editor are only reachable through the `pragma` API above.

Per-extension state is stored under the `extensions` key of Pragma's settings.

The full reference for extension authors, including the bridge protocol, is in [`docs/EXTENSIONS.md`](https://github.com/NiklasTech/pragma/blob/main/docs/EXTENSIONS.md).
