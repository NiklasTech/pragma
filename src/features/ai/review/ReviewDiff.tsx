import { Check, X } from "@phosphor-icons/react";
import { useState } from "react";

import { InlineDiff } from "@/features/editor/components/InlineDiff";
import { Button } from "@/shared/components/ui/button";

import { RestoreFileDialog } from "./RestoreFileDialog";
import type { ReviewDiffData } from "./useReviewDiff";

export type ReviewDiffMode = "pending" | "worktree" | "checkout";

interface ReviewDiffProps {
  path: string;
  data: ReviewDiffData;
  mode: ReviewDiffMode;
  branch?: string;
  onAccept?: () => void;
  onReject?: () => void;
}

export function ReviewDiff({ path, data, mode, branch, onAccept, onReject }: ReviewDiffProps) {
  const [confirming, setConfirming] = useState(false);
  const title = mode === "worktree" ? `Written in ${branch ?? ""}` : path;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border-subtle px-3 py-1.5">
        <span className="min-w-0 flex-1 truncate font-mono text-ui-xs text-fg-muted" title={title}>
          {title}
        </span>
        <div className="flex shrink-0 items-center gap-1">
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
      <InlineDiff
        original={data.original}
        modified={data.modified}
        patchText={data.patchText}
        filePath={path}
        className="h-auto min-h-0 flex-1"
      />
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
