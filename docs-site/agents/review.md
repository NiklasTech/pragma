# Review changes

The review shows what an agent changed, part by part. You keep or undo each part, comment on lines, and then commit the result or send your comments back to the agent.

## Open a review

- Right-click an agent in the rail or a pane header and choose **review changes**, or press `v` while the menu is open. This works for agents in a [worktree](./worktrees.md).
- **Review** in the footer of [Peek](./watching.md#peek).
- **review** next to a finished session in the [activity tab](./watching.md#the-activity-tab).

The header names the agent, its branch and the branch it started from, the number of changed files and the lines added and removed. **Unified** and **Split** switch the diff view. `Escape` closes the review.

## Keep, undo and comment

The left column lists the changed files. The diff shows each file as parts, one per changed block, and every part has three buttons:

| Button  | What it does                                                                                                 |
| ------- | ------------------------------------------------------------------------------------------------------------ |
| Keep    | Marks the part as reviewed. It stays in the file                                                             |
| Undo    | Takes the part out of the file in the agent's folder. Undoing the only part of a new file deletes the file   |
| Comment | Adds a comment to the last changed line of the part. To comment on another line, click that line in the diff |

An undone part stays in the list as **Undone** with **Restore**, which puts it back as long as the file has not changed since. The footer counts the parts that are still open until it reads **Everything reviewed**.

## Send feedback

Your comments are listed under **Your review**, where you can edit or remove them. **Send feedback to** followed by the agent's name sends all comments to the agent as one message, with the file and line of each comment, so it can work them in. The button needs at least one comment and an agent that is not busy.

## Commit

Type a commit message in the footer. Pragma suggests the task title or the session title.

- For an agent in a worktree, **Commit and open PR** commits the changes on the agent's branch, closes the review and continues with [Push and open pull request](./worktrees.md#finish-a-worktree-session). That step needs the GitHub CLI (`gh`), installed and signed in.
- For an agent in your checkout, **Commit** stages the agent's changes and commits them.

Undone parts are no longer in the files, so they are not part of the commit.
