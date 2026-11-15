import { useMemo } from "react";

import { useAIStore } from "@/shared/stores/ai";

import { repositoryWorktrees, useWorktreeViewStore, type RepositoryWorktree } from "./worktreeView";

/// The repository's agent worktrees and the one the tree shows, null for the repository's own folder.
export function useRepositoryWorktrees(rootPath: string | null): {
  worktrees: RepositoryWorktree[];
  shown: RepositoryWorktree | null;
} {
  const environments = useAIStore((state) => state.workEnvironments);
  const sessions = useAIStore((state) => state.chatSessions);
  const shownId = useWorktreeViewStore((state) => (rootPath ? state.byRoot[rootPath] : undefined));
  return useMemo(() => {
    const worktrees = rootPath ? repositoryWorktrees(rootPath, environments, sessions) : [];
    const shown = worktrees.find((item) => item.environment.id === shownId) ?? null;
    return { worktrees, shown };
  }, [rootPath, environments, sessions, shownId]);
}
