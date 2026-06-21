import { useCallback, useEffect } from "react";
import { useGitStore } from "@/shared/stores";

export function useGit(repoPath: string | null) {
  const store = useGitStore();

  const refresh = useCallback(() => {
    if (!repoPath) return;
    void store.refreshAll();
  }, [repoPath, store]);

  useEffect(() => {
    store.setRepoPath(repoPath);
    if (repoPath) {
      void store.refreshAll();
    }
  }, [repoPath, store]);

  return {
    snapshot: store.snapshot,
    branches: store.branches,
    commits: store.commits,
    isLoading: store.isLoading,
    error: store.error,
    refresh,
    loadStatus: store.loadStatus,
    loadBranches: store.loadBranches,
    loadLog: store.loadLog,
    clearError: store.clearError,
  };
}
