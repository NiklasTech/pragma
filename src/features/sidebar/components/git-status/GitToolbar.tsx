import { ArrowsClockwise, DownloadSimple, ArrowDown, ArrowUp, Plus } from "@phosphor-icons/react";
import { ToolbarButton } from "./ToolbarButton";

export function GitToolbar({
  onRefresh,
  onFetch,
  onPull,
  onPush,
  onNewBranch,
  canPushPull,
  ahead,
  behind,
  isPushBusy,
  isPullBusy,
  isFetchBusy,
  isRefreshBusy,
}: {
  onRefresh: () => void;
  onFetch: () => void;
  onPull: () => void;
  onPush: () => void;
  onNewBranch: () => void;
  canPushPull: boolean;
  ahead: number;
  behind: number;
  isPushBusy: boolean;
  isPullBusy: boolean;
  isFetchBusy: boolean;
  isRefreshBusy: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-1 border-b border-border/60 px-3 py-2">
      <div className="flex items-center gap-0.5">
        <ToolbarButton
          icon={ArrowsClockwise}
          label="Refresh"
          onClick={onRefresh}
          busy={isRefreshBusy}
        />
        <ToolbarButton icon={DownloadSimple} label="Fetch" onClick={onFetch} busy={isFetchBusy} />
        <ToolbarButton
          icon={ArrowDown}
          label="Pull"
          onClick={onPull}
          busy={isPullBusy}
          disabled={!canPushPull || behind === 0}
          badge={behind > 0 ? behind : null}
        />
        <ToolbarButton
          icon={ArrowUp}
          label="Push"
          onClick={onPush}
          busy={isPushBusy}
          disabled={!canPushPull || ahead === 0}
          badge={ahead > 0 ? ahead : null}
        />
      </div>
      <ToolbarButton icon={Plus} label="New Branch" onClick={onNewBranch} />
    </div>
  );
}
