import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import type {
  GitActions,
  GitCommit,
  GitCommitDetails,
  GitDiffContentResult,
  GitSlice,
} from "./types";

export const createCommitsSlice: GitSlice<
  Pick<
    GitActions,
    | "loadLog"
    | "loadCommitDetails"
    | "loadCommitFileDiff"
    | "checkoutCommit"
    | "createBranchFromCommit"
    | "cherryPickCommit"
    | "revertCommit"
    | "resetToCommit"
  >
> = (set, get) => ({
  loadLog: async (limit) => {
    const { repoPath } = get();
    if (!repoPath) return;

    set({ isLoading: true, error: null });
    try {
      const result = await invoke<{ commits: GitCommit[] }>("git_log", { repoPath, limit });
      set({ commits: result.commits, isLoading: false });
    } catch (err) {
      set({ commits: [], isLoading: false, error: String(err) });
    }
  },

  loadCommitDetails: async (sha: string) => {
    const { repoPath } = get();
    if (!repoPath) return null;

    try {
      const result = await invoke<GitCommitDetails>("git_commit_details", { repoPath, sha });
      return result;
    } catch (err) {
      toast.error(`Failed to load commit details: ${String(err)}`);
      return null;
    }
  },

  loadCommitFileDiff: async (sha: string, path: string, originalPath?: string | null) => {
    const { repoPath } = get();
    if (!repoPath) return null;

    try {
      const result = await invoke<GitDiffContentResult>("git_commit_file_diff", {
        repoPath,
        sha,
        path,
        originalPath: originalPath ?? null,
      });
      return result;
    } catch (err) {
      toast.error(`Failed to load diff: ${String(err)}`);
      return null;
    }
  },

  checkoutCommit: async (sha: string) => {
    const { repoPath } = get();
    if (!repoPath) return;

    set({ actionBusy: "checkout-commit" });
    try {
      await invoke("git_checkout_commit", { repoPath, sha });
      toast.success(`Checked out ${sha.slice(0, 7)}`);
      await get().refreshAll();
    } catch (err) {
      toast.error(String(err));
      set({ error: String(err) });
    } finally {
      set({ actionBusy: null });
    }
  },

  createBranchFromCommit: async (branchName: string, sha: string, checkout = false) => {
    const { repoPath } = get();
    if (!repoPath) return;

    set({ actionBusy: "create-branch" });
    try {
      await invoke("git_create_branch_from_commit", { repoPath, branchName, sha, checkout });
      toast.success(`Created branch ${branchName}`);
      await get().refreshAll();
    } catch (err) {
      toast.error(String(err));
      set({ error: String(err) });
    } finally {
      set({ actionBusy: null });
    }
  },

  cherryPickCommit: async (sha: string) => {
    const { repoPath } = get();
    if (!repoPath) return;

    set({ actionBusy: "cherry-pick" });
    try {
      await invoke("git_cherry_pick_commit", { repoPath, sha });
      toast.success(`Cherry-picked ${sha.slice(0, 7)}`);
      await get().refreshAll();
    } catch (err) {
      const msg = String(err);
      if (msg.includes("conflict")) {
        toast.error("Cherry-pick resulted in conflicts.");
        await get().focusConflicts();
      } else {
        toast.error(msg);
      }
      set({ error: msg });
    } finally {
      set({ actionBusy: null });
    }
  },

  revertCommit: async (sha: string) => {
    const { repoPath } = get();
    if (!repoPath) return;

    set({ actionBusy: "revert" });
    try {
      await invoke("git_revert_commit", { repoPath, sha });
      toast.success(`Reverted ${sha.slice(0, 7)}`);
      await get().refreshAll();
    } catch (err) {
      const msg = String(err);
      if (msg.includes("conflict")) {
        toast.error("Revert resulted in conflicts.");
        await get().focusConflicts();
      } else {
        toast.error(msg);
      }
      set({ error: msg });
    } finally {
      set({ actionBusy: null });
    }
  },

  resetToCommit: async (sha: string, mode: "soft" | "mixed" | "hard") => {
    const { repoPath } = get();
    if (!repoPath) return;

    set({ actionBusy: "reset" });
    try {
      await invoke("git_reset_to_commit", { repoPath, sha, mode });
      toast.success(`Reset ${mode} to ${sha.slice(0, 7)}`);
      await get().refreshAll();
    } catch (err) {
      toast.error(String(err));
      set({ error: String(err) });
    } finally {
      set({ actionBusy: null });
    }
  },
});
