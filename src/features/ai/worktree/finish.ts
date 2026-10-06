import { invoke } from "@tauri-apps/api/core";

import { useLayoutStore } from "@/shell/layout/store";
import { useUiModeStore } from "@/shell/mode";
import type { ChatMessage, SessionWorktree } from "@/shared/stores/ai";
import { useGitStore } from "@/shared/stores/git";
import type { GhCliStatus } from "@/shared/stores/github";

export type SessionMergeStrategy = "merge" | "merge-commit" | "rebase";

export type FinishAction = SessionMergeStrategy | "pull-request";

export interface SessionMergeResult {
  target: string;
  completed: boolean;
  conflicts: string[];
  rebase_conflicts: boolean;
}

export function finishSessionMerge(
  rootPath: string,
  worktree: SessionWorktree,
  strategy: SessionMergeStrategy,
): Promise<SessionMergeResult> {
  return invoke<SessionMergeResult>("git_session_finish_merge", {
    repoPath: rootPath,
    worktreePath: worktree.path,
    branch: worktree.branch,
    strategy,
  });
}

export function pushSessionBranch(rootPath: string, worktree: SessionWorktree): Promise<void> {
  return invoke("git_session_push_branch", {
    repoPath: rootPath,
    worktreePath: worktree.path,
    branch: worktree.branch,
  });
}

const ghReady = new Map<string, Promise<boolean>>();

/** Whether `gh` is installed and authenticated, checked once per repository. */
export function isGhReady(rootPath: string): Promise<boolean> {
  let ready = ghReady.get(rootPath);
  if (!ready) {
    ready = invoke<GhCliStatus>("gh_cli_status", { repoPath: rootPath })
      .then((status) => status.installed && status.authenticated)
      .catch(() => false);
    ghReady.set(rootPath, ready);
  }
  return ready;
}

/** Shows the checkout's conflicts in the editor's conflict dialog. */
export async function openCheckoutConflicts(rootPath: string): Promise<void> {
  useUiModeStore.getState().setUiMode("editor");
  const layout = useLayoutStore.getState();
  if (layout.sidebar.collapsed) layout.setSidebarCollapsed(false);
  if (layout.sidebar.tab !== "git-status") layout.setSidebarTab("git-status");
  const git = useGitStore.getState();
  if (git.repoPath !== rootPath) return;
  await git.refreshAll();
  await git.focusConflicts();
}

/** The task notes, or the session's first prompt. */
export function pullRequestBody(
  taskNotes: string | null,
  messages: readonly ChatMessage[],
): string {
  const notes = taskNotes?.trim();
  if (notes) return notes;
  return messages.find((message) => message.role === "user")?.content.trim() ?? "";
}
