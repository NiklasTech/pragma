import { invoke } from "@tauri-apps/api/core";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { AgentApprovals } from "@/features/agent/components/AgentApprovals";
import { AgentReviewPane } from "@/features/agent/components/AgentReviewPane";
import { useAgentStore } from "@/features/agent/store";
import type { GitLineSelection } from "@/shared/stores/git";

import { commitPaths } from "./commit";
import { ReviewDiff } from "./ReviewDiff";
import { ReviewComments } from "./ReviewComments";
import { ReviewCommit } from "./ReviewCommit";
import { ReviewFileList } from "./ReviewFileList";
import type { ReviewDiffMode } from "./ReviewDiff";
import type { ReviewHunkAction } from "./ReviewHunkDiff";
import type { ReviewRow } from "./rows";
import { useReviewDiff } from "./useReviewDiff";

export function SessionReview({
  sessionId,
  cwd,
  ownsRun,
  worktreeBranch,
  rows,
  error,
  selectedRowId,
  onSelectRow,
}: {
  sessionId: string;
  cwd: string;
  ownsRun: boolean;
  worktreeBranch: string | null;
  rows: ReviewRow[];
  error: string | null;
  selectedRowId: string | null;
  onSelectRow: (row: ReviewRow) => void;
}) {
  const selectedRow = rows.find((row) => row.id === selectedRowId) ?? null;
  const [revision, setRevision] = useState(0);
  const [hunkBusy, setHunkBusy] = useState(false);
  const diffState = useReviewDiff(selectedRow, cwd, revision);
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

  const applyHunk = useCallback(
    async (row: ReviewRow, action: ReviewHunkAction, selection: GitLineSelection) => {
      setHunkBusy(true);
      try {
        await invoke("git_apply_lines", { repoPath: cwd, path: row.path, action, selection });
        setRevision((value) => value + 1);
      } catch (err) {
        toast.error(String(err));
      } finally {
        setHunkBusy(false);
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
  const entry = selectedRow?.gitEntry;
  const kept = !!entry && entry.is_staged && !entry.is_unstaged;
  const canApplyHunks = !!entry && entry.status_code !== "?" && !entry.is_conflicted && !kept;
  const paths = commitPaths(rows);

  return (
    <div className="flex flex-col">
      {ownsRun && <AgentReviewPane />}
      {ownsRun && (
        <div className="px-2">
          <AgentApprovals />
        </div>
      )}

      <div className="border-t border-border-subtle pt-1">
        <div className="flex flex-wrap items-center gap-2 px-3 pt-2 pb-1">
          <span className="flex-1 text-ui-2xs font-semibold tracking-wider text-fg-subtle uppercase">
            Changes
          </span>
          {paths.length > 0 && <ReviewCommit sessionId={sessionId} cwd={cwd} paths={paths} />}
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
            sessionId={sessionId}
            path={selectedRow.path}
            data={diffState.data}
            mode={mode}
            branch={worktreeBranch ?? undefined}
            kept={kept}
            hunkActions={
              canApplyHunks
                ? {
                    busy: hunkBusy,
                    onApply: (action, selection) => void applyHunk(selectedRow, action, selection),
                  }
                : undefined
            }
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

      <ReviewComments sessionId={sessionId} />
    </div>
  );
}
