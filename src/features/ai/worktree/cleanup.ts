import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

import { useAgentStore } from "@/features/agent/store";
import { useAIStore, type ChatSession, type WorkEnvironment } from "@/shared/stores/ai";
import { useGitStore } from "@/shared/stores/git";
import { useSettingsStore } from "@/shared/stores/settings";

import { getChildRun, isRunLive } from "../children/runStore";
import { getTerminalEntryStatus } from "../terminal/runner";
import { removeWorktreeEnvironment } from "./remove";

export type WorktreeRelease = "removed" | "skipped" | "in-use" | "dirty" | "failed";

const PRAGMA_BRANCH = /^pragma\/[0-9a-f]{8}(-\d+)?$/;

/** Mirrors `is_pragma_branch` on the Rust side. */
export function isPragmaBranch(branch: string): boolean {
  return PRAGMA_BRANCH.test(branch);
}

export function autoRemoveWorktrees(): boolean {
  return useSettingsStore.getState().agent.removeWorktrees;
}

function isSessionRunning(sessionId: string): boolean {
  return (
    useAgentStore.getState().runSessionId === sessionId ||
    isRunLive(getChildRun(sessionId)) ||
    getTerminalEntryStatus(sessionId) === "running"
  );
}

/** Why a worktree has to stay once the finished sessions no longer need it, or null when it can go. */
export function worktreeKeepReason(
  environment: WorkEnvironment | undefined,
  sessions: readonly Pick<ChatSession, "id" | "environmentId" | "archived">[],
  finishedIds: ReadonlySet<string>,
  isRunning: (sessionId: string) => boolean,
): "skipped" | "in-use" | null {
  if (environment?.kind !== "worktree" || !isPragmaBranch(environment.branch)) return "skipped";
  const needed = sessions.some(
    (session) =>
      session.environmentId === environment.id &&
      (isRunning(session.id) || (!finishedIds.has(session.id) && !session.archived)),
  );
  return needed ? "in-use" : null;
}

/** Removes the worktree and deletes its branch once it is merged; `branchMerged` covers squash merges git cannot see. */
export async function removeWorktree(
  rootPath: string,
  worktree: WorkEnvironment,
  force: boolean,
  branchMerged = false,
) {
  if (!(await removeWorktreeEnvironment(rootPath, worktree, force))) return false;
  const merged =
    branchMerged ||
    (await invoke<boolean>("git_session_branch_merged", {
      repoPath: rootPath,
      branch: worktree.branch,
    }));
  if (merged) {
    await invoke("git_session_delete_branch", { repoPath: rootPath, branch: worktree.branch });
  }
  const git = useGitStore.getState();
  if (git.repoPath === rootPath) void git.loadBranches();
  return true;
}

/** Removes a worktree the finished sessions leave unused; uncommitted changes are only dropped with `force`. */
export async function releaseWorktree(
  rootPath: string,
  environmentId: string,
  finishedIds: ReadonlySet<string>,
  force = false,
  branchMerged = false,
): Promise<WorktreeRelease> {
  const { chatSessions, workEnvironments } = useAIStore.getState();
  const worktree = workEnvironments.find((environment) => environment.id === environmentId);
  const reason = worktreeKeepReason(worktree, chatSessions, finishedIds, isSessionRunning);
  if (reason || !worktree) return reason ?? "skipped";

  try {
    if (!force && (await invoke<boolean>("git_session_worktree_dirty", { path: worktree.path }))) {
      toast.warning(`Kept the worktree of ${worktree.branch}`, {
        description: `${worktree.path} has uncommitted changes.`,
        duration: Infinity,
        action: {
          label: "Discard",
          onClick: () =>
            void releaseWorktree(rootPath, environmentId, finishedIds, true, branchMerged),
        },
      });
      return "dirty";
    }
    return (await removeWorktree(rootPath, worktree, force, branchMerged)) ? "removed" : "failed";
  } catch (err) {
    toast.error(`Could not remove the worktree: ${String(err)}`);
    return "failed";
  }
}

/** Removes the worktrees the finished sessions leave unused, when the setting allows it. */
export async function releaseWorktrees(
  rootPath: string,
  finished: readonly Pick<ChatSession, "id" | "environmentId">[],
): Promise<void> {
  if (!autoRemoveWorktrees()) return;
  const finishedIds = new Set(finished.map((session) => session.id));
  const environmentIds = new Set(finished.flatMap((session) => session.environmentId ?? []));
  for (const environmentId of environmentIds) {
    await releaseWorktree(rootPath, environmentId, finishedIds);
  }
}
