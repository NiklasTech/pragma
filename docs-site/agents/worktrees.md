# Worktrees

An agent session can work in its own [git worktree](https://git-scm.com/docs/git-worktree) instead of your checkout. The agent then writes on a separate branch and directory, so several agents can change the same repository at once without touching your working copy, and you can throw the result away safely.

## Start a session in a worktree

1. Open **New session** in the thread list.
2. Choose **Agent > New worktree**.

Pragma creates a branch from the current `HEAD` and checks it out in a new worktree. The branch is named `pragma/<id>`, where `<id>` is the last eight hex characters of the session id; if that name is taken, a counter is appended (`pragma/1a2b3c4d-2`).

The thread list and the pane header show the branch. Hover it to see the worktree path.

When another agent session already works in the checkout, **New worktree** is the default choice. Otherwise Pragma remembers the choice you made last for this folder.

## Where worktrees live

Worktrees are created outside your repository, in Pragma's application data directory under `worktrees/<workspace hash>/<session id>`:

| Platform | Application data directory                      |
| -------- | ----------------------------------------------- |
| Linux    | `~/.local/share/dev.pragma.ide/`                |
| macOS    | `~/Library/Application Support/dev.pragma.ide/` |
| Windows  | `%APPDATA%\dev.pragma.ide\`                     |

Pragma refuses to create a worktree inside the repository itself.

## Setup and teardown hooks

A fresh worktree only contains tracked files. Dependencies, `.env` files and build output are missing. Two optional hook files in your repository handle this:

| File                        | Runs                                                   |
| --------------------------- | ------------------------------------------------------ |
| `.pragma/worktree-setup`    | After the worktree is created, before the agent starts |
| `.pragma/worktree-teardown` | Before the worktree is removed                         |

Both hooks are read from the main checkout and run with the worktree as the working directory. They must be executable (`chmod +x`). Output from stdout and stderr is collected, and a hook is stopped after 180 seconds.

```sh
#!/bin/sh
# .pragma/worktree-setup
set -e
pnpm install --frozen-lockfile
cp "$(git rev-parse --git-common-dir)/../.env" .env
```

If the setup hook fails, the session is still created, and its chat shows the hook output so you can see what went wrong. If the teardown hook fails, the worktree is kept and the error is shown.

On Windows a hook file is started directly, so it has to be an executable program; shell scripts with a shebang line need macOS or Linux.

## Discard a worktree

Open the thread's context menu and choose **Discard worktree**.

1. Pragma checks the worktree for uncommitted changes. If there are any, you have to confirm a second time, because they are lost permanently.
2. A running agent in that session is stopped.
3. The teardown hook runs.
4. The worktree is removed. Select **Also delete the branch** to remove the `pragma/...` branch as well.

The thread itself stays and continues in the checkout.

Only branches that follow the `pragma/<id>` pattern can be deleted this way, so a discard never removes one of your own branches.
