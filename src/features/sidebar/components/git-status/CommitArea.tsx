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
    <div className="space-y-2 border-b border-border/60 px-2.5 pb-2.5 pt-2.5">
      <div
        className={cn(
          "relative rounded-lg border bg-bg-surface shadow-sm transition-colors",
          commitMessage.length > 0 ? "border-border/70" : "border-border/45",
          "focus-within:border-primary/45 focus-within:shadow-[0_0_12px_-4px_var(--color-accent-glow)]",
        )}
      >
        <Textarea
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Commit message"
          rows={3}
          className="field-sizing-fixed max-h-[240px] min-h-[120px] resize-none overflow-y-auto rounded-lg border-0 bg-transparent px-3 pb-2 pt-2 text-ui-sm leading-snug shadow-none placeholder:text-fg-subtle focus-visible:ring-0"
        />
      </div>

      <div className="flex items-center justify-between gap-1.5 text-ui-xs text-fg-muted">
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
        <Button
          size="sm"
          className="h-7 text-ui-sm font-semibold"
          disabled={!canCommit}
          onClick={onCommit}
        >
          {actionBusy === "commit" ? "Committing…" : "Commit"}
        </Button>
      </div>
    </div>
  );
}
