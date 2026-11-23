import { invoke } from "@tauri-apps/api/core";

import type { GhPullRequest } from "@/shared/stores/github";

export interface GhCheck {
  name: string;
  workflow: string;
  /** `gh`'s grouping of the state: pass, fail, pending, skipping or cancel. */
  bucket: string;
  /** The check's page; empty when GitHub gave none. */
  link: string;
}

/** The pull request of the branch checked out at `worktreePath`, or null when it has none. */
export function fetchBranchPullRequest(worktreePath: string): Promise<GhPullRequest | null> {
  return invoke<GhPullRequest | null>("gh_pr_current", { repoPath: worktreePath });
}

export function fetchPullRequestChecks(repoPath: string, number: number): Promise<GhCheck[]> {
  return invoke<GhCheck[]>("gh_pr_checks", { repoPath, number });
}
