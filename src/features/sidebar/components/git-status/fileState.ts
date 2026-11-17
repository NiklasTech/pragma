import type { GitStatusEntry } from "@/shared/stores/git";

/** Git's own letters: modified, added, untracked, renamed, deleted. */
export type FileState = "M" | "A" | "U" | "R" | "D";

export const FILE_STATES: readonly FileState[] = ["M", "A", "U", "R", "D"];

/** The word a letter stands for, shown on hover, and the color class of the state. */
export const STATE_INFO: Record<FileState, { title: string; color: string }> = {
  M: { title: "Modified", color: "text-git-modified" },
  A: { title: "New, added to git", color: "text-git-added" },
  U: { title: "Untracked, new to git", color: "text-git-untracked" },
  R: { title: "Moved or renamed", color: "text-[var(--color-git-conflict)]" },
  D: { title: "Deleted", color: "text-git-deleted" },
};

export function fileState(entry: GitStatusEntry): FileState {
  if (entry.status_code === "?") return "U";
  if (entry.status_code === "A") return "A";
  if (entry.status_code === "D") return "D";
  if (entry.status_code === "R" || entry.original_path) return "R";
  return "M";
}

/** Whether all of the file, part of it or none of it is staged. */
export type StageState = "staged" | "part" | "none";

export function stageState(entry: GitStatusEntry): StageState {
  if (!entry.is_staged) return "none";
  return entry.is_unstaged ? "part" : "staged";
}
