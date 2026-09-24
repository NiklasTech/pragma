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
        <button
          type="button"
          onClick={() => onPush()}
          disabled={!canPushPull || isPushBusy || ahead === 0}
          title={!hasRemote ? "No remote configured" : ahead === 0 ? "Nothing to push" : "Push"}
          className={cn(
            "rounded p-1 transition-colors",
            canPushPull && ahead > 0
              ? "text-fg-default/70 hover:bg-bg-hover hover:text-fg-default"
              : "text-fg-muted/30 cursor-not-allowed",
          )}
        >
          {isPushBusy ? <Spinner size={12} className="animate-spin" /> : <ArrowUp size={12} />}
        </button>

        <button
          type="button"
          onClick={onTogglePullOptions}
          disabled={!canPushPull || isPullBusy || behind === 0}
          title={!hasRemote ? "No remote configured" : behind === 0 ? "Already up to date" : "Pull"}
          className={cn(
            "rounded p-1 transition-colors",
            canPushPull && behind > 0
              ? "text-fg-default/70 hover:bg-bg-hover hover:text-fg-default"
              : "text-fg-muted/30 cursor-not-allowed",
          )}
        >
          {isPullBusy ? <Spinner size={12} className="animate-spin" /> : <ArrowDown size={12} />}
        </button>

        <button
          type="button"
          onClick={() => onFetch()}
          disabled={!canPushPull || isFetchBusy}
          title={!hasRemote ? "No remote configured" : "Fetch"}
          className={cn(
            "rounded p-1 transition-colors",
            canPushPull
              ? "text-fg-default/70 hover:bg-bg-hover hover:text-fg-default"
              : "text-fg-muted/30 cursor-not-allowed",
          )}
        >
          {isFetchBusy ? (
            <Spinner size={12} className="animate-spin" />
          ) : (
            <ArrowsClockwise size={12} />
          )}
        </button>
      </div>

      {/* Pull options dropdown */}
      {showPullOptions && (
        <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded-md border border-border bg-bg-elevated shadow-lg shadow-black/10">
          <button
            type="button"
            onClick={() => onPull(false)}
            className="flex w-full items-center gap-2 px-3 py-2 text-ui-sm text-fg-default hover:bg-bg-hover"
          >
            <ArrowDown size={12} />
            Pull (merge)
          </button>
          <button
            type="button"
            onClick={() => onPull(true)}
            className="flex w-full items-center gap-2 px-3 py-2 text-ui-sm text-fg-default hover:bg-bg-hover"
          >
            <ArrowsClockwise size={12} />
            Pull (rebase)
          </button>
        </div>
      )}
    </>
  );
}
