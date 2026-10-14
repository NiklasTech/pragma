# Worktrees

An agent session can work in its own [git worktree](https://git-scm.com/docs/git-worktree) instead of your checkout. The agent then writes on a separate branch and directory, so several agents can change the same repository at once without touching your working copy, and you can throw the result away safely.

## Start a session in a worktree

1. Open **New session** in the thread list.
2. Choose **Agent > New worktree**.

Pragma creates a branch from the current `HEAD` and checks it out in a new worktree. The branch is named `pragma/<id>`, where `<id>` is the last eight hex characters of the session id; if that name is taken, a counter is appended (`pragma/1a2b3c4d-2`).

The thread list and the pane header show the branch. Hover it to see the worktree path.

## Choose where writing sessions work

Every session that can change files starts in the environment the project setting **Settings > Project > Agent > Writing sessions work in** picks. This covers agent sessions, coding CLI terminals and conversations, named agent chats, Add to chat, Fix in session and tasks you start in the foreground.

| Value         | Effect                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------ |
| Automatic     | A new worktree while another writing session works in the checkout, otherwise the checkout |
| New worktree  | Each writing session gets its own worktree                                                 |
| This checkout | Each writing session works in your checkout                                                |

The setting is stored as `agent.writingSessions` (`"worktree"` or `"checkout"`) in `.pragma/settings.json` and is shared with everyone who opens the folder. Without it, Pragma uses **Automatic**.

Some sessions do not follow the setting:

- **Ask** sessions only read, so they always use the checkout.
- An explicit choice, such as **Agent > This checkout** in the **New session** menu, wins over the setting.
- Tasks started in the background always work in a worktree, either their own or, with [Start in parallel](./tasks.md#start-tasks-in-parallel), one they share.
- [Launch coding CLIs](./coding-clis.md#run-several-clis-side-by-side) has its own choice between own worktrees, one shared worktree and the checkout.
- **Duplicate** and **Fork** keep the environment of the session they copy.
- In a folder that is not a git repository, every session uses the folder itself.

If the setup hook fails, Pragma reports it with a notification, whichever way the session was started.

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

## When worktrees are removed

With **Settings > Agents > Remove worktrees automatically when a session is finished** turned on (the default), Pragma removes a worktree as soon as no session needs it anymore:

- after **Finish > Merge** succeeded
- when you delete a thread
- when a stale coding CLI terminal is cleaned up
- when sessions are archived, for example together with their parent thread or a deleted named agent
- when a task moves to **Done** or is deleted
- when you open the folder and a worktree belongs to no session anymore, for example one left by an earlier version. Pragma also runs `git worktree prune` then; such a worktree with uncommitted changes is only reported

A worktree that several sessions share stays as long as one of them is still running or not finished. Sessions that used it continue in the checkout.

Automatic removal never loses work:

- Only worktrees on a `pragma/<id>` branch are touched.
- A worktree with uncommitted changes is kept. A notification offers **Discard** to remove it anyway. Deleting a thread whose worktree has uncommitted changes warns you first.
- The `pragma/...` branch is deleted only when it is merged into the branch of your checkout. Otherwise the branch stays, so you can still merge it or open a pull request.
- If the teardown hook fails, the worktree is kept and the hook output is shown.

With the setting turned off, worktrees are only removed when you choose to: after **Finish > Merge**, Pragma asks whether to remove the worktree, and **Discard worktree** removes it at any time.

## Discard a worktree

Open the thread's context menu and choose **Discard worktree**.

1. Pragma checks the worktree for uncommitted changes. If there are any, you have to confirm a second time, because they are lost permanently.
2. A running agent in that session is stopped.
3. The teardown hook runs.
4. The worktree is removed. Select **Also delete the branch** to remove the `pragma/...` branch as well.

The thread itself stays and continues in the checkout.

Only branches that follow the `pragma/<id>` pattern can be deleted this way, so a discard never removes one of your own branches.
