# Tool Approvals

Pragma's built-in agent asks before it does anything that changes your project. You decide how much it may do on its own in **Settings > Agents > Approvals**.

## What needs approval

Reading and searching files, keeping a to-do list, remembering facts and opening the browser pane never need approval. These tools can change things and are checked:

| Tool                | Example                                   |
| ------------------- | ----------------------------------------- |
| Write file          | Create a file or replace its content      |
| Search and replace  | Edit part of a file                       |
| Run command         | `pnpm test`, `git status`                 |
| Start child session | See [child sessions](./child-sessions.md) |

When approval is needed, the run pauses and the session shows the pending call with **Allow** and **Deny**. The pane status changes to waiting until you decide.

Coding CLIs in a Conversation session ask for permission through the same approval cards; what they ask for depends on the CLI.

## Auto-approve modes

| Setting                 | File edits | Commands                        | Child sessions |
| ----------------------- | ---------- | ------------------------------- | -------------- |
| Ask for everything      | Ask        | Ask, unless on the allowed list | Ask            |
| Auto-approve file edits | Automatic  | Ask, unless on the allowed list | Ask            |
| Auto-approve everything | Automatic  | Automatic                       | Automatic      |

**Ask for everything** is the default.

The chat toolbar menu also has an **Auto-approve** switch. It approves everything for all chats while it is on, the same as **Auto-approve everything**, and is meant for short, supervised runs.

Two exceptions always apply:

- Edits to [skill files](./skills.md) in `.pragma/skills/` always ask, even with file edits auto-approved.
- A [named agent](./named-agents.md) cannot touch paths outside the workspace and its approved folders, whatever the approval mode.

## Allowed commands

**Settings > Agents > Allowed Commands** lists command patterns that run without asking, even in **Ask for everything** mode. Type a pattern and select **Add**; remove one with its **Remove pattern** button.

A pattern matches a command when:

- the command is exactly the pattern: `pnpm test` allows `pnpm test`;
- the command adds arguments to the pattern: `pnpm test` allows `pnpm test --run`, but not `pnpm testing`;
- the pattern ends in `*` and the command starts with the text before it: `cargo *` allows `cargo check` and `cargo clippy`.

A command that contains shell operators never matches, so `pnpm test && rm -rf build` still asks. This covers `;`, `&`, `|`, `<`, `>`, backticks, `$(` and line breaks.

Keep patterns narrow. `git *` would also allow `git push --force` and `git reset --hard`.

## Step limit

**Step limit** in the same section stops a run after a number of tool calls. Leave it empty for no limit. A stopped [task](./tasks.md) can be continued with **Resume**.
