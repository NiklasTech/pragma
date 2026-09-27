import type { Task, TaskStatus } from "./types";

export const TASK_TITLE_MAX = 120;
export const TASK_NOTES_MAX = 8000;
export const TASK_RESULT_MAX = 4000;

export const TASK_COLUMNS: ReadonlyArray<{ status: TaskStatus; label: string }> = [
  { status: "todo", label: "Todo" },
  { status: "in_progress", label: "In progress" },
  { status: "in_review", label: "In review" },
  { status: "done", label: "Done" },
];

export interface TaskFields {
  title: string;
  notes: string;
  result: string;
}

export function validateTaskFields(fields: TaskFields): string | null {
  const title = fields.title.trim();
  if (title.length < 1 || title.length > TASK_TITLE_MAX) {
    return `Title must be 1 to ${TASK_TITLE_MAX} characters`;
  }
  if (fields.notes.length > TASK_NOTES_MAX) {
    return `Notes must be ${TASK_NOTES_MAX} characters or fewer`;
  }
  if (fields.result.length > TASK_RESULT_MAX) {
    return `Result must be ${TASK_RESULT_MAX} characters or fewer`;
  }
  return null;
}

export function buildTaskMessage(task: Pick<Task, "title" | "notes">): string {
  const notes = task.notes.trim();
  return notes ? `${task.title.trim()}\n\n${notes}` : task.title.trim();
}

export function clampResult(text: string): string {
  return text.trim().slice(0, TASK_RESULT_MAX);
}
