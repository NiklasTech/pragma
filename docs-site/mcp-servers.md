# MCP Server Setup

Pragma can connect to [Model Context Protocol](https://modelcontextprotocol.io/) servers and expose their tools to the AI chat. Manage servers in **Settings > MCP**.

## Add a server

1. Open **Settings > MCP**.
2. Select **Add Server**.
3. Fill in the fields:

| Field       | Description                                                          |
| ----------- | -------------------------------------------------------------------- |
| Name        | Display name, for example `filesystem`                               |
| Command     | Executable to run, for example `npx` or `npm`                        |
| Arguments   | One argument per line, or whitespace separated                       |
| Environment | `KEY=VALUE` pairs, one per line. Lines starting with `#` are ignored |
| Autostart   | Start the server automatically when Pragma launches                  |

4. Save the server.

Each entry shows a status indicator (stopped, starting, running or error), the command line and the tool names the server exposes. Use the row actions to start, stop, restart, view logs, edit or delete a server.

## Example

An MCP filesystem server that can access a project directory:

```json
{
  "servers": [
    {
      "id": "example-filesystem",
      "name": "filesystem",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/user/projects"],
      "env": {},
      "autostart": true
    }
  ]
}
```

## Configuration file

Servers are persisted to `mcp.json` in Pragma's application config directory, which is derived from the bundle identifier `dev.pragma.ide`:

| Platform | Path                                                    |
| -------- | ------------------------------------------------------- |
| Linux    | `~/.config/dev.pragma.ide/mcp.json`                     |
| macOS    | `~/Library/Application Support/dev.pragma.ide/mcp.json` |
| Windows  | `%APPDATA%\dev.pragma.ide\mcp.json`                     |

The file is a JSON object with a single `servers` array. Each server has `id`, `name`, `command`, optional `args` and `env`, and an `autostart` flag. Pragma generates the `id` when a server is added and rewrites the file whenever servers change. Running state is session-only and is not persisted.

Editing `mcp.json` outside Pragma is possible; the settings panel reloads the file when the window regains focus.

## Using MCP tools

Once a server is running, its tools become available to the AI chat. Server logs and tool results are visible in the MCP settings panel, which makes it easier to diagnose a server that exits immediately or fails its handshake.
