# Named Agents

A named agent is a reusable assistant with its own instructions, memory, skills and folder access. Each chat you start with it gets that context automatically.

Named agents are listed under **Agents** in the thread list. Select one to see its chats and settings.

## Create an agent

1. Select **New agent** in the thread list.
2. Describe the agent in one paragraph and use **Draft with the current model** to get a suggested name and brief, or fill in both fields yourself.
3. Pick the engine: the built-in agent with your current provider and model, or an installed [coding CLI](./coding-clis.md).
4. Save the agent.

The name can have up to 40 characters, the brief up to 4000.

## Brief

The brief is the system instruction for every chat of the agent. Describe its role, the conventions it should follow and what it should not do.

## Memory

Memory holds short facts the agent should keep across chats, for example "Use pnpm, never npm". Entries are added in two ways:

- You add, edit or delete them on the **Memory** tab.
- The agent stores a fact itself with its remember tool. Each entry shows whether it came from you or from the agent.

Every chat receives the brief followed by all memory entries, oldest first. Memory is limited to 50 entries of at most 500 characters each and 16,000 characters in total. Do not store secrets in memory.

## Skills

The **Skills** tab chooses which [workspace skills](./skills.md) the agent can use. A named agent only sees the skills you turn on here, starting with none; the workspace-wide enabled flag does not apply to it.

## Approved folders

A named agent can always read and write inside the open workspace folder. On the **Folders** tab you can approve additional folders with **Add folder**, for example a shared library next to the project.

File tools and shell commands are checked against these folders. A read, write, search or command whose path or working directory is outside the workspace and the approved folders is refused with "Folder is not approved for this agent". Approved folders do not skip [tool approvals](./tool-approvals.md); a file edit or command still needs your approval if your settings require it.

## CLI engines

An agent that runs on a coding CLI receives its brief, memory and skill list at the start of each chat. The CLI uses its own tools, so the folder checks and the remember tool above apply to the built-in engine only.

## Storage

Agents are stored in `pragma/agents/roster.json` inside Pragma's application data directory and are available in every workspace.
