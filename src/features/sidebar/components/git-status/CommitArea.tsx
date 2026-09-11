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
    <div className="p-2">
      <Textarea
        value={commitMessage}
        onChange={(e) => setCommitMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Commit message"
        rows={3}
        className="max-h-[240px] min-h-[72px] resize-none rounded-sm"
      />

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="truncate text-ui-xs text-fg-muted">
          {stagedCount === 0
            ? "Nothing staged"
            : `${stagedCount} ${stagedCount === 1 ? "file" : "files"} staged`}
        </span>
        <Button disabled={!canCommit} onClick={onCommit}>
          {actionBusy === "commit" ? "Committing…" : "Commit"}
        </Button>
      </div>
    </div>
  );
}
