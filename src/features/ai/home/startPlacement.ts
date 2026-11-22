import type { EnvironmentChoice } from "../sessions/environment";
import type { GroupEnvironment } from "../sessions/group";

export interface StartPlacementInput {
  /** More than one agent starts. */
  several: boolean;
  /** The project's setting for writing sessions, if it has one. */
  setting: EnvironmentChoice | undefined;
  /** Git finished loading and the folder is no repository, so there are no worktrees. */
  noGit: boolean;
  /** Where a single new session would run by default. */
  single: EnvironmentChoice;
}

export interface StartPlacement {
  groupMode: GroupEnvironment;
  /** Shown next to Start. */
  label: string;
}

/// Where the agents of a start run, and the words the start card shows for it.
export function startPlacement({
  several,
  setting,
  noGit,
  single,
}: StartPlacementInput): StartPlacement {
  // Several agents on one task would edit the same files, so each gets a worktree unless the project says otherwise.
  const groupMode: GroupEnvironment = setting === "checkout" || noGit ? "checkout" : "isolated";
  if (several) {
    if (groupMode === "isolated") return { groupMode, label: "each in its own worktree" };
    return { groupMode, label: noGit ? "all in this folder (no Git)" : "all in this folder" };
  }
  const inWorktree = !noGit && single === "worktree";
  return { groupMode, label: inWorktree ? "in a new worktree" : "in this folder" };
}
