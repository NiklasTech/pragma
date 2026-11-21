import type { GitStatusEntry, GitStatusSnapshot } from "./types";

function sameEntry(a: GitStatusEntry, b: GitStatusEntry): boolean {
  return (
    a.path === b.path &&
    a.status === b.status &&
    a.status_code === b.status_code &&
    a.is_staged === b.is_staged &&
    a.is_unstaged === b.is_unstaged &&
    a.is_conflicted === b.is_conflicted &&
    a.original_path === b.original_path
  );
}

/** Whether two status snapshots describe the same repository state. */
export function sameGitStatusSnapshot(
  a: GitStatusSnapshot | null,
  b: GitStatusSnapshot | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.ahead === b.ahead &&
    a.behind === b.behind &&
    a.repo.repo_root === b.repo.repo_root &&
    a.repo.branch === b.repo.branch &&
    a.repo.upstream === b.repo.upstream &&
    a.repo.is_detached === b.repo.is_detached &&
    a.changed_files.length === b.changed_files.length &&
    a.changed_files.every((entry, index) => sameEntry(entry, b.changed_files[index]))
  );
}

/** The current snapshot when the next one is equal, so subscribers see no change. */
export function keepEqualSnapshot(
  current: GitStatusSnapshot | null,
  next: GitStatusSnapshot,
): GitStatusSnapshot {
  return current && sameGitStatusSnapshot(current, next) ? current : next;
}
