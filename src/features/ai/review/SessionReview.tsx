import { invoke } from "@tauri-apps/api/core";
import { useCallback } from "react";
import { toast } from "sonner";

import { AgentApprovals } from "@/features/agent/components/AgentApprovals";
import { AgentReviewPane } from "@/features/agent/components/AgentReviewPane";
import { useAgentStore } from "@/features/agent/store";

import { ReviewDiff } from "./ReviewDiff";
import { ReviewFileList } from "./ReviewFileList";
import type { ReviewDiffMode } from "./ReviewDiff";
import type { ReviewRow } from "./rows";
import { useReviewDiff } from "./useReviewDiff";

export function SessionReview({
  cwd,
  ownsRun,
  worktreeBranch,
  rows,
  error,
  selectedRowId,
  onSelectRow,
}: {
  cwd: string;
  ownsRun: boolean;
  worktreeBranch: string | null;
  rows: ReviewRow[];
  error: string | null;
  selectedRowId: string | null;
  onSelectRow: (row: ReviewRow) => void;
}) {
  const selectedRow = rows.find((row) => row.id === selectedRowId) ?? null;
  const diffState = useReviewDiff(selectedRow, cwd);
  const resolveEditReview = useAgentStore((state) => state.resolveEditReview);

  const accept = useCallback(
    (row: ReviewRow) => {
      if (row.editReview) resolveEditReview(row.editReview.toolCallId, true);
    },
    [resolveEditReview],
  );

  const reject = useCallback(
    (row: ReviewRow) => {
      if (row.editReview) resolveEditReview(row.editReview.toolCallId, false);
    },
    [resolveEditReview],
  );

  const restore = useCallback(
    async (row: ReviewRow) => {
      try {
        await invoke("git_discard", { repoPath: cwd, paths: [row.path] });
      } catch (err) {
        toast.error(String(err));
      }
    },
    [cwd],
  );

  const mode: ReviewDiffMode | null = selectedRow
    ? selectedRow.editReview
      ? "pending"
      : worktreeBranch
        ? "worktree"
        : "checkout"
    : null;

  return (
    <div className="flex flex-col">
      {ownsRun && <AgentReviewPane />}
      {ownsRun && (
        <div className="px-2">
          <AgentApprovals />
        </div>
      )}

      <div className="border-t border-border-subtle pt-1">
        <div className="px-3 pt-2 pb-1 text-ui-2xs font-semibold tracking-wider text-fg-subtle uppercase">
          Changes
        </div>
        {error ? (
          <p className="px-3 py-4 text-center text-ui-xs text-status-error">{error}</p>
        ) : (
          <ReviewFileList
            rows={rows}
            selectedRowId={selectedRowId}
            onActivate={onSelectRow}
            emptyText="No changes in this session's folder."
          />
        )}
      </div>

      {selectedRow && mode && diffState.status === "loading" && (
        <p className="px-3 py-3 text-center text-ui-xs text-fg-subtle">Loading diff…</p>
      )}
      {selectedRow && mode && diffState.status === "error" && (
        <p className="px-3 py-3 text-center text-ui-xs text-status-error">{diffState.message}</p>
      )}
      {selectedRow && mode && diffState.status === "loaded" && (
        <div className="mt-2 h-80 overflow-hidden border-t border-border-subtle">
          <ReviewDiff
            path={selectedRow.path}
            data={diffState.data}
            mode={mode}
            branch={worktreeBranch ?? undefined}
            onAccept={mode === "pending" ? () => accept(selectedRow) : undefined}
            onReject={
              mode === "worktree"
                ? undefined
                : mode === "pending"
                  ? () => reject(selectedRow)
                  : () => void restore(selectedRow)
            }
          />
        </div>
      )}
    </div>
  );
}
