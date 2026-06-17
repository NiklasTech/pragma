import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import type { DiffViewMode } from "@/features/editor/components/InlineDiff";
import { saveWorkspace, loadWorkspace } from "./workspace";
import { useSettingsStore } from "./settings";

export interface GitStatusEntry {
  path: string;
  status: string;
  status_code: string;
  is_staged: boolean;
  is_unstaged: boolean;
  original_path: string | null;
}

export interface GitRepoInfo {
  repo_root: string;
  branch: string;
  upstream: string | null;
  is_detached: boolean;
}

export interface GitStatusSnapshot {
  repo: GitRepoInfo;
  changed_files: GitStatusEntry[];
  ahead: number;
  behind: number;
}

export interface GitBranch {
  name: string;
  is_head: boolean;
}

export interface GitCommit {
  id: string;
  message: string;
  author: string;
  time: number;
}

export interface GitGraphNode {
  id: string;
  message: string;
  author: string;
  time: number;
  is_head: boolean;
}

export interface GitGraphEdge {
  from: string;
  to: string;
}

export interface GitGraphBranch {
  name: string;
  color: string;
  tip_id: string;
}

export interface GitGraphData {
  nodes: GitGraphNode[];
  edges: GitGraphEdge[];
  branches: GitGraphBranch[];
  head_id: string;
  total_count: number;
  has_more: boolean;
}

export interface GitRemote {
  name: string;
  url: string;
}

export interface GitRemoteBranch {
  name: string;
  remote: string;
}

export interface GitProgress {
  operation: string;
  stage: string;
  received_objects: number;
  total_objects: number;
  indexed_objects: number;
  received_bytes: number;
}

export type CheckState = "checked" | "indeterminate" | "unchecked";

interface GitState {
  repoPath: string | null;
  snapshot: GitStatusSnapshot | null;
  branches: GitBranch[];
  commits: GitCommit[];
  graph: GitGraphData | null;
  diffContent: string | null;
  diffPath: string | null;
  diffStaged: boolean;
  diffViewMode: DiffViewMode;
  isLoading: boolean;
  error: string | null;
  commitMessage: string;
  actionBusy: string | null;
  actionStatus: string | null;
  actionProgress: GitProgress | null;
  remotes: GitRemote[];
  remoteBranches: GitRemoteBranch[];
  pushPullError: string | null;
}

interface GitActions {
  setRepoPath: (path: string | null) => void;
  loadStatus: () => Promise<void>;
  loadBranches: () => Promise<void>;
  loadLog: (limit?: number) => Promise<void>;
  loadGraph: (offset?: number, limit?: number) => Promise<void>;
  stageFiles: (paths: string[]) => Promise<void>;
  unstageFiles: (paths: string[]) => Promise<void>;
  discardFiles: (paths: string[]) => Promise<void>;
  commit: () => Promise<void>;
  loadFileDiff: (path: string, staged: boolean) => Promise<string>;
  clearDiff: () => void;
  setCommitMessage: (value: string) => void;
  setDiffViewMode: (mode: DiffViewMode) => void;
  checkoutBranch: (branchName: string) => Promise<void>;
  smartCheckout: (branchName: string) => Promise<void>;
  createBranch: (branchName: string, checkout?: boolean) => Promise<void>;
  deleteBranch: (branchName: string) => Promise<void>;
  hasUncommittedChanges: () => Promise<boolean>;
  refreshAll: () => Promise<void>;
  clearError: () => void;
  loadRemotes: () => Promise<void>;
  loadRemoteBranches: (remoteName?: string) => Promise<void>;
  push: (remoteName?: string, branchName?: string) => Promise<void>;
  pull: (remoteName?: string, branchName?: string, rebase?: boolean) => Promise<void>;
  fetch: (remoteName?: string, branchName?: string) => Promise<void>;
  clearPushPullError: () => void;
}

