# Child Sessions

An agent can split its work by starting child sessions. A child is a normal session with its own title, first message and pane; it runs independently, and the parent does not wait for it.

## How a child is started

Agents get a tool to start a child session. Pragma's built-in agent has it, and so do coding CLIs in a Conversation session, through a small MCP server that Pragma provides to them. Ask and Terminal sessions cannot start children.

The agent chooses:

| Option      | Values                       | Default                                                         |
| ----------- | ---------------------------- | --------------------------------------------------------------- |
| Title       | 1 to 80 characters           | Required                                                        |
| Prompt      | First message of the child   | Required                                                        |
| Kind        | `conversation` or `terminal` | `conversation`                                                  |
| Environment | `checkout` or `worktree`     | `worktree` when the parent can edit files, otherwise `checkout` |
| CLI         | Id of an installed CLI       | Required for `terminal`; must be a CLI that offers a terminal   |

A conversation child uses the same engine as its parent: the built-in agent for a built-in parent, the same CLI for a CLI parent. A terminal child starts the chosen coding CLI in a [terminal pane](./coding-clis.md).

A child in a worktree always gets a new [worktree](./worktrees.md) that branches from the workspace, not from the parent's worktree.

## Approval

Starting a child always needs your approval in the parent's chat, unless you turned on **Auto-approve** for the chat or set **Auto-approve everything** in the [approval settings](./tool-approvals.md). If you deny it, the agent is told that the child was not started.

## Limits

| Limit                | Value                                                |
| -------------------- | ---------------------------------------------------- |
| Nesting depth        | 3 levels: a session, its children and their children |
| Children per session | 4 active children; archived children do not count    |

When a limit is reached, the tool returns an error and the agent continues without the child.

## Following children

Child sessions are listed under their parent in the thread list, and the parent shows a card for each child with its status. Open a child like any other thread to watch it or take over. A running child can be stopped from its card.

## Deleting a parent

When you delete a thread that has children, the dialog offers **Also archive its child session** (or its N child sessions). With it, all descendants are stopped and archived. Without it, the children stay as independent threads.
