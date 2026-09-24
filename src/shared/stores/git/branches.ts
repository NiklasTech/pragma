import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { saveWorkspace, loadWorkspace } from "../workspace";
import type { GitActions, GitBranch, GitSlice } from "./types";

export const createBranchesSlice: GitSlice<
  Pick<
    GitActions,
    "loadBranches" | "checkoutBranch" | "smartCheckout" | "createBranch" | "deleteBranch"
  >
> = (set, get) => ({
  loadBranches: async () => {
    const { repoPath } = get();
    if (!repoPath) return;

    set({ isLoading: true, error: null });
    try {
      const result = await invoke<{ branches: GitBranch[] }>("git_branches", { repoPath });
      set({ branches: result.branches, isLoading: false });
    } catch (err) {
      set({ branches: [], isLoading: false, error: String(err) });
    }
  },

  checkoutBranch: async (branchName: string) => {
    const { repoPath, snapshot } = get();
    if (!repoPath) return;

    const currentBranch = snapshot?.repo.branch;

    set({ actionBusy: "checkout" });
    try {
      if (currentBranch) {
        await saveWorkspace(repoPath, currentBranch);
      }
      await invoke("git_checkout_branch", { repoPath, branchName });
      await loadWorkspace(repoPath, branchName);
      await get().refreshAll();
    } catch (err) {
      set({ error: String(err) });
    } finally {
      set({ actionBusy: null });
    }
  },

  smartCheckout: async (branchName: string) => {
    const { repoPath, snapshot } = get();
    if (!repoPath) return;

    const currentBranch = snapshot?.repo.branch;

    set({ actionBusy: "checkout", actionStatus: "Smart switching branch…" });
    try {
      if (currentBranch) {
        await saveWorkspace(repoPath, currentBranch);
      }
      const result = await invoke<{
        stashed: boolean;
        stash_ref: string | null;
        checkout_ok: boolean;
        pop_ok: boolean;
        pop_conflict: boolean;
      }>("git_smart_checkout", { repoPath, branchName });

      if (!result.checkout_ok) {
        throw new Error("Checkout failed");
      }

      if (result.pop_conflict) {
        toast.warning("Stash applied with conflicts. Resolve conflicts before continuing.");
        await get().focusConflicts();
      } else if (result.stashed && !result.pop_ok) {
        toast.error("Failed to restore stashed changes.");
      }

      await loadWorkspace(repoPath, branchName);
      await get().refreshAll();

      if (result.stashed && result.pop_ok && !result.pop_conflict) {
        toast.success("Switched branch and restored changes");
      }
    } catch (err) {
      set({ error: String(err) });
      toast.error(String(err));
    } finally {
      set({ actionBusy: null, actionStatus: null });
    }
  },

  createBranch: async (branchName: string, checkout = false) => {
    const { repoPath } = get();
    if (!repoPath) return;

    set({ actionBusy: "create-branch" });
    try {
      await invoke("git_create_branch", { repoPath, branchName, checkout });
      await get().refreshAll();
    } catch (err) {
      set({ error: String(err) });
    } finally {
      set({ actionBusy: null });
    }
  },

  deleteBranch: async (branchName: string) => {
    const { repoPath } = get();
    if (!repoPath) return;

    set({ actionBusy: "delete-branch" });
    try {
      await invoke("git_delete_branch", { repoPath, branchName });
      await get().loadBranches();
    } catch (err) {
      set({ error: String(err) });
    } finally {
      set({ actionBusy: null });
    }
  },
});
