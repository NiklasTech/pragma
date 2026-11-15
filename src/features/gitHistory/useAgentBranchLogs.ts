import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import type { GitLogEntry } from "@/features/sidebar/components/git-graph/types";
import { useRepositoryWorktrees } from "@/features/sidebar/worktrees/useRepositoryWorktrees";
import type { RepositoryWorktree } from "@/features/sidebar/worktrees/worktreeView";

const REFRESH_MS = 10_000;
const BRANCH_LIMIT = 50;

export interface AgentBranchLog {
  worktree: RepositoryWorktree;
  /** The branch the worktree was made from, which its commits are not merged into yet. */
  base: string;
  commits: GitLogEntry[];
}

/// The commits each agent worktree's branch has that its base does not, refreshed while shown.
export function useAgentBranchLogs(
  repoPath: string | null,
  currentBranch: string | null,
  active: boolean,
): AgentBranchLog[] {
  const { worktrees } = useRepositoryWorktrees(repoPath);
  const targets = useMemo(
    () =>
      worktrees.flatMap((worktree) => {
        const base = worktree.environment.baseBranch || currentBranch;
        return base && worktree.environment.branch ? [{ worktree, base }] : [];
      }),
    [worktrees, currentBranch],
  );
  const key = targets.map((t) => `${t.worktree.environment.branch}:${t.base}`).join("|");
  const [logs, setLogs] = useState<Record<string, GitLogEntry[]>>({});
  // The worktree objects change on every session update; `key` says when the targets did.
  const targetsRef = useRef(targets);
  useEffect(() => {
    targetsRef.current = targets;
  }, [targets]);

  useEffect(() => {
    if (!active || !repoPath || !key) return;
    let live = true;
    const load = () =>
      void Promise.all(
        targetsRef.current.map(async ({ worktree, base }) => {
          try {
            const result = await invoke<{ entries: GitLogEntry[] }>("git_branch_log", {
              repoPath,
              branch: worktree.environment.branch,
              base,
              limit: BRANCH_LIMIT,
            });
            return [worktree.environment.branch, result.entries] as const;
          } catch {
            return [worktree.environment.branch, []] as const;
          }
        }),
      ).then((entries) => {
        if (live) setLogs(Object.fromEntries(entries));
      });
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [active, repoPath, key]);

  return targets
    .map(({ worktree, base }) => ({
      worktree,
      base,
      commits: logs[worktree.environment.branch] ?? [],
    }))
    .filter((log) => log.commits.length > 0);
}
