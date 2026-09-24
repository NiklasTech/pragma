import { type GitStatusEntry, type GitCommit } from "@/shared/stores/git";

export type GitRow =
  | { kind: "commit-area"; key: string }
  | { kind: "conflict-header"; key: string; count: number }
  | { kind: "conflict-entry"; key: string; entry: GitStatusEntry }
  | { kind: "staged-header"; key: string; count: number }
  | { kind: "staged-entry"; key: string; entry: GitStatusEntry }
  | { kind: "unstaged-header"; key: string; count: number }
  | { kind: "unstaged-entry"; key: string; entry: GitStatusEntry }
  | { kind: "clean-hint"; key: string }
  | { kind: "history-header"; key: string }
  | { kind: "history-entry"; key: string; commit: GitCommit };

export const ROW_HEIGHTS = {
  "commit-area": 130,
  "conflict-header": 24,
  "conflict-entry": 36,
  "staged-header": 24,
  "staged-entry": 36,
  "unstaged-header": 24,
  "unstaged-entry": 36,
  "clean-hint": 120,
  "history-header": 28,
  "history-entry": 44,
} as const;

export function buildRows({
  allFiles,
  conflictFiles,
  stagedFiles,
  unstagedFiles,
  commits,
  historyExpanded,
}: {
  allFiles: GitStatusEntry[];
  conflictFiles: GitStatusEntry[];
  stagedFiles: GitStatusEntry[];
  unstagedFiles: GitStatusEntry[];
  commits: GitCommit[];
  historyExpanded: boolean;
}): GitRow[] {
  const result: GitRow[] = [];
  result.push({ kind: "commit-area", key: "commit-area" });

  if (allFiles.length === 0) {
    result.push({ kind: "clean-hint", key: "clean-hint" });
  } else {
    if (conflictFiles.length > 0) {
      result.push({
        kind: "conflict-header",
        key: "conflict-header",
        count: conflictFiles.length,
      });
      for (const entry of conflictFiles) {
        result.push({ kind: "conflict-entry", key: `conflict-${entry.path}`, entry });
      }
    }
    if (stagedFiles.length > 0) {
      result.push({ kind: "staged-header", key: "staged-header", count: stagedFiles.length });
      for (const entry of stagedFiles) {
        result.push({ kind: "staged-entry", key: `staged-${entry.path}`, entry });
      }
    }
    if (unstagedFiles.length > 0) {
      result.push({
        kind: "unstaged-header",
        key: "unstaged-header",
        count: unstagedFiles.length,
      });
      for (const entry of unstagedFiles) {
        result.push({ kind: "unstaged-entry", key: `unstaged-${entry.path}`, entry });
      }
    }
  }

  if (commits.length > 0) {
    result.push({ kind: "history-header", key: "history-header" });
    if (historyExpanded) {
      for (const c of commits) {
        result.push({ kind: "history-entry", key: `commit-${c.id}`, commit: c });
      }
    }
  }

  return result;
}
