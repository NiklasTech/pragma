# Coding CLIs and API keys

Pragma works with AI in two ways, and they are set up in different places:

- **Coding CLIs** such as Claude Code or Codex run your agents. They use the plan you signed in to, so Pragma needs no key for them. Set them up in **Settings > Agents**.
- **API keys** power the AI features of the editor: inline completion, the AI chat, the AI edit and terminal suggestions. Set them up in **Settings > Editor > Models**.

An API key is never handed to a coding CLI, and a CLI's sign-in never leaves the CLI.

## Coding CLIs

**Settings > Agents > Coding CLIs** lists every CLI that Pragma supports, with its state:

| State         | What to do                                                             |
| ------------- | ---------------------------------------------------------------------- |
| Not installed | **install** runs the vendor's install command, mostly `npm install -g` |
| Not signed in | **sign in** opens the CLI's own sign-in                                |
| Ready         | The CLI can run agents. Hover it to sign out                           |

Pragma supports Claude Code, OpenAI Codex, Gemini CLI, GitHub Copilot CLI, Kimi Code, Grok Build, Cursor CLI, OpenCode, Hermes Agent and DeepSeek Harness. Each CLI is made and distributed by its vendor. Pragma runs the unmodified official program and is not affiliated with these vendors.

**Default agent** picks the CLI that runs tasks and the chat when you do not pick an agent yourself.

How the CLIs run inside Pragma, as a terminal or as a chat, is described in [Coding CLIs in agents](./agents/coding-clis.md).

## Several accounts of one CLI

Claude Code and Codex can run under more than one account, for example a work and a personal Claude Code plan. Each account lives in its own config folder:

- Pragma finds folders in your home directory named like `~/.claude-work` or `~/.codex-personal` that hold a config of their own.
- **Add account folder** under the CLI adds any other folder.
- The pencil button names an account. The name shows wherever you pick an agent.

When an agent starts on an account, Pragma points the CLI at that folder with `CLAUDE_CONFIG_DIR` or `CODEX_HOME`. To sign in to a new account, run the CLI once with that variable set, for example:

```sh
CLAUDE_CONFIG_DIR=~/.claude-work claude
```

Every account then shows up as its own choice on the [start card](./agents/start.md), so the tasks of one start can be spread over all of them. The [activity tab](./agents/watching.md#the-activity-tab) shows how much of each Claude Code plan is used.

## API keys

**Settings > Editor > Models** holds the provider for the editor's AI features:

1. Pick the provider under **Default Provider**.
2. Enter the API key and save it. Pragma stores it in the operating system keychain, never in a file.
3. Pick a **Model**. The list is loaded from the provider once a key is saved.
4. **Connection** tests the provider, the model and the base URL.

| Provider       | Sign-in                             | Base URL                                    |
| -------------- | ----------------------------------- | ------------------------------------------- |
| Anthropic      | API key                             | Fixed                                       |
| OpenAI         | API key                             | Fixed                                       |
| Gemini         | API key                             | `https://generativelanguage.googleapis.com` |
| DeepSeek       | API key                             | `https://api.deepseek.com`                  |
| Kimi           | API key                             | `https://api.kimi.com/coding/v1`            |
| Grok           | API key                             | `https://api.x.ai/v1`                       |
| OpenRouter     | API key                             | `https://openrouter.ai/api/v1`              |
| GitHub Copilot | GitHub device sign-in               | Fixed                                       |
| Ollama         | None, a local server                | `http://localhost:11434`, editable          |
| Custom         | API key, OpenAI-compatible endpoint | Set by you                                  |

**Show unavailable providers** also lists providers without a key in the chat's model picker.

### Local models with Ollama

1. Start the Ollama server.
2. Pick **Ollama** as the provider.
3. Check the base URL and pick one of the models the server reports.

If the model list stays empty, the server is not reachable at the base URL.

### OpenAI-compatible endpoints

Pick **Custom** and enter a base URL and a model. Include the version path, for example `/v1`. LM Studio and similar servers usually need `http://localhost:PORT/v1`.

### GitHub Copilot

1. Create a GitHub OAuth App and copy its client ID.
2. Paste the client ID in the Copilot block of **Settings > Editor > Models**.
3. **Connect GitHub Account** and finish the device sign-in in the browser. If the browser does not open, enter the code that Pragma shows.

## Editor AI features

The same page has the settings of the features that use the API key:

- **Inline Completion** shows ghost-text suggestions while you type, after a short wait you can set. `Tab` accepts the whole suggestion, `Cmd/Ctrl + Right` the next word and `Cmd/Ctrl + Shift + Right` the next line. `Alt + ]` asks for another suggestion and `Alt + [` goes back to an earlier one.
- **Terminal Suggestions** picks the provider and model for command suggestions in the terminal. Turn them on or off with **Command Suggestions** in **Settings > Terminal**.

Voice input has its own engines and needs no API key, see [Voice dictation](./agents/voice-dictation.md).
