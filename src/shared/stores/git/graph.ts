import { invoke } from "@tauri-apps/api/core";
import type { GitActions, GitGraphData, GitSlice } from "./types";

export const createGraphSlice: GitSlice<Pick<GitActions, "loadGraph">> = (set, get) => ({
  loadGraph: async (offset?: number, limit?: number) => {
    const { repoPath } = get();
    if (!repoPath) return;

    set({ isLoading: true, error: null });
    try {
      const result = await invoke<{ data: GitGraphData }>("git_graph", {
        repoPath,
        offset,
        limit,
      });
      set({ graph: result.data, isLoading: false });
    } catch (err) {
      set({ graph: null, isLoading: false, error: String(err) });
    }
  },
});
