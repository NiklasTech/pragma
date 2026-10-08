import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import type { GitActions, GitMergeResult, GitOperationKind, GitSlice } from "./types";

export const createIntegrationSlice: GitSlice<
  Pick<
    GitActions,
    "mergeBranch" | "rebaseBranch" | "loadOperation" | "continueOperation" | "abortOperation"
  >
> = (set, get) => {
  const finish = async (result: GitMergeResult, success: string, stopped: string) => {
    await get().refreshAll();
    if (result.completed) {
      toast.success(success);
      return;
    }
    toast.warning(stopped);
    await get().focusConflicts();
  };

  const run = async (busy: string, action: () => Promise<void>) => {
    const { repoPath } = get();
    if (!repoPath) return;

    set({ actionBusy: busy });
    try {
      await action();
    } catch (err) {
      toast.error(String(err));
      set({ error: String(err) });
    } finally {
      set({ actionBusy: null });
    }
  };

  return {
    mergeBranch: (branchName: string) =>
      run("merge", async () => {
        const result = await invoke<GitMergeResult>("git_merge_branch", {
          repoPath: get().repoPath,
          branchName,
        });
        await finish(
          result,
          `Merged ${branchName}`,
          `Merging ${branchName} stopped with conflicts. Resolve them, then continue.`,
        );
      }),

    rebaseBranch: (onto: string) =>
      run("rebase", async () => {
        const result = await invoke<GitMergeResult>("git_rebase_branch", {
          repoPath: get().repoPath,
          onto,
        });
        await finish(
          result,
          `Rebased onto ${onto}`,
          `Rebasing onto ${onto} stopped with conflicts. Resolve them, then continue.`,
        );
      }),

    loadOperation: async () => {
      const { repoPath } = get();
      if (!repoPath) return;
      try {
        const operation = await invoke<GitOperationKind | null>("git_operation_state", {
          repoPath,
        });
        set({ operation });
      } catch {
        set({ operation: null });
      }
    },

    continueOperation: () =>
      run("continue-operation", async () => {
        const kind = get().operation === "rebase" ? "Rebase" : "Merge";
        const result = await invoke<GitMergeResult>("git_continue_operation", {
          repoPath: get().repoPath,
        });
        await finish(
          result,
          `${kind} completed`,
          `${kind} stopped with new conflicts. Resolve them, then continue.`,
        );
      }),

    abortOperation: () =>
      run("abort-operation", async () => {
        const kind = get().operation === "rebase" ? "Rebase" : "Merge";
        await invoke("git_abort_operation", { repoPath: get().repoPath });
        get().closeConflict();
        toast.success(`${kind} aborted`);
        await get().refreshAll();
      }),
  };
};
