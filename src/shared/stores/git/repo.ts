import { invoke } from "@tauri-apps/api/core";
import { keepEqualSnapshot } from "./snapshot";
import type { GitActions, GitSlice, GitStatusSnapshot } from "./types";

export const createReposSlice: GitSlice<
  Pick<
    GitActions,
    "setRepoPath" | "loadStatus" | "refreshAll" | "clearError" | "hasUncommittedChanges"
  >
> = (set, get) => ({
  setRepoPath: (path) => {
    set({
      repoPath: path,
      snapshot: null,
      branches: [],
      commits: [],
      graph: null,
      diffContent: null,
      diffPath: null,
      commitMessage: "",
      commitAmend: false,
      error: null,
      tags: [],
      operation: null,
    });
    if (path) {
      void get().refreshAll();
    }
  },

  loadStatus: async () => {
    const { repoPath } = get();
    if (!repoPath) return;

    // Background refreshes keep the shown status, so only the first load shows a spinner.
    const firstLoad = get().snapshot === null;
    if (firstLoad || get().error) set({ isLoading: firstLoad, error: null });
    try {
      const result = await invoke<{ snapshot: GitStatusSnapshot }>("git_status", { repoPath });
      const snapshot = keepEqualSnapshot(get().snapshot, result.snapshot);
      if (firstLoad || snapshot !== get().snapshot) set({ snapshot, isLoading: false });
    } catch (err) {
      set({ snapshot: null, isLoading: false, error: String(err) });
    }
  },

  refreshAll: async () => {
    const { loadStatus, loadBranches, loadLog, loadRemotes, loadStashes, loadOperation } = get();
    await Promise.all([
      loadStatus(),
      loadBranches(),
      loadLog(),
      loadRemotes(),
      loadStashes(),
      loadOperation(),
    ]);
  },

  clearError: () => set({ error: null }),

  hasUncommittedChanges: async () => {
    const { repoPath } = get();
    if (!repoPath) return false;

    try {
      return await invoke<boolean>("git_has_uncommitted_changes", { repoPath });
    } catch {
      return false;
    }
  },
});
