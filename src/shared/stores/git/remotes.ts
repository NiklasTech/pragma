import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import type { GitActions, GitRemote, GitRemoteBranch, GitSlice } from "./types";

export const createRemotesSlice: GitSlice<
  Pick<
    GitActions,
    "loadRemotes" | "loadRemoteBranches" | "push" | "pull" | "fetch" | "clearPushPullError"
  >
> = (set, get) => ({
  loadRemotes: async () => {
    const { repoPath } = get();
    if (!repoPath) return;

    try {
      const result = await invoke<{ remotes: GitRemote[] }>("git_remotes", { repoPath });
      set({ remotes: result.remotes });
    } catch {
      set({ remotes: [] });
    }
  },

  push: async (remoteName?: string, branchName?: string) => {
    const { repoPath } = get();
    if (!repoPath) return;

    set({
      actionBusy: "push",
      actionStatus: "Pushing…",
      actionProgress: null,
      pushPullError: null,
    });
    try {
      await invoke<{ pushed: boolean }>("git_push", { repoPath, remoteName, branchName });
      toast.success("Push complete");
      await get().loadStatus();
    } catch (err) {
      const msg = String(err);
      if (
        msg.includes("authentication") ||
        msg.includes("credentials") ||
        msg.includes("401") ||
        msg.includes("403")
      ) {
        toast.error("Authentication failed. Check your SSH key or HTTPS token.");
        set({ pushPullError: "Authentication failed. Check your SSH key or HTTPS token." });
      } else {
        toast.error(msg);
        set({ pushPullError: msg });
      }
    } finally {
      set({ actionBusy: null, actionStatus: null, actionProgress: null });
    }
  },

  pull: async (remoteName?: string, branchName?: string, rebase = false) => {
    const { repoPath } = get();
    if (!repoPath) return;

    set({
      actionBusy: "pull",
      actionStatus: "Pulling…",
      actionProgress: null,
      pushPullError: null,
    });
    try {
      const result = await invoke<{ pulled: boolean; had_conflicts: boolean }>("git_pull", {
        repoPath,
        remoteName,
        branchName,
        rebase,
      });
      if (result.had_conflicts) {
        toast.error("Pull resulted in conflicts.");
        set({ pushPullError: "Pull resulted in conflicts." });
        await get().focusConflicts();
      } else if (result.pulled) {
        toast.success("Pull complete");
      } else {
        toast.info("Already up to date");
      }
      await get().loadStatus();
    } catch (err) {
      const msg = String(err);
      if (
        msg.includes("authentication") ||
        msg.includes("credentials") ||
        msg.includes("401") ||
        msg.includes("403")
      ) {
        toast.error("Authentication failed. Check your SSH key or HTTPS token.");
        set({ pushPullError: "Authentication failed. Check your SSH key or HTTPS token." });
      } else if (msg.includes("conflict")) {
        toast.error("Pull resulted in conflicts.");
        set({ pushPullError: "Pull resulted in conflicts." });
        await get().focusConflicts();
      } else {
        toast.error(msg);
        set({ pushPullError: msg });
      }
    } finally {
      set({ actionBusy: null, actionStatus: null, actionProgress: null });
    }
  },

  loadRemoteBranches: async (remoteName?: string) => {
    const { repoPath } = get();
    if (!repoPath) return;

    try {
      const result = await invoke<{ branches: GitRemoteBranch[] }>("git_remote_branches", {
        repoPath,
        remoteName,
      });
      set({ remoteBranches: result.branches });
    } catch {
      set({ remoteBranches: [] });
    }
  },

  fetch: async (remoteName?: string, branchName?: string) => {
    const { repoPath } = get();
    if (!repoPath) return;

    set({
      actionBusy: "fetch",
      actionStatus: "Fetching…",
      actionProgress: null,
      pushPullError: null,
    });
    try {
      await invoke("git_fetch", { repoPath, remoteName, branchName });
      toast.success("Fetch complete");
      await get().loadStatus();
    } catch (err) {
      const msg = String(err);
      if (
        msg.includes("authentication") ||
        msg.includes("credentials") ||
        msg.includes("SSH") ||
        msg.includes("401") ||
        msg.includes("403")
      ) {
        toast.error(msg);
        set({ pushPullError: msg });
      } else {
        toast.error(msg);
        set({ error: msg });
      }
    } finally {
      set({ actionBusy: null, actionStatus: null, actionProgress: null });
    }
  },

  clearPushPullError: () => set({ pushPullError: null }),
});
