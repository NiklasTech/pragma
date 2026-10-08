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
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      title={count > 0 ? `${label} ${count} commit${count === 1 ? "" : "s"}` : label}
      className={cn(
        "flex h-7 items-center gap-1.5 rounded-md border px-2 text-ui-xs font-medium transition-colors disabled:pointer-events-none",
        count > 0
          ? "border-primary/30 bg-accent-subtle text-primary hover:bg-primary/20"
          : "border-border-subtle text-fg-muted hover:bg-bg-hover hover:text-fg-default disabled:opacity-50",
      )}
    >
      {busy ? (
        <Spinner size={12} className="animate-spin" />
      ) : (
        <IconComponent size={12} weight="bold" />
      )}
      {label}
      {count > 0 && <span className="tabular-nums">{count}</span>}
    </button>
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
    <div className="flex items-center gap-1 px-2.5 pb-2">
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
      {ahead === 0 && behind === 0 && (
        <span className="hidden truncate pl-1 text-ui-2xs text-fg-subtle @min-[280px]:inline">
          Up to date
        </span>
      )}
      <div className="ml-auto flex items-center gap-0.5">
        <ToolbarButton icon={CloudArrowDown} label="Fetch" onClick={onFetch} busy={isFetchBusy} />
        <ToolbarButton
          icon={ArrowsClockwise}
          label="Refresh"
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
