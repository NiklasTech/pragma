import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import type { WorkEnvironment } from "@/shared/stores/ai";

export interface DiffStat {
  files: number;
  added: number;
  removed: number;
}

const REFRESH_MS = 10_000;

/// Lines a worktree changed since it branched off, refreshed while the overview is open.
export function useDiffStat(environment: WorkEnvironment | undefined): DiffStat | null {
  const [stat, setStat] = useState<DiffStat | null>(null);
  const path = environment?.kind === "worktree" ? environment.path : null;
  const base = environment?.baseBranch ?? null;

  useEffect(() => {
    if (!path) {
      setStat(null);
      return;
    }
    let live = true;
    const load = () =>
      invoke<DiffStat>("git_session_diff_stat", { path, baseBranch: base })
        .then((next) => live && setStat(next))
        .catch(() => live && setStat(null));
    void load();
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [path, base]);

  return stat;
}
