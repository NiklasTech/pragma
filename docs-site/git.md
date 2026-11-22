# Git

Git lives in the code tab, in two sidebar views: **Changes** for what you are about to commit and **History** for what is already committed. Both work on the repository of the active space.

## Changes

The top line names the repository and the branch, with the commits the branch is ahead of and behind its remote, and the pull and push buttons. Click the branch to switch to another one, create one or rename it. The `⋯` menu has **Fetch**, **Refresh status**, **New branch**, **Compare** and **Tags**.

Below comes the list of changed files. A small cell in front of each file is full when the file is staged and half full when only part of it is. The summary above the list counts the files per state; click a state's letter to show only those files. Click a file to see its diff, and use the buttons on its row to stage, unstage or discard it.

### Commit

The commit line sits at the bottom of **Changes**:

1. Stage the files you want. The button reads **Stage files first** until something is staged.
2. Write the message, or let the sparkle button write one with the model from **Settings > Editor > Models**.
3. Commit with the button or `Cmd/Ctrl + Enter`.

The **amend** switch adds the staged changes to the last commit instead. The undo button takes the last commit back and keeps its changes, except for the first commit of a branch.

### Stashes

**Stashes** at the bottom of **Changes** lists your stashes. Stash the current changes with an optional message, then apply, pop or drop a stash later.

### Pull requests

With the GitHub CLI (`gh`) installed and signed in, **Create pull request** opens a dialog for the title, the description, the base branch and labels, and creates the pull request on GitHub. Once a branch has a pull request, **Changes** shows its number and state (open, draft, merged or closed), and **Send review comments to an agent** hands the comments from GitHub to an agent to work in.

### Compare and tags

**Compare** at the bottom of **Changes** shows the difference between two revisions, such as two branches or tags. **tags** lists the tags of the repository.

## History

<figure class="screen">
  <img src="/screens/history.webp" alt="Git history with the commit graph and the details of a commit">
</figure>

**History** (`Cmd/Ctrl + Shift + H`) shows the commit graph of the branch with messages, pull request numbers, tags, authors and times. The unmerged branches of your agents are listed on top. **Search commits** filters the list and **fetch** loads new commits from the remote.

Select a commit to see its message, author, pull request and changed files. From there:

- **Open diff** shows what the commit changed.
- **Create branch here** starts a branch at that commit.
- **Revert** creates a commit that undoes it.

## In the editor

- **Git: Toggle Blame Gutter** in the command palette shows who last changed each line.
- **file history** in the right-click menu of a file or an editor tab shows the commits that changed the file. **local history** in the menu of the file tree shows the versions Pragma kept while you edited.
- A merge with conflicts lists the conflicted files in **Changes**. The conflict editor shows both sides of each conflict, so you can pick one or combine them and then commit the merge.

## Agents and Git

Agents in a [worktree](./agents/worktrees.md) work on their own `pragma/...` branch and never touch your checkout. You bring their work in with a [review](./agents/review.md) or with **Finish** in the [thread list](./agents/index.md#the-thread-list), which merges the branch or opens a pull request.
