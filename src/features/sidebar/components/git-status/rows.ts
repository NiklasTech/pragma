import { type GitStatusEntry } from "@/shared/stores/git";

import { FILE_STATES, fileState, type FileState } from "./fileState";

export type GitRow =
  | { kind: "conflict-header"; key: string; count: number }
  | { kind: "conflict-entry"; key: string; entry: GitStatusEntry }
  | { kind: "file"; key: string; entry: GitStatusEntry }
  | { kind: "clean-hint"; key: string };

export const ROW_HEIGHTS = {
  "conflict-header": 28,
  "conflict-entry": 36,
  file: 34,
  "clean-hint": 120,
} as const;

/** How many changed files each state has, conflicts left out. */
export function countByState(files: readonly GitStatusEntry[]): Record<FileState, number> {
  const counts: Record<FileState, number> = { M: 0, A: 0, U: 0, R: 0, D: 0 };
  for (const entry of files) if (!entry.is_conflicted) counts[fileState(entry)] += 1;
  return counts;
}

/** Conflicts first, then the changed files ordered by state; `filter` shows one state only. */
export function buildRows({
  allFiles,
  filter,
}: {
  allFiles: readonly GitStatusEntry[];
  filter: FileState | null;
}): GitRow[] {
  const result: GitRow[] = [];
  if (allFiles.length === 0) {
    result.push({ kind: "clean-hint", key: "clean-hint" });
    return result;
  }

  const conflicts = allFiles.filter((entry) => entry.is_conflicted);
  if (conflicts.length > 0 && filter === null) {
    result.push({ kind: "conflict-header", key: "conflict-header", count: conflicts.length });
    for (const entry of conflicts) {
      result.push({ kind: "conflict-entry", key: `conflict-${entry.path}`, entry });
    }
  }

  for (const state of FILE_STATES) {
    if (filter !== null && filter !== state) continue;
    for (const entry of allFiles) {
      if (entry.is_conflicted || fileState(entry) !== state) continue;
      result.push({ kind: "file", key: `file-${entry.path}`, entry });
    }
  }
  return result;
}
