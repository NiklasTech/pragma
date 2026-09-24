import { invoke } from "@tauri-apps/api/core";
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
      error: null,
    });
    if (path) {
      void get().refreshAll();
    }
  },

  loadStatus: async () => {
    const { repoPath } = get();
    if (!repoPath) return;

    set({ isLoading: true, error: null });
    try {
      const result = await invoke<{ snapshot: GitStatusSnapshot }>("git_status", { repoPath });
      set({ snapshot: result.snapshot, isLoading: false });
    } catch (err) {
      set({ snapshot: null, isLoading: false, error: String(err) });
    }
  },

  refreshAll: async () => {
    const { loadStatus, loadBranches, loadLog, loadRemotes, loadStashes } = get();
    await Promise.all([loadStatus(), loadBranches(), loadLog(), loadRemotes(), loadStashes()]);
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
