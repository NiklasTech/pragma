# Run configurations

Run configurations start the long-running processes of a project, such as a dev server or a watcher, with one click. They are stored in the workspace, so the whole team shares them.

## Run them

- A running process shows as a badge at the right of the strip. Click it to open its output, or stop it there.
- On Windows and Linux, the **Run** button in the strip lists your configurations. Start, stop or restart each one there, or start it under the debugger.
- On macOS, **Run > Run Task** and **Run > Stop Task** in the menu bar list the same configurations.
- The **Processes** view in the sidebar of the code tab lists your configurations with their status and logs, plus suggestions for new ones. Open it from the `⋯` button at the top of the sidebar.
- The command palette has **Run: Start Configuration...**, **Run: Stop Configuration...** and **Run: Restart Configuration...**.

Output appears in the run output panel at the bottom. Each process shows whether it is running, stopped or failed, with the exit code once it has ended.

## Detected configurations

When you open a folder, Pragma looks for common setups and suggests configurations under **Detected** in the **Processes** view:

| Found in the workspace                                  | Suggestion                   |
| ------------------------------------------------------- | ---------------------------- |
| `dev`, `start` or `serve` in `package.json` scripts     | `<pm> run dev` and so on     |
| `vite.config.*`                                         | `<pm> exec vite`             |
| `src-tauri/Cargo.toml`                                  | `<pm> tauri dev`             |
| `manage.py` with `requirements.txt` or `pyproject.toml` | `python manage.py runserver` |

`<pm>` is the package manager of the lockfile: `pnpm`, `yarn`, `bun` or `npm`. Select **Add process** to save a suggestion to `run.json`, or **Ignore suggestion** to hide it.

## `.pragma/run.json`

Configurations live in `.pragma/run.json` at the workspace root. Pragma creates the file when you save the first configuration, and you can edit it by hand:

```json
{
  "configurations": [
    {
      "name": "web",
      "command": "pnpm dev",
      "cwd": "${workspaceRoot}/apps/web",
      "env": { "PORT": "5173" },
      "autoRestart": true
    },
    {
      "name": "api",
      "command": "node server.js",
      "debug": { "adapter": "node", "request": "launch" }
    }
  ]
}
```

| Field         | Required | Description                                                                                     |
| ------------- | -------- | ----------------------------------------------------------------------------------------------- |
| `name`        | Yes      | Name shown in the Run menu and the Processes view                                               |
| `command`     | Yes      | Program and arguments. Quote arguments that contain spaces                                      |
| `cwd`         | No       | Working directory. `${workspaceRoot}` is replaced with the workspace path; defaults to the root |
| `env`         | No       | Extra environment variables for the process                                                     |
| `autoRestart` | No       | Restart the process when it exits on its own, up to five times with an increasing delay         |
| `debug`       | No       | Start the configuration under a debugger; see [Debugging](./debugging.md)                       |

The command is started directly, not through a shell, so shell features such as `&&`, pipes or `$VAR` expansion do not work in it. Put such logic into a script and run that script.

Stopping a process ends its whole process tree, so child processes such as a bundler started by `pnpm dev` stop as well.
