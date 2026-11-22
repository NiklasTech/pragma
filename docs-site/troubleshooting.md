# Troubleshooting

## Release builds are unsigned

Pragma releases are currently distributed without code signing.

- **Windows:** SmartScreen may warn about an unknown publisher. Choose **More info** and **Run anyway** if you downloaded the installer from the official Releases page.
- **macOS:** Gatekeeper may block the app. Right-click the app, choose **Open**, then confirm.

## A coding CLI does not start

- Check its state in **Settings > Agents > Coding CLIs**. **Not installed** needs **install**, **Not signed in** needs **sign in**.
- **install** runs the vendor's install command, mostly `npm install -g`. Without Node.js on your `PATH`, install the CLI by hand as its vendor describes.
- An account that shows a warning has no sign-in in its folder yet. Run the CLI once with that folder, see [Several accounts of one CLI](./ai-providers.md#several-accounts-of-one-cli).

## AI models do not load

Model lists come from the provider, so a provider needs its key before its models can be listed.

- Save an API key first in **Settings > Editor > Models**. The model picker stays empty until a key exists.
- For **Ollama**, check that the local server runs at the configured base URL. Connection errors such as `connection refused` or `failed to fetch` are reported as "Local model server is not running".
- For **Custom**, enter both a base URL and a model. Include the version path, for example `/v1`.
- **Connection** in **Settings > Editor > Models** tests the provider, the model and the base URL on their own.

## AI chat or completion does nothing

- Check that a provider and a model are picked in **Settings > Editor > Models**.
- Check that **Inline Completion** is on in the same place, and **Command Suggestions** in **Settings > Terminal**, if you expect gray-text suggestions in the editor or the terminal.

## MCP server fails to start

- Check the command and arguments. The executable must be on `PATH`, and the arguments are passed exactly as entered.
- Review the server logs in **Settings > Extensions and tools > MCP servers**. Servers that exit during the handshake usually log the reason there.
- Verify the `mcp.json` file in Pragma's application config directory is valid JSON. A parse error prevents all servers from loading.
- Environment variables are entered as `KEY=VALUE`, one per line, and are passed to the server process.

## Language servers are unavailable

Language servers are programs of their own. **Settings > Editor > Language Servers** shows which are missing and copies their install command. Examples:

- TypeScript/JavaScript: `npm install -g typescript-language-server`
- Rust: `rustup component add rust-analyzer`
- Python: `pip install python-lsp-server`

Check that **Enable language servers** is on in the same section, and that the folder is trusted: a folder in restricted mode starts no language servers, see [Folder trust](./configuration.md#folder-trust).

## Extensions fail to load

Extensions run in a sandboxed iframe. A broken manifest or a runtime failure marks only that extension as failed in **Settings > Extensions and tools**, and the rest of Pragma keeps working. A folder in restricted mode runs no extensions at all. Press **Reload** after changing files in `<workspace>/.pragma/extensions/`.

## Reset or move settings

- **reset all** in the settings restores every default. Custom themes and API keys are kept.
- **export** and **import** in the settings back up your configuration or move it to another machine.
- API keys live in the operating system keychain. If a key is missing after moving to a new machine, enter it again.

## Reporting a problem

Found a bug? Open an issue on [GitHub](https://github.com/NiklasTech/pragma/issues) with the Pragma version, your operating system and steps to reproduce. For security-sensitive reports, follow [SECURITY.md](https://github.com/NiklasTech/pragma/blob/main/SECURITY.md) instead of opening a public issue.
