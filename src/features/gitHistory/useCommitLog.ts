import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import { useGitStore } from "@/shared/stores/git";
import { PAGE_SIZE } from "@/features/sidebar/components/git-graph/constants";
import { normalizeError } from "@/features/sidebar/components/git-graph/format";
import { refreshLimit } from "@/features/sidebar/components/git-graph/graphRefresh";
import type { GitLogEntry } from "@/features/sidebar/components/git-graph/types";

const HISTORY_PAGE = Math.max(PAGE_SIZE, 100);

export interface CommitLog {
  commits: GitLogEntry[];
  loading: boolean;
  error: string | null;
  endReached: boolean;
  loadMore: () => void;
}

/// The repository's history from HEAD, a page at a time, reloaded when git's state changes.
export function useCommitLog(repoPath: string | null, active: boolean): CommitLog {
  const snapshot = useGitStore((state) => state.snapshot);
  const [commits, setCommits] = useState<GitLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [endReached, setEndReached] = useState(false);
  const requestRef = useRef(0);
  const countRef = useRef(0);
  const busyRef = useRef(false);

  const load = useCallback(
    async (limit: number) => {
      if (!repoPath) return;
      const request = ++requestRef.current;
      setLoading(true);
      try {
        const result = await invoke<{ entries: GitLogEntry[] }>("git_log_entries", {
          repoPath,
          limit,
        });
        if (request !== requestRef.current) return;
        setCommits(result.entries);
        countRef.current = result.entries.length;
        setEndReached(result.entries.length < limit);
        setError(null);
      } catch (err) {
        if (request === requestRef.current) setError(normalizeError(err));
      } finally {
        if (request === requestRef.current) setLoading(false);
      }
    },
    [repoPath],
  );

  useEffect(() => {
    if (!active) return;
    void load(refreshLimit(Math.max(countRef.current, HISTORY_PAGE)));
  }, [active, load, snapshot]);

  const loadMore = useCallback(() => {
    if (!repoPath || busyRef.current || endReached) return;
    const last = commits[commits.length - 1];
    if (!last) return;
    busyRef.current = true;
    const request = requestRef.current;
    void invoke<{ entries: GitLogEntry[] }>("git_log_entries", {
      repoPath,
      limit: HISTORY_PAGE,
      beforeSha: last.sha,
    })
      .then((result) => {
        if (request !== requestRef.current) return;
        setCommits((prev) => {
          const seen = new Set(prev.map((commit) => commit.sha));
          const next = [...prev, ...result.entries.filter((commit) => !seen.has(commit.sha))];
          countRef.current = next.length;
          return next;
        });
        if (result.entries.length < HISTORY_PAGE) setEndReached(true);
      })
      .catch((err) => setError(normalizeError(err)))
      .finally(() => {
        busyRef.current = false;
      });
  }, [commits, endReached, repoPath]);

  return { commits, loading, error, endReached, loadMore };
}
