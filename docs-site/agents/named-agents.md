# Named Agents

A named agent is a reusable assistant with its own instructions, memory, skills and folder access. Each chat you start with it gets that context automatically.

Named agents are listed under **Agents** in the thread list. Select one to see its chats and settings.

Each agent has a scope, shown next to its engine:

- **Project** agents are Markdown files in `.pragma/agents/` of the open folder. They are versioned and shared with your team like [skills](./skills.md).
- **Personal** agents live on this machine and are available in every workspace.

Names must be unique within a scope. A project agent and a personal agent with the same name are both listed, each with its scope.

## Create an agent

1. Select **New agent** in the thread list.
2. Choose the scope: **Personal** or **Project**. Project needs an open folder.
3. Describe the agent in one paragraph and use **Draft with the current model** to get a suggested name and brief, or fill in both fields yourself.
4. Pick the engine: the built-in agent with your current provider and model, or an installed [coding CLI](./coding-clis.md).
5. Save the agent.

The name can have up to 40 characters, the brief up to 4000.

## Project agents

A project agent is the file `.pragma/agents/<id>.md`. The id is the file name without `.md` and may only use letters, digits, `-` and `_`.

```md
---
name: Reviewer
description: Reviews changes for correctness before a pull request.
engine: cli # builtin or cli
cli: anthropic-claude # CLI id, when engine is cli
provider: anthropic # when engine is builtin
model: claude-sonnet-5-5 # when engine is builtin
skills: [release, add-migration]
mcpServers: [docs]
folders: [docs, src]
---

The brief: instructions the agent receives at the start of each chat.
```

| Field         | Required | Meaning                                                                        |
| ------------- | -------- | ------------------------------------------------------------------------------ |
| `name`        | yes      | Display name, up to 40 characters.                                             |
| `description` | no       | One sentence about the agent.                                                  |
| `engine`      | yes      | `builtin` or `cli`.                                                            |
| `cli`         | for cli  | The id of the coding CLI.                                                      |
| `provider`    | no       | Provider of the built-in engine. Without it, the current provider is used.     |
| `model`       | no       | Model of the built-in engine. Without it, the current model is used.           |
| `skills`      | no       | Ids of the workspace skills the agent uses.                                    |
| `mcpServers`  | no       | MCP servers the agent uses. Without it, the agent uses all configured servers. |
| `folders`     | no       | Approved folders relative to the workspace root.                               |

The text below the front matter is the brief, up to 4000 characters.

Pragma rejects a file when:

- a folder is absolute or leaves the workspace, for example `../shared`
- it contains `baseUrl`, which depends on the machine
- it contains something that looks like a secret, for example an API key or a bearer token
- a required field is missing or has the wrong type, or another project agent has the same name

Rejected files are listed under the agents with their error and cannot be used. Pragma reloads project agents whenever a file in `.pragma/agents/` changes, so editing a file in the editor or pulling a change updates the agent. Editing a project agent in the form rewrites its file; comments and fields Pragma does not know are not kept.

To move an agent between scopes, open its export menu and choose **Copy to project** or **Copy to personal agents**. A copy to the project keeps only the folders inside the workspace.

Subagents that coding CLIs keep in the project, such as `.claude/agents/` or `.codex/agents/`, are listed as read-only project agents labeled with their folder. **Copy to .pragma** turns one into a `.pragma/agents/` file you can edit; see [Skills and agents from coding CLIs](./coding-clis.md#skills-and-agents-from-coding-clis).

In the other direction, `cliSync` in `.pragma/settings.json` writes each project agent into the agent folders of the coding CLIs, for example as a Claude Code subagent in `.claude/agents/`; see [Sync .pragma to coding CLI folders](./coding-clis.md#sync-pragma-to-coding-cli-folders).

## Brief

The brief is the system instruction for every chat of the agent. Describe its role, the conventions it should follow and what it should not do.

## Memory

Memory holds short facts the agent should keep across chats, for example "Use pnpm, never npm". Entries are added in two ways:

- You add, edit or delete them on the **Memory** tab.
- The agent stores a fact itself with its remember tool. Each entry shows whether it came from you or from the agent.

Every chat receives the brief followed by all memory entries, oldest first. Memory is limited to 50 entries of at most 500 characters each and 16,000 characters in total. Do not store secrets in memory.

Memory is always personal. The memory of a project agent is stored in Pragma's application data directory for each workspace and agent, never in the repository.

## Skills

The **Skills** tab chooses which [workspace skills](./skills.md) the agent can use. A named agent only sees the skills you turn on here, starting with none; the workspace-wide enabled flag does not apply to it.

## Approved folders

A named agent can always read and write inside the open workspace folder. On the **Folders** tab you can approve additional folders with **Add folder**, for example a shared library next to the project. Project agents can only approve folders inside the workspace.

File tools and shell commands are checked against these folders. A read, write, search or command whose path or working directory is outside the workspace and the approved folders is refused with "Folder is not approved for this agent". Approved folders do not skip [tool approvals](./tool-approvals.md); a file edit or command still needs your approval if your settings require it.

## CLI engines

An agent that runs on a coding CLI receives its brief, memory and skill list at the start of each chat. The CLI uses its own tools, so the folder checks and the remember tool above apply to the built-in engine only.

## Import and export

The export menu of an agent offers:

- **Export** and **Export with memory**: a `<name>.agent.json` file.
- **Export as Markdown**: the project agent format above. Folders outside the open workspace are left out.

The import button next to **New agent** accepts:

- a `.agent.json` file from the export above
- a Markdown file in the project agent format above
- a coding CLI subagent file such as `.claude/agents/<name>.md` or `.github/agents/<name>.agent.md`. Its name, description and instructions are used; tool-specific fields such as `tools` or `model` are ignored, and the agent runs on the built-in engine with your current provider and model.

Imported agents are personal, and their folders are not imported.

## Storage

Personal agents are stored in `pragma/agents/roster.json` inside Pragma's application data directory. Project agents are the files in `.pragma/agents/`; their memory is stored in `pragma/agents/projects/` inside the application data directory.
