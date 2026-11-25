import { ArrowCounterClockwise, ArrowUUpLeft, ChatCircle, Check } from "@phosphor-icons/react";
import { useMemo, useState } from "react";

import { Button } from "@/shared/components/ui/button";
import { DiffGutter } from "@/shared/components/DiffGutter";
import { hunkPlace, hunkSection, lineNumberDigits, type PatchLine } from "@/shared/lib/diffHunks";
import { cn } from "@/shared/lib/utils";

import type { ReviewComment, ReviewCommentSide } from "./comments";
import { ReviewCommentCard, ReviewCommentEditor } from "./ReviewCommentCard";

const LINE_CLASS: Record<PatchLine["type"], string> = {
  added: "bg-(--color-git-added-bg)",
  removed: "bg-(--color-git-deleted-bg)",
  context: "",
};
const SIGN: Record<PatchLine["type"], string> = { added: "+", removed: "−", context: " " };
const SIGN_CLASS: Record<PatchLine["type"], string> = {
  added: "text-git-added",
  removed: "text-git-deleted",
  context: "text-fg-subtle",
};

function target(line: PatchLine): { side: ReviewCommentSide; line: number } | null {
  const side: ReviewCommentSide = line.type === "removed" ? "old" : "new";
  const number = side === "old" ? line.oldLine : line.newLine;
  return number === null ? null : { side, line: number };
}

export type HunkState = "open" | "kept" | "undone";

interface ReviewHunkCardProps {
  header: string;
  /** Shows the function git names in the hunk header; off for prose and data files, where it is noise. */
  showContext: boolean;
  lines: PatchLine[];
  state: HunkState;
  busy: boolean;
  comments: readonly ReviewComment[];
  onKeep?: () => void;
  onUndo?: () => void;
  onRestore?: () => void;
  onComment: (side: ReviewCommentSide, line: number, code: string, body: string) => void;
  onUpdateComment: (id: string, body: string) => void;
  onRemoveComment: (id: string) => void;
}

/// One part of a change: its lines, comments on them, and keep or undo.
export function ReviewHunkCard({
  header,
  showContext,
  lines,
  state,
  busy,
  comments,
  onKeep,
  onUndo,
  onRestore,
  onComment,
  onUpdateComment,
  onRemoveComment,
}: ReviewHunkCardProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const name = hunkSection(header);
  const place = hunkPlace({ lines });
  const digits = lineNumberDigits([{ lines }]);
  const lastChanged = [...lines].reverse().find((line) => line.type !== "context");
  const byLine = useMemo(() => {
    const map = new Map<string, ReviewComment[]>();
    for (const comment of comments) {
      const key = `${comment.side}:${comment.line}`;
      map.set(key, [...(map.get(key) ?? []), comment]);
    }
    return map;
  }, [comments]);

  return (
    <article
      className={cn(
        "shrink-0 overflow-hidden rounded-[11px] bg-bg-well ring-1 ring-border-subtle ring-inset",
        state === "kept" && "ring-git-added/40",
      )}
    >
      <div className="flex h-9.5 items-center gap-2.5 bg-bg-hover/60 pr-2 pl-3.5 text-ui-xs text-fg-muted">
        {showContext && name && (
          <span className="min-w-0 truncate font-mono text-fg-default">{name}</span>
        )}
        <span className="shrink-0">{place}</span>
        <span className="ml-auto flex shrink-0 items-center gap-1">
          {state === "undone" ? (
            <>
              <span className="mr-1">Undone</span>
              <Button variant="ghost" size="sm" disabled={busy} onClick={onRestore}>
                <ArrowUUpLeft size={13} aria-hidden="true" />
                Restore
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" disabled={busy} onClick={onUndo}>
                <ArrowCounterClockwise size={13} aria-hidden="true" />
                Undo
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={!lastChanged}
                onClick={() => {
                  const at = lastChanged && target(lastChanged);
                  setDraft(at ? `${at.side}:${at.line}` : null);
                }}
              >
                <ChatCircle size={13} aria-hidden="true" />
                Comment
              </Button>
              <Button
                variant={state === "kept" ? "ghost" : "secondary"}
                size="sm"
                disabled={busy}
                onClick={onKeep}
              >
                <Check size={13} aria-hidden="true" />
                {state === "kept" ? "Kept" : "Keep"}
              </Button>
            </>
          )}
        </span>
      </div>
      <div
        className={cn(
          "overflow-x-auto py-1.5 font-mono text-[12px] leading-5 [tab-size:4]",
          state === "undone" && "line-through decoration-fg-subtle/40 opacity-40",
        )}
      >
        <div className="w-max min-w-full">
          {lines.map((line, index) => {
            const at = target(line);
            const key = at ? `${at.side}:${at.line}` : null;
            const lineComments = key ? (byLine.get(key) ?? []) : [];
            return (
              <div key={index}>
                <Button
                  variant="ghost"
                  disabled={!at || state === "undone"}
                  title="Comment on this line"
                  onClick={() => setDraft(key === draft ? null : key)}
                  className={cn(
                    "h-5 w-full justify-start gap-0 rounded-none px-0 pr-3.5 pl-1 text-left font-mono text-[12px] font-normal text-fg-default hover:bg-bg-hover",
                    LINE_CLASS[line.type],
                  )}
                >
                  <DiffGutter line={line} digits={digits} />
                  <span className={cn("w-4.5 shrink-0", SIGN_CLASS[line.type])}>
                    {SIGN[line.type]}
                  </span>
                  <span className="flex-1 whitespace-pre">{line.content}</span>
                </Button>
                {(lineComments.length > 0 || (key !== null && key === draft)) && (
                  <div className="my-1 mr-3.5 ml-16 flex flex-col gap-1.5 font-sans">
                    {lineComments.map((comment) => (
                      <ReviewCommentCard
                        key={comment.id}
                        comment={comment}
                        onUpdate={(body) => onUpdateComment(comment.id, body)}
                        onRemove={() => onRemoveComment(comment.id)}
                      />
                    ))}
                    {key === draft && at && (
                      <ReviewCommentEditor
                        submitLabel="Comment"
                        onSubmit={(body) => {
                          onComment(at.side, at.line, line.content, body);
                          setDraft(null);
                        }}
                        onCancel={() => setDraft(null)}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </article>
  );
}
