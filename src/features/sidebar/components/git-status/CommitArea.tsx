import { Button } from "@/shared/components/ui/button";
import { Kbd } from "@/shared/components/ui/kbd";
import { Textarea } from "@/shared/components/ui/textarea";
import { getIsMac } from "@/shared/lib/shortcuts";
import { useGitStore } from "@/shared/stores/git";
import { CommitOptions } from "./CommitOptions";

function commitLabel(amend: boolean, busy: boolean, stagedCount: number): string {
  if (busy) return amend ? "Amending…" : "Committing…";
  if (amend) return "Amend";
  if (stagedCount === 0) return "Stage files first";
  return `Commit ${stagedCount}`;
}

/// The commit line at the foot of Changes, like the command line of design D.
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
    <div className="shrink-0 border-t border-border-subtle p-2.5">
      <div className="flex flex-col rounded-[6px] ring-1 ring-fg-default/15 ring-inset transition-[box-shadow] duration-(--motion-fast) focus-within:ring-primary/60">
        <div className="flex gap-2 px-2.5 pt-2">
          <span
            aria-hidden="true"
            className="font-mono text-ui-sm leading-5 font-semibold text-primary"
          >
            ❯
          </span>
          <Textarea
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="describe your changes"
            aria-label="Commit message"
            rows={2}
            className="max-h-[200px] min-h-10 resize-none rounded-none bg-transparent p-0 leading-5 ring-0 hover:ring-0 focus-visible:ring-0"
          />
        </div>
        <div className="flex items-center gap-2 px-2 pt-1.5 pb-2 @max-[18rem]:flex-col @max-[18rem]:items-stretch">
          <div className="min-w-0 flex-1">
            <CommitOptions stagedCount={stagedCount} />
          </div>
          <Button size="sm" disabled={!canCommit} onClick={onCommit}>
            {commitLabel(commitAmend, actionBusy === "commit", stagedCount)}
            {showShortcut && <Kbd>{getIsMac() ? "⌘↵" : "Ctrl+↵"}</Kbd>}
          </Button>
        </div>
      </div>
    </div>
  );
}