const initialState: GitState = {
  repoPath: null,
  snapshot: null,
  branches: [],
  commits: [],
  graph: null,
  diffContent: null,
  diffPath: null,
  diffStaged: false,
  diffViewMode: "split",
  isLoading: false,
  error: null,
  commitMessage: "",
  actionBusy: null,
  actionStatus: null,
  actionProgress: null,
  remotes: [],
  remoteBranches: [],
  pushPullError: null,
};

export const useGitStore = create<GitState & GitActions>((set, get) => ({
  ...initialState,

  setRepoPath: (path) => {
    set({
      repoPath: path,
      snapshot: null,
      branches: [],
      commits: [],
      graph: null,
      diffContent: null,
      diffPath: null,
      commitMessage: "",
      error: null,
    });
    if (path) {
      void get().refreshAll();
    }
  },

  loadStatus: async () => {
    const { repoPath } = get();
    if (!repoPath) return;

    set({ isLoading: true, error: null });
    try {
      const result = await invoke<{ snapshot: GitStatusSnapshot }>("git_status", { repoPath });
      set({ snapshot: result.snapshot, isLoading: false });
    } catch (err) {
      set({ snapshot: null, isLoading: false, error: String(err) });
    }
  },

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

  loadGraph: async (offset?: number, limit?: number) => {
    const { repoPath } = get();
    if (!repoPath) return;

    set({ isLoading: true, error: null });
    try {
      const result = await invoke<{ data: GitGraphData }>("git_graph", { repoPath, offset, limit });
      set({ graph: result.data, isLoading: false });
    } catch (err) {
      set({ graph: null, isLoading: false, error: String(err) });
    }
  },

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

    const gitSettings = useSettingsStore.getState().git;
    const signOffText = gitSettings.signOff
      ? gitSettings.signOffText
          .replace(/{name}/g, gitSettings.userName || "")
          .replace(/{email}/g, gitSettings.userEmail || "")
          .trim()
      : undefined;

    set({ actionBusy: "commit" });
    try {
      await invoke<{ commit_sha: string }>("git_commit", {
        repoPath,
        message: commitMessage.trim(),
        sign_off_text: signOffText && signOffText.length > 0 ? signOffText : undefined,
      });
      set({ commitMessage: "" });
      await loadStatus();
    } catch (err) {
      set({ error: String(err) });
    } finally {
      set({ actionBusy: null });
    }
  },

  loadFileDiff: async (path: string, staged: boolean) => {
    const { repoPath } = get();
    if (!repoPath) return "";

    set({ isLoading: true, error: null });
    try {
      const content = await invoke<string>("git_diff_file", { repoPath, path, staged });
      set({ diffContent: content, diffPath: path, diffStaged: staged, isLoading: false });
      return content;
    } catch (err) {
      set({ diffContent: null, diffPath: null, isLoading: false, error: String(err) });
      return "";
    }
  },

  clearDiff: () => set({ diffContent: null, diffPath: null }),
  setCommitMessage: (value) => set({ commitMessage: value }),
  setDiffViewMode: (mode) => set({ diffViewMode: mode }),

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

  hasUncommittedChanges: async () => {
    const { repoPath } = get();
    if (!repoPath) return false;

    try {
      return await invoke<boolean>("git_has_uncommitted_changes", { repoPath });
    } catch {
      return false;
    }
  },

  refreshAll: async () => {
    const { loadStatus, loadBranches, loadLog, loadRemotes } = get();
    await Promise.all([loadStatus(), loadBranches(), loadLog(), loadRemotes()]);
  },

  clearError: () => set({ error: null }),

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
        toast.error("Pull resulted in conflicts. Resolve them manually.");
        set({ pushPullError: "Pull resulted in conflicts. Resolve them manually." });
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
        toast.error("Pull resulted in conflicts. Resolve them manually.");
        set({ pushPullError: "Pull resulted in conflicts. Resolve them manually." });
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
}));
