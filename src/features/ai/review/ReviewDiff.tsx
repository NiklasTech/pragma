import { Check, X } from "@phosphor-icons/react";
import { useMemo, useState } from "react";

import { InlineDiff } from "@/features/editor/components/InlineDiff";
import { Button } from "@/shared/components/ui/button";

import { useReviewCommentsStore } from "./comments";
import { addedFilePatch } from "./patch";
import { RestoreFileDialog } from "./RestoreFileDialog";
import { ReviewHunkDiff, type ReviewHunkActions } from "./ReviewHunkDiff";
import type { ReviewDiffData } from "./useReviewDiff";

export type ReviewDiffMode = "pending" | "worktree" | "checkout";

interface ReviewDiffProps {
  sessionId: string;
  path: string;
  data: ReviewDiffData;
  mode: ReviewDiffMode;
  branch?: string;
  kept?: boolean;
  hunkActions?: ReviewHunkActions;
  onAccept?: () => void;
  onReject?: () => void;
}

export function ReviewDiff({
  sessionId,
  path,
  data,
  mode,
  branch,
  kept = false,
  hunkActions,
  onAccept,
  onReject,
}: ReviewDiffProps) {
  const [confirming, setConfirming] = useState(false);
  const title = mode === "worktree" ? `Written in ${branch ?? ""}` : path;
  const patchText =
    mode === "pending" ? "" : data.patchText || addedFilePatch(data.original, data.modified);

  const allComments = useReviewCommentsStore((state) => state.comments);
  const addComment = useReviewCommentsStore((state) => state.addComment);
  const updateComment = useReviewCommentsStore((state) => state.updateComment);
  const removeComment = useReviewCommentsStore((state) => state.removeComment);
  const comments = useMemo(
    () => allComments.filter((comment) => comment.sessionId === sessionId && comment.path === path),
    [allComments, sessionId, path],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border-subtle px-3 py-1.5">
        <span className="min-w-0 flex-1 truncate font-mono text-ui-xs text-fg-muted" title={title}>
          {title}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          {kept && <span className="text-ui-2xs text-git-added">Kept</span>}
          {mode === "pending" && onAccept && (
            <Button
              size="sm"
              className="h-6 gap-1 px-2 text-ui-xs"
              onClick={onAccept}
              title="Accept edit"
            >
              <Check size={12} weight="bold" />
              Accept
            </Button>
          )}
          {mode !== "worktree" && onReject && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-ui-xs text-status-error hover:bg-status-error/10 hover:text-status-error"
              onClick={() => (mode === "checkout" ? setConfirming(true) : onReject())}
              title={mode === "checkout" ? "Restore from HEAD" : "Reject edit"}
            >
              <X size={12} weight="bold" />
              Reject
            </Button>
          )}
        </div>
      </div>
      {patchText ? (
        <ReviewHunkDiff
          patchText={patchText}
          comments={comments}
          hunkActions={hunkActions}
          onAddComment={(target, body) => addComment({ sessionId, path, ...target, body })}
          onUpdateComment={updateComment}
          onRemoveComment={removeComment}
        />
      ) : (
        <InlineDiff
          original={data.original}
          modified={data.modified}
          patchText={data.patchText}
          filePath={path}
          className="h-auto min-h-0 flex-1"
        />
      )}
      {mode === "checkout" && (
        <RestoreFileDialog
          open={confirming}
          path={path}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            onReject?.();
          }}
        />
      )}
    </div>
  );
}
