import { Button } from "@/shared/components/ui/button";
import { Textarea } from "@/shared/components/ui/textarea";
import { getIsMac } from "@/shared/lib/shortcuts";

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
    <div className="flex flex-col gap-2 px-2.5 pt-1 pb-2">
      <Textarea
        value={commitMessage}
        onChange={(e) => setCommitMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Describe your changes"
        rows={3}
        className="max-h-[240px] min-h-[64px] resize-none rounded-lg"
      />
      <Button disabled={!canCommit} onClick={onCommit} className="w-full rounded-lg">
        {actionBusy === "commit"
          ? "Committing…"
          : stagedCount === 0
            ? "Stage files to commit"
            : `Commit ${stagedCount} ${stagedCount === 1 ? "file" : "files"}`}
        {stagedCount > 0 && actionBusy !== "commit" && (
          <span className="ml-auto font-mono text-ui-2xs opacity-60">
            {getIsMac() ? "\u2318\u21B5" : "Ctrl+\u21B5"}
          </span>
        )}
      </Button>
    </div>
  );
}
