import { invoke } from "@tauri-apps/api/core";
import type { GitActions, GitBlameLine, GitSlice } from "./types";

export const createBlameSlice: GitSlice<
  Pick<GitActions, "loadBlame" | "setBlameEnabled" | "toggleBlame" | "setBlameSelectedSha">
> = (set, get) => ({
  loadBlame: async (path: string) => {
    const { repoPath } = get();
    if (!repoPath) return;

    set({ blameLoading: true, blamePath: path });
    try {
      const lines = await invoke<GitBlameLine[]>("git_blame", { repoPath, path });
      set({ blameLines: lines, blameLoading: false });
    } catch {
      set({ blameLines: [], blameLoading: false });
    }
  },

  setBlameEnabled: (enabled: boolean) => set({ blameEnabled: enabled }),

  toggleBlame: () => {
    const enabled = !get().blameEnabled;
    if (!enabled) {
      set({ blameEnabled: false, blamePath: null, blameLines: [] });
      return;
    }
    set({ blameEnabled: true });
  },

  setBlameSelectedSha: (sha: string | null) => set({ blameSelectedSha: sha }),
});
