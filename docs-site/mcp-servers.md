# MCP servers

Pragma connects to [Model Context Protocol](https://modelcontextprotocol.io/) servers and gives their tools to its chats. Manage servers in **Settings > Extensions and tools > MCP servers**.

## Add a server

1. Open **Settings > Extensions and tools > MCP servers**.
2. Add a server and pick its **Transport**: **Local process (stdio)** or **Remote (Streamable HTTP)**.
3. Fill in the fields and save.

For a local process:

| Field       | Description                                                                                           |
| ----------- | ----------------------------------------------------------------------------------------------------- |
| Name        | Display name, for example `filesystem`                                                                |
| Command     | The program to run, for example `npx`                                                                 |
| Arguments   | One argument per line, or separated by spaces                                                         |
| Environment | `KEY=VALUE` pairs, one per line                                                                       |
| Secrets     | Variables such as `GITHUB_TOKEN` whose values go into the keychain of your system instead of the file |
| Autostart   | Starts the server when Pragma starts                                                                  |

For a remote server, enter its URL, for example `https://mcp.example.com/mcp`, and any headers as `Name: value`, one per line. Secret headers such as `Authorization` go into the keychain too. A server that signs in with OAuth gets **Sign in with OAuth**, which opens the sign-in in your browser.

Each server shows its state (stopped, starting, running or error), its command or URL and the tools it offers. Its row starts, stops and restarts the server, shows its logs, and edits or deletes it.

## Import servers

**Import** reads the MCP servers you already set up elsewhere, so you do not have to enter them again:

- the project: `.mcp.json` and `.pragma/settings.json`
- the configs of Claude Code, Codex, Gemini CLI and Cursor
- Claude Desktop

Pick the servers you want and import them.

## Configuration file

Servers are saved in `mcp.json` in Pragma's app config folder:

| Platform | Path                                                    |
| -------- | ------------------------------------------------------- |
| Linux    | `~/.config/dev.pragma.ide/mcp.json`                     |
| macOS    | `~/Library/Application Support/dev.pragma.ide/mcp.json` |
| Windows  | `%APPDATA%\dev.pragma.ide\mcp.json`                     |

```json
{
  "version": 1,
  "servers": [
    {
      "id": "example-filesystem",
      "name": "filesystem",
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/user/projects"],
      "env": {},
      "autostart": true
    }
  ]
}
```

A remote server has `"transport": "http"`, a `url` and `headers` instead of `command` and `args`. The values of secrets and secret headers are not in the file: `secret_env` and `secret_headers` only list their names, and the values live in the keychain.

Pragma creates the `id` when you add a server and rewrites the file whenever servers change. You can edit `mcp.json` by hand; the settings read it again when the window gets focus.

## Using MCP tools

Once a server runs, its tools are available in the AI chat. Server logs and tool results show in the MCP settings, which helps when a server exits right away or fails its handshake.

A coding CLI in a [Conversation session](./agents/coding-clis.md) also receives the servers you set up in Pragma. In a Terminal session the CLI starts exactly as in your shell, with only the servers from its own config.
