import { useEffect, useState } from "react";
import { ArrowUUpLeft, CaretDown, CaretRight, DownloadSimple, Trash } from "@phosphor-icons/react";
import { useGitStore } from "@/shared/stores/git";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { formatStashDate } from "./stashFormat";

export function StashPanel() {
  const repoPath = useGitStore((state) => state.repoPath);
  const stashes = useGitStore((state) => state.stashes);
  const stashBusy = useGitStore((state) => state.stashBusy);
  const loadStashes = useGitStore((state) => state.loadStashes);
  const stashPush = useGitStore((state) => state.stashPush);
  const stashPop = useGitStore((state) => state.stashPop);
  const stashApply = useGitStore((state) => state.stashApply);
  const stashDrop = useGitStore((state) => state.stashDrop);

  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (repoPath) void loadStashes();
  }, [repoPath, loadStashes]);

  const handlePush = () => {
    void stashPush(message.trim());
    setMessage("");
  };

  return (
    <div className="shrink-0 border-b border-border/60">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center gap-1.5 px-3 py-1.5 text-ui-xs text-fg-muted transition-colors hover:text-fg-default"
      >
        {expanded ? <CaretDown size={12} /> : <CaretRight size={12} />}
        <span className="font-medium">Stashes</span>
        <span className="text-fg-subtle">{stashes.length}</span>
      </button>

      {expanded && (
        <div className="flex flex-col gap-1 px-3 pb-2">
          <div className="flex items-center gap-1">
            <Input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handlePush();
                }
              }}
              placeholder="Stash message (optional)"
              className="h-7 text-ui-xs"
            />
            <Button
              variant="outline"
              size="sm"
              className="h-7 shrink-0 px-2 text-ui-xs"
              disabled={stashBusy}
              onClick={handlePush}
            >
              Stash
            </Button>
          </div>

          {stashes.length === 0 ? (
            <div className="px-1 py-1 text-ui-xs text-fg-subtle">No stashes</div>
          ) : (
            stashes.map((stash) => (
              <div
                key={stash.ref_name}
                className="group flex items-center gap-1 rounded px-1 py-1 hover:bg-bg-hover"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-ui-xs text-fg-default">
                    {stash.message || `WIP on ${stash.ref_name}`}
                  </div>
                  <div className="flex items-center gap-1.5 text-ui-xs text-fg-subtle">
                    <span className="font-mono">{stash.ref_name}</span>
                    <span>·</span>
                    <span>{formatStashDate(stash.timestamp_secs)}</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  title="Pop stash"
                  disabled={stashBusy}
                  onClick={() => void stashPop(stash.ref_name)}
                >
                  <ArrowUUpLeft size={13} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  title="Apply stash"
                  disabled={stashBusy}
                  onClick={() => void stashApply(stash.ref_name)}
                >
                  <DownloadSimple size={13} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  title="Drop stash"
                  disabled={stashBusy}
                  onClick={() => void stashDrop(stash.ref_name)}
                >
                  <Trash size={13} />
                </Button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
