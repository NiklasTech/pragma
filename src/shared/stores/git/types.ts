import type { StateCreator } from "zustand";
import type { DiffViewMode } from "@/features/editor/components/InlineDiff";

export interface GitStatusEntry {
  path: string;
  status: string;
  status_code: string;
  is_staged: boolean;
  is_unstaged: boolean;
  is_conflicted: boolean;
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

export interface GitCommitFileChange {
  path: string;
  original_path: string | null;
  status: string;
  status_label: string;
  added: number;
  removed: number;
  is_binary: boolean;
}

export interface GitCommitDetails {
  sha: string;
  short_sha: string;
  subject: string;
  body: string;
  author: string;
  author_email: string;
  timestamp_secs: number;
  parents: string[];
  files: GitCommitFileChange[];
}

export interface GitDiffContentResult {
  original_content: string;
  modified_content: string;
  is_binary: boolean;
  fallback_patch: string;
  truncated: boolean;
}

export interface StashEntry {
  index: number;
  message: string;
  ref_name: string;
  timestamp_secs: number;
}

export interface GitConflictSides {
  base_content: string;
  current_content: string;
  incoming_content: string;
  worktree_content: string;
  is_binary: boolean;
  truncated: boolean;
}

export interface GitBlameLine {
  line: number;
  sha: string;
  short_sha: string;
  author: string;
  author_email: string;
  timestamp_secs: number;
  content: string;
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

export interface GitState {
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
  stashes: StashEntry[];
  stashBusy: boolean;
  conflictPath: string | null;
  conflictSides: GitConflictSides | null;
  conflictLoading: boolean;
  blameEnabled: boolean;
  blamePath: string | null;
  blameLines: GitBlameLine[];
  blameLoading: boolean;
  blameSelectedSha: string | null;
}

export interface GitActions {
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
  loadCommitDetails: (sha: string) => Promise<GitCommitDetails | null>;
  loadCommitFileDiff: (
    sha: string,
    path: string,
    originalPath?: string | null,
  ) => Promise<GitDiffContentResult | null>;
  checkoutCommit: (sha: string) => Promise<void>;
  createBranchFromCommit: (branchName: string, sha: string, checkout?: boolean) => Promise<void>;
  cherryPickCommit: (sha: string) => Promise<void>;
  revertCommit: (sha: string) => Promise<void>;
  resetToCommit: (sha: string, mode: "soft" | "mixed" | "hard") => Promise<void>;
  loadStashes: () => Promise<void>;
  stashPush: (message?: string) => Promise<void>;
  stashPop: (stashRef: string) => Promise<void>;
  stashApply: (stashRef: string) => Promise<void>;
  stashDrop: (stashRef: string) => Promise<void>;
  openConflict: (path: string) => Promise<void>;
  closeConflict: () => void;
  resolveConflict: (path: string, content: string) => Promise<void>;
  markConflictResolved: (path: string) => Promise<void>;
  loadBlame: (path: string) => Promise<void>;
  setBlameEnabled: (enabled: boolean) => void;
  toggleBlame: () => void;
  setBlameSelectedSha: (sha: string | null) => void;
  focusConflicts: () => Promise<string[]>;
}

export type GitStore = GitState & GitActions;

export type GitSlice<T> = StateCreator<GitStore, [], [], T>;
