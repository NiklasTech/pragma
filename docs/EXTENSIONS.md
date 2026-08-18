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
    ]
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

// read-only editor access (v1)
const file = await pragma.editor.getActiveFile();
// -> { path, name, language, cursor: { line, column } } or null
```

All `pragma.*` methods return promises and time out after 5 seconds. The editor
API is read-only in v1; `pragma.editor.insertText` is intentionally not
available yet.

## Bridge protocol (host side)

- Extension to host: `{ kind: "request", id, method, params }`, answered with
  `{ kind: "response", id, ok, result | error }`.
- Host to extension: `{ kind: "event", event, data }` (currently only the
  `command` event).
- Every message is validated before acting; requests from unknown sources are
  ignored.

## Settings storage

Per-extension state is persisted under the `extensions` key of the settings
store (`pragma.settings.v1`): `Record<extensionId, { enabled, settings }>`.
Disabling an extension tears down its iframe and unregisters all of its
commands and panels; contributed themes stay installed.
