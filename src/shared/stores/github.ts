import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";

export interface GhCliStatus {
  installed: boolean;
  authenticated: boolean;
}

export interface GhChecksSummary {
  total: number;
  passing: number;
  failing: number;
  pending: number;
}

export type GhPullRequestState = "OPEN" | "CLOSED" | "MERGED";

export interface GhPullRequest {
  number: number;
  title: string;
  url: string;
  state: GhPullRequestState;
  is_draft: boolean;
  base_ref: string;
  checks: GhChecksSummary;
}

export interface GhPrCreateOptions {
  template: string | null;
  labels: string[];
  default_branch: string | null;
}

export interface GhPrCreateInput {
  title: string;
  body: string;
  base: string;
  labels: string[];
  draft: boolean;
}

export interface GhReviewComment {
  author: string;
  body: string;
  path: string | null;
  line: number | null;
  state: string | null;
}

interface GithubState {
  repoPath: string | null;
  cli: GhCliStatus | null;
  branch: string | null;
  pullRequest: GhPullRequest | null;
  prLoading: boolean;
  prError: string | null;
  loadCli: (repoPath: string) => Promise<void>;
  loadPullRequest: (repoPath: string, branch: string) => Promise<void>;
}

export const useGithubStore = create<GithubState>()((set, get) => ({
  repoPath: null,
  cli: null,
  branch: null,
  pullRequest: null,
  prLoading: false,
  prError: null,

  loadCli: async (repoPath) => {
    set({ repoPath, cli: null, branch: null, pullRequest: null, prError: null });
    try {
      const cli = await invoke<GhCliStatus>("gh_cli_status", { repoPath });
      if (get().repoPath === repoPath) set({ cli });
    } catch {
      if (get().repoPath === repoPath) set({ cli: { installed: false, authenticated: false } });
    }
  },

  loadPullRequest: async (repoPath, branch) => {
    if (get().branch !== branch) set({ pullRequest: null });
    set({ branch, prLoading: true, prError: null });
    const current = () => get().repoPath === repoPath && get().branch === branch;
    try {
      const pullRequest = await invoke<GhPullRequest | null>("gh_pr_current", { repoPath });
      if (current()) set({ pullRequest, prLoading: false });
    } catch (err) {
      if (current()) set({ prLoading: false, prError: String(err) });
    }
  },
}));

export function loadPrCreateOptions(repoPath: string): Promise<GhPrCreateOptions> {
  return invoke<GhPrCreateOptions>("gh_pr_create_options", { repoPath });
}

export function createPullRequest(repoPath: string, input: GhPrCreateInput): Promise<string> {
  return invoke<string>("gh_pr_create", { repoPath, input });
}

export function loadReviewComments(repoPath: string, number: number): Promise<GhReviewComment[]> {
  return invoke<GhReviewComment[]>("gh_pr_review_comments", { repoPath, number });
}
