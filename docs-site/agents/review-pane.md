# Review Pane

The context pane on the right of the Agents view shows what the focused session changed. It always follows the pane that has focus. Collapse it with the arrow button in its header and drag its left edge to resize it.

The context pane has two tabs:

| Tab    | Shows                                                      |
| ------ | ---------------------------------------------------------- |
| Review | The run of the focused session and a diff per changed file |
| Files  | A compact list of the changed files                        |

## What counts as a change

The list combines two sources:

- **Agent edits** that the built-in agent made in this session, including edits still waiting for your decision.
- **Git changes** in the session's folder: added, modified and deleted files from `git status`. For a [worktree](./worktrees.md) session this is the worktree, otherwise your checkout.

Select a file to see its diff.

## Accept, reject and restore

The actions depend on where the change comes from:

| Change                         | Actions                                                        |
| ------------------------------ | -------------------------------------------------------------- |
| Pending agent edit             | **Accept edit** applies it, **Reject edit** discards it        |
| Applied change in the checkout | **Restore from HEAD** discards the change after a confirmation |
| Change in a worktree           | Read-only; the diff header shows the branch it was written in  |

Restoring from `HEAD` throws away the session's changes to that file and puts back the committed version. It cannot be undone from the review pane.

## Run details

While the focused session is running the built-in agent, the Review tab also shows the run itself: the steps the agent took, its to-do list and any approvals it is waiting for.

When no session has focus, the pane shows "No active run".
