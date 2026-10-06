import { PaperPlaneRight } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { sendToSession } from "@/features/ai/tasks/sessionRuns";
import { Button } from "@/shared/components/ui/button";

import { useReviewCommentsStore, type ReviewComment } from "./comments";
import { ReviewCommentCard } from "./ReviewCommentCard";
import { buildReviewMessage } from "./reviewMessage";

function groupByPath(comments: readonly ReviewComment[]): Array<[string, ReviewComment[]]> {
  const groups = new Map<string, ReviewComment[]>();
  for (const comment of comments) {
    groups.set(comment.path, [...(groups.get(comment.path) ?? []), comment]);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

/** The session's review comments per file and the action that sends them to the session. */
export function ReviewComments({ sessionId }: { sessionId: string }) {
  const allComments = useReviewCommentsStore((state) => state.comments);
  const updateComment = useReviewCommentsStore((state) => state.updateComment);
  const removeComment = useReviewCommentsStore((state) => state.removeComment);
  const clearSession = useReviewCommentsStore((state) => state.clearSession);
  const [sending, setSending] = useState(false);

  const comments = useMemo(
    () => allComments.filter((comment) => comment.sessionId === sessionId),
    [allComments, sessionId],
  );
  const groups = useMemo(() => groupByPath(comments), [comments]);

  if (comments.length === 0) return null;

  const sendReview = async () => {
    setSending(true);
    const sent = await sendToSession(sessionId, buildReviewMessage(comments));
    setSending(false);
    if (!sent) {
      toast.error("Could not send the review. Try again once the session is idle.");
      return;
    }
    clearSession(sessionId);
  };

  return (
    <div className="border-t border-border-subtle pt-1">
      <div className="flex items-center gap-2 px-3 pt-2 pb-1">
        <span className="flex-1 text-ui-2xs font-semibold tracking-wider text-fg-subtle uppercase">
          Comments ({comments.length})
        </span>
        <Button
          size="xs"
          className="text-ui-xs"
          disabled={sending}
          onClick={() => void sendReview()}
        >
          <PaperPlaneRight size={12} />
          Send review
        </Button>
      </div>
      <div className="flex flex-col gap-2 px-3 pb-2">
        {groups.map(([path, fileComments]) => (
          <div key={path} className="flex flex-col gap-1">
            <span className="truncate font-mono text-ui-2xs text-fg-muted" title={path}>
              {path}
            </span>
            {fileComments.map((comment) => (
              <ReviewCommentCard
                key={comment.id}
                comment={comment}
                label={`${comment.side === "old" ? "Removed line" : "Line"} ${comment.line}: ${comment.code.trim()}`}
                onUpdate={(body) => updateComment(comment.id, body)}
                onRemove={() => removeComment(comment.id)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
