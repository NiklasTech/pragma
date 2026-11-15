import { create } from "zustand";

import type { ChatSession, WorkEnvironment } from "@/shared/stores/ai";

export interface RepositoryWorktree {
  environment: WorkEnvironment;
  /** The session that works in the worktree, the newest when several share it. */
  sessionId: string | null;
}

/// The ready worktrees Pragma made for a repository, each with the session that works in it.
export function repositoryWorktrees(
  rootPath: string,
  environments: readonly WorkEnvironment[],
  sessions: readonly ChatSession[],
): RepositoryWorktree[] {
  return environments
    .filter(
      (environment) =>
        environment.rootPath === rootPath &&
        environment.kind === "worktree" &&
        environment.setupStatus === "ready",
    )
    .map((environment) => {
      const owners = sessions.filter((session) => session.environmentId === environment.id);
      const newest = owners.reduce<ChatSession | null>(
        (best, session) => (!best || session.updatedAt > best.updatedAt ? session : best),
        null,
      );
      return { environment, sessionId: newest?.id ?? null };
    });
}

interface WorktreeViewState {
  /** The worktree the file tree shows instead of a repository's own folder, by repository root. */
  byRoot: Record<string, string>;
  /** Open folders of each worktree's tree, by worktree path. */
  expanded: Record<string, string[]>;
  show: (rootPath: string, environmentId: string | null) => void;
  toggleDir: (worktreePath: string, dir: string) => void;
  collapse: (worktreePath: string) => void;
}

export const useWorktreeViewStore = create<WorktreeViewState>()((set) => ({
  byRoot: {},
  expanded: {},
  show: (rootPath, environmentId) =>
    set((state) => {
      const byRoot = { ...state.byRoot };
      if (environmentId) byRoot[rootPath] = environmentId;
      else delete byRoot[rootPath];
      return { byRoot };
    }),
  toggleDir: (worktreePath, dir) =>
    set((state) => {
      const open = state.expanded[worktreePath] ?? [];
      const next = open.includes(dir) ? open.filter((item) => item !== dir) : [...open, dir];
      return { expanded: { ...state.expanded, [worktreePath]: next } };
    }),
  collapse: (worktreePath) =>
    set((state) => ({ expanded: { ...state.expanded, [worktreePath]: [] } })),
}));
