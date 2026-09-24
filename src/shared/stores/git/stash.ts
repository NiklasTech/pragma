import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import type { GitActions, GitSlice, StashEntry } from "./types";

export const createStashSlice: GitSlice<
  Pick<GitActions, "loadStashes" | "stashPush" | "stashPop" | "stashApply" | "stashDrop">
> = (set, get) => ({
  loadStashes: async () => {
    const { repoPath } = get();
    if (!repoPath) return;

    try {
      const stashes = await invoke<StashEntry[]>("git_stash_list", { repoPath });
      set({ stashes });
    } catch {
      set({ stashes: [] });
    }
  },

  stashPush: async (message) => {
    const { repoPath } = get();
    if (!repoPath) return;

    set({ stashBusy: true });
    try {
      await invoke<string>("git_stash_push", { repoPath, message: message ?? "" });
      toast.success("Changes stashed");
      await get().loadStashes();
      await get().loadStatus();
    } catch (err) {
      toast.error(String(err));
      set({ error: String(err) });
    } finally {
      set({ stashBusy: false });
    }
  },

  stashPop: async (stashRef: string) => {
    const { repoPath } = get();
    if (!repoPath) return;

    set({ stashBusy: true });
    try {
      await invoke("git_stash_pop", { repoPath, stashRef });
      toast.success("Stash popped");
      await get().loadStashes();
      await get().loadStatus();
    } catch (err) {
      const msg = String(err);
      if (msg.toLowerCase().includes("conflict")) {
        toast.error("Stash popped with conflicts. Resolve them to continue.");
        await get().focusConflicts();
      } else {
        toast.error(msg);
        set({ error: msg });
      }
      await get().loadStashes();
    } finally {
      set({ stashBusy: false });
    }
  },

  stashApply: async (stashRef: string) => {
    const { repoPath } = get();
    if (!repoPath) return;

    set({ stashBusy: true });
    try {
      await invoke("git_stash_apply", { repoPath, stashRef });
      toast.success("Stash applied");
      await get().loadStatus();
    } catch (err) {
      const msg = String(err);
      if (msg.toLowerCase().includes("conflict")) {
        toast.error("Stash applied with conflicts. Resolve them to continue.");
        await get().focusConflicts();
      } else {
        toast.error(msg);
        set({ error: msg });
      }
    } finally {
      set({ stashBusy: false });
    }
  },

  stashDrop: async (stashRef: string) => {
    const { repoPath } = get();
    if (!repoPath) return;

    set({ stashBusy: true });
    try {
      await invoke("git_stash_drop", { repoPath, stashRef });
      toast.success("Stash dropped");
      await get().loadStashes();
    } catch (err) {
      toast.error(String(err));
      set({ error: String(err) });
    } finally {
      set({ stashBusy: false });
    }
  },
});
