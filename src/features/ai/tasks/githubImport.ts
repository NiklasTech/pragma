import { parseLabels, TASK_LABEL_MAX, TASK_LABELS_MAX } from "./organize";
import type { Task } from "./types";
import { TASK_NOTES_MAX, TASK_TITLE_MAX } from "./validation";

export interface GhIssue {
  number: number;
  title: string;
  body: string;
  url: string;
  labels: string[];
}

/// Issues that no task links to yet.
export function importableIssues(issues: GhIssue[], tasks: Task[]): GhIssue[] {
  const linked = new Set(tasks.map((task) => task.issueUrl).filter(Boolean));
  return issues.filter((issue) => !linked.has(issue.url));
}

/// Cuts to `max` UTF-16 units without leaving half a surrogate pair, which the backend rejects.
function clip(text: string, max: number): string {
  return text.slice(0, max).replace(/[\uD800-\uDBFF]$/, "");
}

/// A Todo task for `issue`, shortened to the task limits and linked back to the issue.
export function issueToTask(issue: GhIssue, now: number): Task {
  const labels = parseLabels(issue.labels.join(","))
    .filter((label) => label.length <= TASK_LABEL_MAX)
    .slice(0, TASK_LABELS_MAX);
  const task: Task = {
    id: crypto.randomUUID(),
    title: clip(`#${issue.number} ${issue.title.trim()}`, TASK_TITLE_MAX).trim(),
    notes: clip(issue.body.trim(), TASK_NOTES_MAX),
    status: "todo",
    result: "",
    issueUrl: issue.url,
    issueNumber: issue.number,
    createdAt: now,
    updatedAt: now,
  };
  if (labels.length > 0) task.labels = labels;
  return task;
}
