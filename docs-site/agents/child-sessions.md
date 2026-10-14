# Child Sessions

An agent can split its work by starting child sessions. A child is a normal session with its own title, first message and pane; it runs independently, and the parent does not wait for it.

## How a child is started

Agents get a tool to start a child session. Pragma's built-in agent has it, and so do coding CLIs in a Conversation session, through a small MCP server that Pragma provides to them. Ask and Terminal sessions cannot start children.

The agent chooses:

| Option      | Values                             | Default                                                       |
| ----------- | ---------------------------------- | ------------------------------------------------------------- |
| Title       | 1 to 80 characters                 | Required                                                      |
| Prompt      | First message of the child         | Required                                                      |
| Kind        | `conversation` or `terminal`       | `conversation`                                                |
| Environment | `worktree`, `parent` or `checkout` | The project setting, see [Environments](#environments)        |
| CLI         | Id of an installed CLI             | Required for `terminal`; must be a CLI that offers a terminal |

A conversation child uses the same engine as its parent: the built-in agent for a built-in parent, the same CLI for a CLI parent. A terminal child starts the chosen coding CLI in a [terminal pane](./coding-clis.md).

## Environments

A child can build on its parent's work:

| Environment | Where the child works                                                                                                                                                            |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `worktree`  | A new [worktree](./worktrees.md). When the parent works in a worktree, it branches from the parent's branch and contains the parent's commits; otherwise from the current `HEAD` |
| `parent`    | The parent's environment: its worktree, or the checkout when the parent works there. Parent and child edit the same files                                                        |
| `checkout`  | Your main checkout, even when the parent works in a worktree                                                                                                                     |

When the agent does not choose, **Settings > Project > Agent > Child sessions work in** decides: **Own worktree from the parent's branch** (`worktree`, the default) or **Where the parent works** (`parent`). It is stored as `agent.childEnvironment` in `.pragma/settings.json`.

### Finish a child into its parent

**Finish > Merge** on a child whose worktree branched from the parent's branch merges into the parent's branch, inside the parent's worktree. Your main checkout stays untouched. If the parent's worktree is gone by then, the merge goes into the branch of your checkout as for any other session. Conflicts are left in the parent's worktree for you or the parent to resolve.

## Approval

Starting a child always needs your approval in the parent's chat, unless you turned on **Auto-approve** for the chat or set **Auto-approve everything** in the [approval settings](./tool-approvals.md). If you deny it, the agent is told that the child was not started.

## Limits

| Limit                | Default                                              | Range  |
| -------------------- | ---------------------------------------------------- | ------ |
| Nesting depth        | 3 levels: a session, its children and their children | 2 to 3 |
| Children per session | 4 active children; archived children do not count    | 1 to 8 |

Change both in **Settings > Agents > Child sessions**, for example to let one lead session hand out work to seven others. When a limit is reached, the tool returns an error that names the limit and the setting, and the agent continues without the child.

## Following children

Child sessions are listed under their parent in the thread list, and the parent shows a card for each child with its status. Open a child like any other thread to watch it or take over. A running child can be stopped from its card.

## Deleting a parent

When you delete a thread that has children, the dialog offers **Also archive its child session** (or its N child sessions). With it, all descendants are stopped and archived. Without it, the children stay as independent threads.
