# Troubleshooting

## Release builds are unsigned

Pragma releases are currently distributed without code signing.

- **Windows:** SmartScreen may warn about an unknown publisher. Choose **More info** and **Run anyway** if you downloaded the installer from the official Releases page.
- **macOS:** Gatekeeper may block the app. Right-click the app, choose **Open**, then confirm. The macOS build is produced automatically by CI and has not been tested on Apple hardware.

## AI models do not load

Model lists are fetched from the provider. A provider must be configured before its models can be listed.

- Save an API key first for providers that require one. The model selector stays disabled until a key exists.
- For **Ollama**, check that the local server is running at the configured base URL. Connection errors such as `connection refused` or `failed to fetch` are reported as "Local model server is not running".
- For **Custom**, both a base URL and a model are required. Include the API version path, for example `/v1`.
- Use **Test Connection** in **Settings > Agents** to check the provider, model and base URL independently of the chat.

## AI chat or completion does nothing

- Confirm a default provider and model are selected in **Settings > Agents**.
- Check that inline completion and terminal command suggestions are enabled if you expect ghost-text or terminal suggestions.
- For CLI-based providers, confirm the CLI is installed, signed in, and selected as the active provider. Local CLI integration is experimental and must be enabled first.

## MCP server fails to start

- Check the command and arguments. The executable must be on `PATH`, and the arguments are passed exactly as entered.
- Review the server logs in **Settings > MCP**. Servers that exit during the handshake usually log the reason there.
- Verify the `mcp.json` file in Pragma's application config directory is valid JSON. A parse error prevents all servers from loading.
- Environment variables are entered as `KEY=VALUE`, one per line, and are passed to the server process.

## Language servers are unavailable

Language servers are external executables. Pragma can install them from **Settings > Languages** where an install command is available. Examples:

- TypeScript/JavaScript: `npm install -g typescript-language-server`
- Rust: `rustup component add rust-analyzer`
- Python: `pip install python-lsp-server`

Check that the language is enabled and that LSP is not disabled in the experimental settings.

## Extensions fail to load

Extensions run in a sandboxed iframe. A broken manifest or a runtime failure marks only that extension as errored in the Extension Manager (**Settings > Extensions**); the rest of Pragma keeps working. Press **Reload** after changing files in `<workspace>/.pragma/extensions/`.

## Reset or move settings

- **Settings > Reset Defaults** restores all settings. Custom themes and API keys are kept.
- Use the **Export** and **Import** actions at the bottom of the settings sidebar to back up or transfer configuration.
- API keys live in the operating system keychain. If a key is missing after moving to a new machine, enter it again.

## Reporting a problem

Found a bug? Open an issue on [GitHub](https://github.com/NiklasTech/pragma/issues) with the Pragma version, your operating system and steps to reproduce. For security-sensitive reports, follow [SECURITY.md](https://github.com/NiklasTech/pragma/blob/main/SECURITY.md) instead of opening a public issue.
