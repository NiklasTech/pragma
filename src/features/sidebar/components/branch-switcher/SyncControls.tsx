import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import { ArrowDown, ArrowUp, ArrowsClockwise, Spinner } from "@phosphor-icons/react";

interface SyncControlsProps {
  ahead: number;
  behind: number;
  hasRemote: boolean;
  canPushPull: boolean;
  isPushBusy: boolean;
  isPullBusy: boolean;
  isFetchBusy: boolean;
  showPullOptions: boolean;
  onTogglePullOptions: () => void;
  onPush: () => void;
  onPull: (rebase: boolean) => void;
  onFetch: () => void;
}

export function SyncControls({
  ahead,
  behind,
  hasRemote,
  canPushPull,
  isPushBusy,
  isPullBusy,
  isFetchBusy,
  showPullOptions,
  onTogglePullOptions,
  onPush,
  onPull,
  onFetch,
}: SyncControlsProps) {
  return (
    <>
      {/* Push / Pull / Fetch buttons */}
      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => onPush()}
          disabled={!canPushPull || isPushBusy || ahead === 0}
          title={!hasRemote ? "No remote configured" : ahead === 0 ? "Nothing to push" : "Push"}
          className={cn("text-fg-muted")}
        >
          {isPushBusy ? <Spinner size={12} className="animate-spin" /> : <ArrowUp size={12} />}
        </Button>

        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onTogglePullOptions}
          disabled={!canPushPull || isPullBusy || behind === 0}
          title={!hasRemote ? "No remote configured" : behind === 0 ? "Already up to date" : "Pull"}
          className={cn("text-fg-muted")}
        >
          {isPullBusy ? <Spinner size={12} className="animate-spin" /> : <ArrowDown size={12} />}
        </Button>

        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => onFetch()}
          disabled={!canPushPull || isFetchBusy}
          title={!hasRemote ? "No remote configured" : "Fetch"}
          className={cn("text-fg-muted")}
        >
          {isFetchBusy ? (
            <Spinner size={12} className="animate-spin" />
          ) : (
            <ArrowsClockwise size={12} />
          )}
        </Button>
      </div>

      {/* Pull options dropdown */}
      {showPullOptions && (
        <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded-md border border-border bg-bg-elevated shadow-lg shadow-black/10">
          <Button
            variant="ghost"
            onClick={() => onPull(false)}
            className="h-8 w-full justify-start gap-2 rounded-none px-3 font-normal text-fg-default"
          >
            <ArrowDown size={12} />
            Pull (merge)
          </Button>
          <Button
            variant="ghost"
            onClick={() => onPull(true)}
            className="h-8 w-full justify-start gap-2 rounded-none px-3 font-normal text-fg-default"
          >
            <ArrowsClockwise size={12} />
            Pull (rebase)
          </Button>
        </div>
      )}
    </>
  );
}
