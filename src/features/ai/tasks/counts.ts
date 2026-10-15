import type { Task, TaskStatus } from "./types";

export type ActiveTaskStatus = Extract<TaskStatus, "in_progress" | "in_review">;

export const ACTIVE_TASK_STATUSES: ActiveTaskStatus[] = ["in_progress", "in_review"];

export function countActiveTasks(tasks: readonly Task[]): Record<ActiveTaskStatus, number> {
  const counts: Record<ActiveTaskStatus, number> = { in_progress: 0, in_review: 0 };
  for (const task of tasks) {
    if (task.status === "in_progress" || task.status === "in_review") counts[task.status] += 1;
  }
  return counts;
}
