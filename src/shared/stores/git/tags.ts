import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import type { GitActions, GitSlice, GitTag } from "./types";

export const createTagsSlice: GitSlice<Pick<GitActions, "loadTags" | "createTag" | "deleteTag">> = (
  set,
  get,
) => ({
  loadTags: async () => {
    const { repoPath } = get();
    if (!repoPath) return;
    try {
      const tags = await invoke<GitTag[]>("git_tags", { repoPath });
      set({ tags });
    } catch (err) {
      set({ tags: [], error: String(err) });
    }
  },

  createTag: async (name: string, target?: string, message?: string) => {
    const { repoPath } = get();
    if (!repoPath) return false;

    set({ actionBusy: "create-tag" });
    try {
      await invoke("git_create_tag", {
        repoPath,
        name,
        target: target ?? null,
        message: message ?? null,
      });
      toast.success(`Created tag ${name}`);
      await Promise.all([get().loadTags(), get().loadStatus()]);
      return true;
    } catch (err) {
      toast.error(String(err));
      return false;
    } finally {
      set({ actionBusy: null });
    }
  },

  deleteTag: async (name: string) => {
    const { repoPath } = get();
    if (!repoPath) return;

    set({ actionBusy: "delete-tag" });
    try {
      await invoke("git_delete_tag", { repoPath, name });
      toast.success(`Deleted tag ${name}`);
      await Promise.all([get().loadTags(), get().loadStatus()]);
    } catch (err) {
      toast.error(String(err));
    } finally {
      set({ actionBusy: null });
    }
  },
});
