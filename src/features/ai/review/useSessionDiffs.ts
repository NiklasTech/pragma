import { useEffect, useMemo, useRef, useState } from "react";

import type { ReviewRow } from "./rows";
import { loadWrittenDiff, type ReviewDiffData } from "./useReviewDiff";

/// The diff of every changed file, loaded again when a file's status changes or after an action.
export function useSessionDiffs(
  rows: readonly ReviewRow[],
  cwd: string | null,
  revision: number,
): Map<string, ReviewDiffData> {
  const gitRows = useMemo(() => rows.filter((row) => row.gitEntry), [rows]);
  const signature = gitRows
    .map((row) => `${row.path}:${row.gitEntry?.status_code}:${row.gitEntry?.is_staged}`)
    .join("|");
  const [diffs, setDiffs] = useState<Map<string, ReviewDiffData>>(new Map());
  // Polling rebuilds the rows without changes; the signature says when to load again.
  const rowsRef = useRef(gitRows);
  useEffect(() => {
    rowsRef.current = gitRows;
  }, [gitRows]);

  useEffect(() => {
    if (!cwd) return;
    let live = true;
    void Promise.all(
      rowsRef.current.map(async (row) => {
        try {
          return [row.path, await loadWrittenDiff(cwd, row)] as const;
        } catch {
          return null;
        }
      }),
    ).then((entries) => {
      if (!live) return;
      const next = new Map<string, ReviewDiffData>();
      for (const entry of entries) if (entry) next.set(entry[0], entry[1]);
      setDiffs(next);
    });
    return () => {
      live = false;
    };
  }, [cwd, signature, revision]);

  return diffs;
}
