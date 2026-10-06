import type { ReviewRow } from "./rows";

const DEFAULT_SESSION_TITLE = "New Chat";

/** The task title, or the session title when the session has no task. */
export function commitMessageFor(taskTitle: string | null, sessionTitle: string | null): string {
  const task = taskTitle?.trim();
  if (task) return task;
  const session = sessionTitle?.trim();
  return session && session !== DEFAULT_SESSION_TITLE ? session : "";
}

/** Paths to stage for the session's written changes, including the old side of renames. */
export function commitPaths(rows: readonly ReviewRow[]): string[] {
  const paths = new Set<string>();
  for (const row of rows) {
    if (!row.gitEntry) continue;
    paths.add(row.gitEntry.path);
    if (row.gitEntry.original_path) paths.add(row.gitEntry.original_path);
  }
  return [...paths];
}
