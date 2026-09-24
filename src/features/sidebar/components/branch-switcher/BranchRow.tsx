import { cn } from "@/shared/lib/utils";
import type { GitBranch } from "@/shared/stores/git";
import { Check, GitBranch as GitBranchIcon, Spinner, Trash } from "@phosphor-icons/react";

interface BranchRowProps {
  branch: GitBranch;
  isCurrent: boolean;
  isPending: boolean;
  isDeleteBusy: boolean;
  onSelect: (branchName: string) => void;
  onDelete: (branchName: string) => void;
}

export function BranchRow({
  branch,
  isCurrent,
  isPending,
  isDeleteBusy,
  onSelect,
  onDelete,
}: BranchRowProps) {
  return (
    <div
      className={cn(
        "group flex items-center gap-2 px-3 py-1.5 text-ui-sm",
        isCurrent
          ? "bg-bg-active font-medium text-fg-default"
          : "text-fg-default hover:bg-bg-hover",
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(branch.name)}
        disabled={isPending || isCurrent}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        {isPending ? (
          <Spinner size={12} className="shrink-0 animate-spin text-fg-muted" />
        ) : isCurrent ? (
          <Check size={12} className="shrink-0 text-primary" weight="bold" />
        ) : (
          <GitBranchIcon size={12} className="shrink-0 text-fg-muted" />
        )}
        <span className="truncate">{branch.name}</span>
      </button>

      {!isCurrent && (
        <button
          type="button"
          onClick={() => onDelete(branch.name)}
          disabled={isDeleteBusy}
          className="shrink-0 rounded p-0.5 text-fg-muted opacity-0 transition-opacity hover:text-status-error group-hover:opacity-100"
          title="Delete branch"
        >
          <Trash size={12} />
        </button>
      )}
    </div>
  );
}
