# Debugging

Pragma includes a debugger that speaks the Debug Adapter Protocol. It supports JavaScript and TypeScript on Node.js, Python, and compiled Rust, C and C++ programs.

## Debug adapters

| Adapter  | Languages              | Based on        | Installed with                        |
| -------- | ---------------------- | --------------- | ------------------------------------- |
| `node`   | JavaScript, TypeScript | vscode-js-debug | `npm install -g vscode-js-debug`      |
| `python` | Python                 | debugpy         | `pip install debugpy`                 |
| `lldb`   | Rust, C, C++           | CodeLLDB        | Downloaded from the CodeLLDB releases |

When you start a debug session and the adapter is missing, Pragma installs it automatically and shows the progress in a notification. CodeLLDB is stored in Pragma's local application data directory under `adapters/`.

## Debug the current file

Open a JavaScript, TypeScript or Python file and press `F5`, or use **Debug Current File** in the **Debug** view of the sidebar. Pragma runs the file with `node` or `python` under the matching adapter.

Rust, C and C++ need a compiled binary, so they are debugged through a run configuration instead.

## Debug a run configuration

Add a `debug` block to a configuration in [`.pragma/run.json`](./run-configurations.md#pragma-run-json). The configuration then gets a debug button in the **Run** menu.

```json
{
  "configurations": [
    {
      "name": "dev server",
      "command": "npm run dev",
      "debug": { "adapter": "node" }
    },
    {
      "name": "django",
      "command": "python manage.py runserver",
      "debug": { "adapter": "python" }
    },
    {
      "name": "cli",
      "command": "target/debug/myapp --verbose",
      "debug": { "adapter": "lldb" }
    }
  ]
}
```

| Field     | Values                     | Default  |
| --------- | -------------------------- | -------- |
| `adapter` | `node`, `python` or `lldb` | Required |
| `request` | `launch` or `attach`       | `launch` |

How the `command` is used depends on the adapter:

| Adapter  | `launch`                                                                                       | `attach`                     |
| -------- | ---------------------------------------------------------------------------------------------- | ---------------------------- |
| `node`   | The first word is the runtime (`node`, `npm`, `pnpm`), the rest are its arguments              | Connects to `localhost:9229` |
| `python` | The arguments after the interpreter are the script and its arguments; `-m module` is supported | Connects to `localhost:5678` |
| `lldb`   | The first word is the binary to debug, the rest are its arguments                              | Not supported                |

The `cwd` and `env` of the configuration are passed to the program as well. For `attach`, start your program with the debug port open first, for example `node --inspect` or `python -m debugpy --listen 5678`.

## The Debug view

The **Debug** view in the sidebar shows the session while it runs:

- **Continue**, **Pause**, **Step Over**, **Step Into**, **Step Out** and **Stop**.
- **Call Stack** with the frames of the paused thread. Select a frame to see its variables.
- **Variables**, expandable for objects and arrays.
- **Watch** expressions, added with **Add watch** and evaluated whenever the program pauses.
- **Breakpoints** across all files, each removable.

Set or remove a breakpoint by clicking the editor gutter next to a line, or with `F9`.

## Shortcuts

| Action                     | Default       |
| -------------------------- | ------------- |
| Start / Continue Debugging | `F5`          |
| Stop Debugging             | `Shift + F5`  |
| Step Over                  | `F10`         |
| Step Into                  | `F11`         |
| Step Out                   | `Shift + F11` |
| Toggle Breakpoint          | `F9`          |

Change them in **Settings > Keyboard**.
