import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

import type { GitStatusEntry, GitStatusSnapshot } from "@/shared/stores/git";

const REFRESH_MS = 4000;

/// Git changes in a session's folder; works for any agent because it reads the worktree itself.
export function useSessionChanges(cwd: string | null): {
  entries: GitStatusEntry[];
  error: string | null;
} {
  const [entries, setEntries] = useState<GitStatusEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cwd) {
      setEntries([]);
      setError(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const { snapshot } = await invoke<{ snapshot: GitStatusSnapshot }>("git_status", {
          repoPath: cwd,
        });
        if (cancelled) return;
        setEntries(snapshot.changed_files);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(String(err));
      }
    };
    void load();
    const id = window.setInterval(() => void load(), REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [cwd]);

  return { entries, error };
}
