import { cn } from "@/shared/lib/utils";
import type { GitProgress } from "@/shared/stores/git";
import { ArrowDown, ArrowUp, GitBranch, Spinner } from "@phosphor-icons/react";

interface BranchTriggerProps {
  open: boolean;
  onToggle: () => void;
  isCheckoutBusy: boolean;
  currentBranch: string;
  isDetached: boolean;
  ahead: number;
  behind: number;
  actionStatus: string | null;
  actionProgress: GitProgress | null;
}

export function BranchTrigger({
  open,
  onToggle,
  isCheckoutBusy,
  currentBranch,
  isDetached,
  ahead,
  behind,
  actionStatus,
  actionProgress,
}: BranchTriggerProps) {
  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        disabled={isCheckoutBusy}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md bg-bg-hover px-2 py-1 text-ui-xs font-medium transition-colors",
          open ? "bg-bg-active" : "hover:bg-bg-hover",
          isCheckoutBusy && "opacity-60",
        )}
      >
        {isCheckoutBusy ? (
          <Spinner size={11} className="animate-spin text-fg-muted" />
        ) : (
          <GitBranch size={11} className="text-fg-muted" />
        )}
        <span className="truncate max-w-[120px]">{currentBranch}</span>
        {isDetached && (
          <span className="rounded bg-bg-hover px-1 py-px text-ui-xs font-medium uppercase tracking-wider text-fg-muted">
            detached
          </span>
        )}
      </button>

      {ahead > 0 || behind > 0 ? (
        <div className="flex items-center gap-0.5 text-ui-xs font-semibold text-fg-muted">
          {ahead > 0 && (
            <span className="inline-flex items-center gap-0.5 rounded border border-border px-1 py-px">
              <ArrowUp size={8} />
              {ahead}
            </span>
          )}
          {behind > 0 && (
            <span className="inline-flex items-center gap-0.5 rounded border border-border px-1 py-px">
              <ArrowDown size={8} />
              {behind}
            </span>
          )}
        </div>
      ) : null}

      {/* Status indicator */}
      {actionStatus && (
        <div className="flex animate-pulse items-center gap-1 text-ui-xs text-fg-muted">
          <Spinner size={10} className="animate-spin" />
          <span className="max-w-[100px] truncate">{actionStatus}</span>
          {actionProgress && actionProgress.total_objects > 0 && (
            <span className="text-ui-xs">
              {actionProgress.received_objects}/{actionProgress.total_objects}
            </span>
          )}
        </div>
      )}
    </>
  );
}
