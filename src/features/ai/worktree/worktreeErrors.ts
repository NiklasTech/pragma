const LOCK = /([^\s'"]+\.lock)['"]?:? File exists/i;

/// A worktree failure in words a person can act on, with git's own text kept for the details.
export function explainWorktreeError(raw: string): { title: string; detail: string } {
  const text = raw.trim();
  const lower = text.toLowerCase();
  const lock = LOCK.exec(text);
  if (lock) {
    return {
      title: "Git is busy with another operation",
      detail: `${lock[1]} exists. If no git command is running, delete that file and try again.`,
    };
  }
  if (lower.includes("no space left on device") || lower.includes("disk quota exceeded")) {
    return {
      title: "The disk is full",
      detail: "Free some space, then start the agent again. Worktrees copy the checkout's files.",
    };
  }
  if (lower.includes("git is not available") || lower.includes("failed to spawn git")) {
    return {
      title: "Git was not found",
      detail: "Install Git, or make sure it is on your PATH, then start the agent again.",
    };
  }
  if (lower.includes("is too old")) {
    return { title: "Git is too old for worktrees", detail: text };
  }
  if (lower.includes("not a git repository")) {
    return {
      title: "This folder is not a git repository",
      detail: "Start the agent in This folder, or run git init first.",
    };
  }
  if (lower.includes("timed out")) {
    return {
      title: "Git took too long",
      detail: "Creating the worktree timed out. A large checkout or a slow disk can cause this.",
    };
  }
  if (lower.includes("permission denied") || lower.includes("operation not permitted")) {
    return {
      title: "Pragma may not write the worktree folder",
      detail: text,
    };
  }
  return { title: "Could not create the worktree", detail: text };
}

/** A failed worktree creation, explained; `message` reads well on its own. */
export class WorktreeError extends Error {
  readonly title: string;
  readonly detail: string;

  constructor(raw: string) {
    const { title, detail } = explainWorktreeError(raw);
    super(`${title}. ${detail}`);
    this.name = "WorktreeError";
    this.title = title;
    this.detail = detail;
  }
}
