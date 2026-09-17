# AI Provider Setup

Pragma talks to AI providers for chat, inline completion and terminal suggestions. Configure them in **Settings > Agents**.

## Supported providers

| Provider       | Authentication                      |
| -------------- | ----------------------------------- |
| OpenAI         | API key                             |
| Anthropic      | API key (default provider)          |
| Ollama         | None, local server                  |
| DeepSeek       | API key                             |
| Kimi           | API key                             |
| Gemini         | API key                             |
| OpenRouter     | API key                             |
| Custom         | API key, OpenAI-compatible endpoint |
| GitHub Copilot | GitHub OAuth device flow            |
| Grok           | API key                             |
| Cursor         | Local CLI only                      |
| OpenCode       | Local CLI only                      |
| Hermes         | Local CLI only                      |

## API key providers

1. Open **Settings > Agents**.
2. Select the provider under **Default Provider**.
3. Enter the API key and save it. The key is stored in the operating system keychain, never in plain text.
4. Select a model. Models are loaded from the provider once a key is present.
5. Use **Test Connection** to verify the provider, model and base URL.

Saved keys are shown masked. A provider is marked **Configured** once a key exists. Removing the key also clears its cached model list.

### Base URLs

Ollama and Custom expose an editable base URL. The remaining providers use these defaults:

| Provider   | Base URL                                    |
| ---------- | ------------------------------------------- |
| Ollama     | `http://localhost:11434`                    |
| DeepSeek   | `https://api.deepseek.com`                  |
| Kimi       | `https://api.kimi.com/coding/v1`            |
| Gemini     | `https://generativelanguage.googleapis.com` |
| OpenRouter | `https://openrouter.ai/api/v1`              |
| Grok       | `https://api.x.ai/v1`                       |
| Custom     | Empty, set by the user                      |

## Local models with Ollama

1. Start the Ollama server locally.
2. Select **Ollama** as the provider.
3. Confirm the base URL, then pick one of the models reported by the server.

Ollama needs no API key. If the model list stays empty, check that the server is reachable at the configured base URL.

## OpenAI-compatible endpoints

Select **Custom** and provide a base URL and a model. Include the API version path, for example `/v1`. LM Studio and Ollama-compatible servers usually need `http://localhost:PORT/v1`.

## GitHub Copilot

1. Create a GitHub OAuth App and copy its Client ID.
2. Paste the Client ID under the Copilot section in **Settings > Agents**.
3. Connect your GitHub account and complete the device flow in the browser. If the browser does not open, enter the displayed code manually.

## Local CLI integration

Pragma can speak the Agent Client Protocol (ACP) with supported official CLIs that are installed locally. This is experimental and gated by the **Enable local CLI integration** toggle in **Settings > Agents**.

- Install a CLI with **Install Official CLI**, then sign in with **Login with CLI**.
- A CLI only runs while it is the active provider, and nothing is installed or launched until you press Install.
- ACP turns use the subscription you signed into in the official CLI. API keys configured above are a separate path and are never handed to a CLI.

Supported CLI providers include Codex CLI (OpenAI), Claude Code (Anthropic), Gemini CLI, GitHub Copilot CLI, Kimi Code, Grok Build, Cursor CLI, OpenCode and Hermes Agent. Each CLI is distributed separately by its vendor; Pragma runs the unmodified official binaries and is not affiliated with these vendors.

## Completion and voice

- **Inline completion** shows AI ghost-text suggestions in the editor, with a configurable debounce.
- **Command suggestions** show AI-powered suggestions while typing in the terminal.
- Voice input can use the browser/web speech engine or Whisper.
