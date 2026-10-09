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

/// A Todo task for `issue`, shortened to the task limits and linked back to the issue.
export function issueToTask(issue: GhIssue, now: number): Task {
  const labels = parseLabels(issue.labels.join(","))
    .filter((label) => label.length <= TASK_LABEL_MAX)
    .slice(0, TASK_LABELS_MAX);
  const task: Task = {
    id: crypto.randomUUID(),
    title: `#${issue.number} ${issue.title.trim()}`.slice(0, TASK_TITLE_MAX).trim(),
    notes: issue.body.trim().slice(0, TASK_NOTES_MAX),
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
