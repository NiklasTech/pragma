import type { Task, TaskPriority } from "./types";

export const TASK_LABELS_MAX = 10;
export const TASK_LABEL_MAX = 32;

export const TASK_PRIORITIES: ReadonlyArray<{ value: TaskPriority; label: string }> = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export interface TaskFilter {
  priority: TaskPriority | null;
  label: string | null;
}

export const EMPTY_TASK_FILTER: TaskFilter = { priority: null, label: null };

/// Splits comma separated input into trimmed labels, dropping empty and repeated ones.
export function parseLabels(input: string): string[] {
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const part of input.split(",")) {
    const label = part.trim();
    const key = label.toLowerCase();
    if (!label || seen.has(key)) continue;
    seen.add(key);
    labels.push(label);
  }
  return labels;
}

export function validateLabels(labels: string[]): string | null {
  if (labels.length > TASK_LABELS_MAX) return `A task can have at most ${TASK_LABELS_MAX} labels`;
  if (labels.some((label) => label.length > TASK_LABEL_MAX)) {
    return `Labels must be ${TASK_LABEL_MAX} characters or fewer`;
  }
  return null;
}

/// Blockers of `task` that are not done yet; deleted blockers no longer count.
export function openBlockers(task: Pick<Task, "blockedBy">, tasks: Task[]): Task[] {
  const blockers = new Set(task.blockedBy ?? []);
  return tasks.filter((other) => blockers.has(other.id) && other.status !== "done");
}

/// Tasks that list `taskId` as a blocker, directly or through other tasks; they cannot block it.
export function dependentTaskIds(taskId: string, tasks: Task[]): Set<string> {
  const dependents = new Set<string>();
  const pending = [taskId];
  while (pending.length > 0) {
    const current = pending.pop();
    for (const task of tasks) {
      if (current && task.blockedBy?.includes(current) && !dependents.has(task.id)) {
        dependents.add(task.id);
        pending.push(task.id);
      }
    }
  }
  return dependents;
}

export function withoutBlocker(tasks: Task[], blockerId: string): Task[] {
  return tasks.map((task) =>
    task.blockedBy?.includes(blockerId)
      ? { ...task, blockedBy: task.blockedBy.filter((id) => id !== blockerId) }
      : task,
  );
}

export function listLabels(tasks: Task[]): string[] {
  const labels = new Map<string, string>();
  for (const task of tasks) {
    for (const label of task.labels ?? []) {
      if (!labels.has(label.toLowerCase())) labels.set(label.toLowerCase(), label);
    }
  }
  return [...labels.values()].sort((a, b) => a.localeCompare(b));
}

const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };

/// Applies the board filter and puts higher priorities first; equal ones keep their order.
export function filterTasks(tasks: Task[], filter: TaskFilter): Task[] {
  const label = filter.label?.toLowerCase();
  return tasks
    .filter((task) => !filter.priority || task.priority === filter.priority)
    .filter((task) => !label || (task.labels ?? []).some((item) => item.toLowerCase() === label))
    .map((task, index) => ({ task, index }))
    .sort(
      (a, b) =>
        (a.task.priority ? PRIORITY_RANK[a.task.priority] : 3) -
          (b.task.priority ? PRIORITY_RANK[b.task.priority] : 3) || a.index - b.index,
    )
    .map(({ task }) => task);
}
