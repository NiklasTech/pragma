import { Button } from "@/shared/components/ui/button";
import { Textarea } from "@/shared/components/ui/textarea";
import { getIsMac } from "@/shared/lib/shortcuts";
import { useGitStore } from "@/shared/stores/git";
import { CommitOptions } from "./CommitOptions";

function commitLabel(amend: boolean, busy: boolean, stagedCount: number): string {
  if (busy) return amend ? "Amending…" : "Committing…";
  if (amend) return "Amend last commit";
  if (stagedCount === 0) return "Stage files to commit";
  return `Commit ${stagedCount} ${stagedCount === 1 ? "file" : "files"}`;
}

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
  const commitAmend = useGitStore((s) => s.commitAmend);
  const showShortcut = (commitAmend || stagedCount > 0) && actionBusy !== "commit";

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
      <CommitOptions stagedCount={stagedCount} />
      <Button disabled={!canCommit} onClick={onCommit} className="w-full rounded-lg">
        {commitLabel(commitAmend, actionBusy === "commit", stagedCount)}
        {showShortcut && (
          <span className="ml-auto font-mono text-ui-2xs opacity-60">
            {getIsMac() ? "\u2318\u21B5" : "Ctrl+\u21B5"}
          </span>
        )}
      </Button>
    </div>
  );
}
