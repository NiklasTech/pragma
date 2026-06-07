import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

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
  isLoading: boolean;
  error: string | null;
  commitMessage: string;
  actionBusy: string | null;
}

interface GitActions {
  setRepoPath: (path: string | null) => void;
  loadStatus: () => Promise<void>;
  loadBranches: () => Promise<void>;
  loadLog: (limit?: number) => Promise<void>;
  loadGraph: (offset?: number, limit?: number) => Promise<void>;
  stageFiles: (paths: string[]) => Promise<void>;
  unstageFiles: (paths: string[]) => Promise<void>;
  commit: () => Promise<void>;
  loadFileDiff: (path: string, staged: boolean) => Promise<void>;
  clearDiff: () => void;
  setCommitMessage: (value: string) => void;
  refreshAll: () => Promise<void>;
  clearError: () => void;
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
  isLoading: false,
  error: null,
  commitMessage: "",
  actionBusy: null,
};

export const useGitStore = create<GitState & GitActions>((set, get) => ({
  ...initialState,

  setRepoPath: (path) =>
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
    }),

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

  loadFileDiff: async (path: string, staged: boolean) => {
    const { repoPath } = get();
    if (!repoPath) return;

    set({ isLoading: true, error: null });
    try {
      const content = await invoke<string>("git_diff_file", { repoPath, path, staged });
      set({ diffContent: content, diffPath: path, diffStaged: staged, isLoading: false });
    } catch (err) {
      set({ diffContent: null, diffPath: null, isLoading: false, error: String(err) });
    }
  },

  clearDiff: () => set({ diffContent: null, diffPath: null }),
  setCommitMessage: (value) => set({ commitMessage: value }),

  refreshAll: async () => {
    const { loadStatus, loadBranches, loadLog, loadGraph } = get();
    await Promise.all([loadStatus(), loadBranches(), loadLog(), loadGraph()]);
  },

  clearError: () => set({ error: null }),
}));
