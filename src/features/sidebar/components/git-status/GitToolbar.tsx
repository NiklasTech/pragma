import {
  ArrowsClockwise,
  ArrowDown,
  ArrowUp,
  CloudArrowDown,
  GitBranch,
  GitDiff,
  Spinner,
  Tag,
  type Icon,
} from "@phosphor-icons/react";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import { ToolbarButton } from "./ToolbarButton";

function SyncButton({
  icon: IconComponent,
  label,
  count,
  busy,
  disabled,
  onClick,
}: {
  icon: Icon;
  label: string;
  count: number;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={disabled || busy}
      title={count > 0 ? `${label} ${count} commit${count === 1 ? "" : "s"}` : label}
      className={cn(
        "h-7 flex-1 gap-1.5 rounded-none px-2.5 not-first:border-l not-first:border-fg-default/15 disabled:opacity-60 @min-[340px]:flex-none",
        count > 0 ? "text-fg-default" : "text-fg-subtle",
      )}
    >
      {busy ? (
        <Spinner size={12} className="animate-spin" />
      ) : (
        <IconComponent size={12} weight="bold" />
      )}
      {label.toLowerCase()}
      {count > 0 && <span className="text-primary tabular-nums">{count}</span>}
    </Button>
  );
}

export function GitToolbar({
  onRefresh,
  onFetch,
  onPull,
  onPush,
  onNewBranch,
  onCompare,
  onTags,
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
  onCompare: () => void;
  onTags: () => void;
  canPushPull: boolean;
  ahead: number;
  behind: number;
  isPushBusy: boolean;
  isPullBusy: boolean;
  isFetchBusy: boolean;
  isRefreshBusy: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-2.5 pb-2.5">
      <div className="flex flex-1 overflow-hidden rounded-[5px] ring-1 ring-fg-default/15 ring-inset @min-[340px]:flex-none">
        <SyncButton
          icon={ArrowDown}
          label="Pull"
          count={behind}
          busy={isPullBusy}
          disabled={!canPushPull || behind === 0}
          onClick={onPull}
        />
        <SyncButton
          icon={ArrowUp}
          label="Push"
          count={ahead}
          busy={isPushBusy}
          disabled={!canPushPull || ahead === 0}
          onClick={onPush}
        />
        <SyncButton
          icon={CloudArrowDown}
          label="Fetch"
          count={0}
          busy={isFetchBusy}
          disabled={!canPushPull}
          onClick={onFetch}
        />
      </div>
      {ahead === 0 && behind === 0 && (
        <span className="hidden items-center gap-1.5 truncate font-mono text-[11px] text-fg-subtle @min-[420px]:inline-flex">
          <span aria-hidden="true" className="size-1.5 rounded-[1px] bg-status-success" />
          up to date
        </span>
      )}
      {/* A narrow panel puts the tools on their own row, spread to the width of the sync buttons. */}
      <div className="flex w-full items-center justify-between @min-[340px]:ml-auto @min-[340px]:w-auto @min-[340px]:justify-start @min-[340px]:gap-0.5">
        <ToolbarButton
          icon={ArrowsClockwise}
          label="Refresh local status (does not fetch)"
          onClick={onRefresh}
          busy={isRefreshBusy}
        />
        <ToolbarButton icon={GitBranch} label="New branch" onClick={onNewBranch} />
        <ToolbarButton icon={Tag} label="Tags" onClick={onTags} />
        <ToolbarButton icon={GitDiff} label="Compare" onClick={onCompare} />
      </div>
    </div>
  );
}
