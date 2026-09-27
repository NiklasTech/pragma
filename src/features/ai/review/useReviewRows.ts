import { useMemo } from "react";

import { useAgentStore } from "@/features/agent/store";
import { useSessionChanges } from "@/features/ai/components/SessionChanges";

import { buildReviewRows, type ReviewRow } from "./rows";

export function useReviewRows(input: {
  sessionId: string | null;
  cwd: string | null;
  ownsRun: boolean;
}): { rows: ReviewRow[]; error: string | null } {
  const { sessionId, cwd, ownsRun } = input;
  const { entries, error } = useSessionChanges(cwd);
  const editReviews = useAgentStore((state) => state.editReviews);

  const rows = useMemo(() => {
    if (!sessionId || !cwd) return [];
    return buildReviewRows({
      sessionId,
      cwd,
      entries,
      editReviews: ownsRun ? editReviews : [],
    });
  }, [sessionId, cwd, ownsRun, entries, editReviews]);

  return { rows, error };
}
