import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import type { GitActions, GitConflictSides, GitSlice } from "./types";

export const createConflictsSlice: GitSlice<
  Pick<
    GitActions,
    "focusConflicts" | "openConflict" | "closeConflict" | "resolveConflict" | "markConflictResolved"
  >
> = (set, get) => ({
  focusConflicts: async () => {
    await get().loadStatus();
    const paths = (get().snapshot?.changed_files ?? [])
      .filter((entry) => entry.is_conflicted)
      .map((entry) => entry.path);
    if (paths.length > 0) {
      await get().openConflict(paths[0]);
    }
    return paths;
  },

  openConflict: async (path: string) => {
    const { repoPath } = get();
    if (!repoPath) return;

    set({ conflictPath: path, conflictSides: null, conflictLoading: true });
    try {
      const sides = await invoke<GitConflictSides>("git_conflict_sides", { repoPath, path });
      set({ conflictSides: sides, conflictLoading: false });
    } catch (err) {
      toast.error(`Failed to load conflict: ${String(err)}`);
      set({ conflictSides: null, conflictLoading: false });
    }
  },

  closeConflict: () => set({ conflictPath: null, conflictSides: null, conflictLoading: false }),

  resolveConflict: async (path: string, content: string) => {
    const { repoPath } = get();
    if (!repoPath) return;

    set({ conflictLoading: true });
    try {
      await invoke("git_resolve_conflict", { repoPath, path, content });
      toast.success(`Resolved ${path}`);
      set({ conflictPath: null, conflictSides: null });
      await get().loadStatus();
    } catch (err) {
      toast.error(String(err));
      set({ error: String(err) });
    } finally {
      set({ conflictLoading: false });
    }
  },

  markConflictResolved: async (path: string) => {
    const { repoPath } = get();
    if (!repoPath) return;

    set({ conflictLoading: true });
    try {
      await invoke("git_stage", { repoPath, paths: [path] });
      toast.success(`Marked ${path} as resolved`);
      set({ conflictPath: null, conflictSides: null });
      await get().loadStatus();
    } catch (err) {
      toast.error(String(err));
      set({ error: String(err) });
    } finally {
      set({ conflictLoading: false });
    }
  },
});
