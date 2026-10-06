import { ArrowCounterClockwise, Check } from "@phosphor-icons/react";
import { Fragment, useMemo, useState } from "react";

import { Button } from "@/shared/components/ui/button";
import { lineSelection, parsePatchHunks, type PatchLine } from "@/shared/lib/diffHunks";
import { cn } from "@/shared/lib/utils";
import type { GitLineSelection } from "@/shared/stores/git";

import type { ReviewComment, ReviewCommentSide } from "./comments";
import { ReviewCommentCard, ReviewCommentEditor } from "./ReviewCommentCard";

export type ReviewHunkAction = "stage" | "discard";

export interface ReviewHunkActions {
  busy: boolean;
  onApply: (action: ReviewHunkAction, selection: GitLineSelection) => void;
}

export interface ReviewLineTarget {
  side: ReviewCommentSide;
  line: number;
  code: string;
}

const LINE_CLASSES: Record<PatchLine["type"], string> = {
  added: "bg-status-success/5 text-status-success/90",
  removed: "bg-status-error/5 text-status-error/90",
  context: "text-fg-default/80",
};

const PREFIX: Record<PatchLine["type"], string> = { added: "+", removed: "-", context: " " };

function lineTarget(line: PatchLine): ReviewLineTarget | null {
  const side: ReviewCommentSide = line.type === "removed" ? "old" : "new";
  const number = side === "old" ? line.oldLine : line.newLine;
  return number === null ? null : { side, line: number, code: line.content };
}

const targetKey = (target: { side: ReviewCommentSide; line: number }) =>
  `${target.side}:${target.line}`;

/** Unified diff whose lines take review comments and whose hunks can be kept or discarded. */
export function ReviewHunkDiff({
  patchText,
  comments,
  hunkActions,
  onAddComment,
  onUpdateComment,
  onRemoveComment,
}: {
  patchText: string;
  comments: readonly ReviewComment[];
  hunkActions?: ReviewHunkActions;
  onAddComment: (target: ReviewLineTarget, body: string) => void;
  onUpdateComment: (id: string, body: string) => void;
  onRemoveComment: (id: string) => void;
}) {
  const hunks = useMemo(() => parsePatchHunks(patchText), [patchText]);
  const [draftKey, setDraftKey] = useState<string | null>(null);

  const commentsByLine = useMemo(() => {
    const map = new Map<string, ReviewComment[]>();
    for (const comment of comments) {
      const key = targetKey(comment);
      map.set(key, [...(map.get(key) ?? []), comment]);
    }
    return map;
  }, [comments]);

  return (
    <div className="min-h-0 flex-1 overflow-auto font-mono text-ui-xs">
      {hunks.map((hunk, hunkIndex) => (
        <div key={`${hunkIndex}:${hunk.header}`}>
          <div className="flex h-7 items-center gap-1 border-y border-border-subtle bg-status-info/5 px-2">
            <span className="min-w-0 flex-1 truncate text-status-info/70">{hunk.header}</span>
            {hunkActions && (
              <>
                <Button
                  variant="ghost"
                  size="xs"
                  className="font-sans text-ui-xs hover:text-status-error"
                  disabled={hunkActions.busy}
                  title="Discard this hunk"
                  onClick={() => hunkActions.onApply("discard", lineSelection(hunk.lines))}
                >
                  <ArrowCounterClockwise size={12} />
                  Discard
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  className="font-sans text-ui-xs"
                  disabled={hunkActions.busy}
                  title="Keep this hunk and stage it"
                  onClick={() => hunkActions.onApply("stage", lineSelection(hunk.lines))}
                >
                  <Check size={12} />
                  Keep
                </Button>
              </>
            )}
          </div>
          {hunk.lines.map((line, lineIndex) => {
            const target = lineTarget(line);
            const key = target ? targetKey(target) : null;
            const lineComments = key ? (commentsByLine.get(key) ?? []) : [];
            const drafting = key !== null && key === draftKey;
            return (
              <Fragment key={lineIndex}>
                <button
                  type="button"
                  disabled={!target}
                  title="Comment on this line"
                  onClick={() => setDraftKey(drafting ? null : key)}
                  className={cn(
                    "flex w-full cursor-pointer items-start text-left hover:bg-bg-hover",
                    LINE_CLASSES[line.type],
                    drafting && "bg-primary/15",
                  )}
                >
                  <span className="w-8 shrink-0 pr-1 text-right leading-5 text-fg-muted/50 select-none">
                    {line.oldLine ?? ""}
                  </span>
                  <span className="w-8 shrink-0 pr-1 text-right leading-5 text-fg-muted/50 select-none">
                    {line.newLine ?? ""}
                  </span>
                  <span className="w-4 shrink-0 text-center leading-5 select-none">
                    {PREFIX[line.type]}
                  </span>
                  <span className="min-w-0 flex-1 truncate px-1 leading-5 whitespace-pre">
                    {line.content}
                  </span>
                </button>
                {(lineComments.length > 0 || drafting) && (
                  <div className="flex flex-col gap-1.5 border-y border-border-subtle bg-bg-surface px-2 py-1.5">
                    {lineComments.map((comment) => (
                      <ReviewCommentCard
                        key={comment.id}
                        comment={comment}
                        onUpdate={(body) => onUpdateComment(comment.id, body)}
                        onRemove={() => onRemoveComment(comment.id)}
                      />
                    ))}
                    {drafting && target && (
                      <ReviewCommentEditor
                        submitLabel="Comment"
                        onSubmit={(body) => {
                          onAddComment(target, body);
                          setDraftKey(null);
                        }}
                        onCancel={() => setDraftKey(null)}
                      />
                    )}
                  </div>
                )}
              </Fragment>
            );
          })}
        </div>
      ))}
    </div>
  );
}
