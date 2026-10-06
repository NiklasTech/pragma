import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import type { GitActions, GitLastCommit, GitSlice } from "./types";

export const createLastCommitSlice: GitSlice<
  Pick<GitActions, "loadLastCommit" | "setCommitAmend" | "amendCommit" | "undoLastCommit">
> = (set, get) => ({
  loadLastCommit: async () => {
    const { repoPath } = get();
    if (!repoPath) return null;

    try {
      return await invoke<GitLastCommit | null>("git_last_commit", { repoPath });
    } catch (err) {
      set({ error: String(err) });
      return null;
    }
  },

  setCommitAmend: async (enabled) => {
    const last = await get().loadLastCommit();
    if (!enabled) {
      const { commitMessage } = get();
      set({
        commitAmend: false,
        commitMessage: last && commitMessage.trim() === last.message ? "" : commitMessage,
      });
      return;
    }
    if (!last) {
      toast.error("There is no commit to amend yet.");
      return;
    }
    const { commitMessage } = get();
    set({ commitAmend: true, commitMessage: commitMessage.trim() ? commitMessage : last.message });
  },

  amendCommit: async () => {
    const { repoPath, commitMessage } = get();
    if (!repoPath || !commitMessage.trim()) return;

    set({ actionBusy: "commit" });
    try {
      await invoke("git_amend_commit", { repoPath, message: commitMessage.trim() });
      set({ commitMessage: "", commitAmend: false });
      await get().refreshAll();
    } catch (err) {
      set({ error: String(err) });
    } finally {
      set({ actionBusy: null });
    }
  },

  undoLastCommit: async () => {
    const { repoPath } = get();
    if (!repoPath) return;

    const last = await get().loadLastCommit();
    set({ actionBusy: "undo-commit" });
    try {
      await invoke("git_undo_last_commit", { repoPath });
      if (last && !get().commitMessage.trim()) set({ commitMessage: last.message });
      toast.success("Undid the last commit. Its changes are staged.");
      await get().refreshAll();
    } catch (err) {
      toast.error(String(err));
      set({ error: String(err) });
    } finally {
      set({ actionBusy: null });
    }
  },
});
