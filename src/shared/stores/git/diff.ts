import { invoke } from "@tauri-apps/api/core";
import type { DiffViewMode } from "@/features/editor/components/InlineDiff";
import type { GitActions, GitSlice } from "./types";

export const createDiffSlice: GitSlice<
  Pick<GitActions, "loadFileDiff" | "clearDiff" | "setCommitMessage" | "setDiffViewMode">
> = (set, get) => ({
  loadFileDiff: async (path: string, staged: boolean) => {
    const { repoPath } = get();
    if (!repoPath) return "";

    set({ isLoading: true, error: null });
    try {
      const content = await invoke<string>("git_diff_file", { repoPath, path, staged });
      set({ diffContent: content, diffPath: path, diffStaged: staged, isLoading: false });
      return content;
    } catch (err) {
      set({ diffContent: null, diffPath: null, isLoading: false, error: String(err) });
      return "";
    }
  },

  clearDiff: () => set({ diffContent: null, diffPath: null }),
  setCommitMessage: (value) => set({ commitMessage: value }),
  setDiffViewMode: (mode: DiffViewMode) => set({ diffViewMode: mode }),
});
