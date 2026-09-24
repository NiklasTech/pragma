import { invoke } from "@tauri-apps/api/core";
import type { GitActions, GitSlice } from "./types";

export const createStagingSlice: GitSlice<
  Pick<GitActions, "stageFiles" | "unstageFiles" | "discardFiles" | "commit">
> = (set, get) => ({
  stageFiles: async (paths: string[]) => {
    const { repoPath } = get();
    if (!repoPath) return;

    set({ actionBusy: "stage" });
    try {
      await invoke("git_stage", { repoPath, paths });
      await get().loadStatus();
    } catch (err) {
      set({ error: String(err) });
    } finally {
      set({ actionBusy: null });
    }
  },

  unstageFiles: async (paths: string[]) => {
    const { repoPath } = get();
    if (!repoPath) return;

    set({ actionBusy: "unstage" });
    try {
      await invoke("git_unstage", { repoPath, paths });
      await get().loadStatus();
    } catch (err) {
      set({ error: String(err) });
    } finally {
      set({ actionBusy: null });
    }
  },

  discardFiles: async (paths: string[]) => {
    const { repoPath } = get();
    if (!repoPath) return;

    set({ actionBusy: "discard" });
    try {
      await invoke("git_discard", { repoPath, paths });
      await get().loadStatus();
    } catch (err) {
      set({ error: String(err) });
    } finally {
      set({ actionBusy: null });
    }
  },

  commit: async () => {
    const { repoPath, commitMessage, loadStatus } = get();
    if (!repoPath || !commitMessage.trim()) return;

    set({ actionBusy: "commit" });
    try {
      await invoke<{ commit_sha: string }>("git_commit", {
        repoPath,
        message: commitMessage.trim(),
      });
      set({ commitMessage: "" });
      await loadStatus();
    } catch (err) {
      set({ error: String(err) });
    } finally {
      set({ actionBusy: null });
    }
  },
});
