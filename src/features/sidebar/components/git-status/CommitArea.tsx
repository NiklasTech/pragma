import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/components/ui/button";
import { Textarea } from "@/shared/components/ui/textarea";

export function CommitArea({
  commitMessage,
  setCommitMessage,
  handleKeyDown,
  canCommit,
  stagedCount,
  actionBusy,
  onCommit,
}: {
  commitMessage: string;
  setCommitMessage: (v: string) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  canCommit: boolean;
  stagedCount: number;
  actionBusy: string | null;
  onCommit: () => void;
}) {
  return (
    <div className="p-3">
      <div className="rounded-xl border border-border bg-bg-elevated p-3">
        <Textarea
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Commit message"
          rows={3}
          className="field-sizing-fixed max-h-[240px] min-h-[88px] resize-none border-0 bg-transparent px-0 py-1 text-ui-base leading-snug shadow-none placeholder:text-fg-subtle focus-visible:ring-0"
        />

        <div className="mt-2.5 flex items-center justify-between gap-2 text-ui-xs text-fg-muted">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                canCommit
                  ? "bg-fg-default/80"
                  : stagedCount > 0
                    ? "bg-fg-muted/60"
                    : "bg-fg-subtle/60",
              )}
            />
            <span className="truncate font-medium text-fg-default/85">
              {stagedCount === 0
                ? "Nothing staged"
                : `${stagedCount} ${stagedCount === 1 ? "file" : "files"} staged`}
            </span>
            {commitMessage.length > 0 && (
              <span className="text-fg-subtle">· {commitMessage.length} chars</span>
            )}
          </div>
          <Button size="default" className="h-8" disabled={!canCommit} onClick={onCommit}>
            {actionBusy === "commit" ? "Committing…" : "Commit"}
          </Button>
        </div>
      </div>
    </div>
  );
}
