import type { Task } from "./types";

/// Sessions of tasks that moved to Done or were deleted, so their worktrees can go.
export function finishedTaskSessionIds(previous: readonly Task[], next: readonly Task[]): string[] {
  const nextById = new Map(next.map((task) => [task.id, task]));
  return previous.flatMap((task) => {
    if (!task.sessionId || task.status === "done") return [];
    const after = nextById.get(task.id);
    return !after || after.status === "done" ? [task.sessionId] : [];
  });
}
