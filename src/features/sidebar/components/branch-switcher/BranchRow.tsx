import { Button } from "@/shared/components/ui/button";
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
      <Button
        variant="ghost"
        size="xs"
        onClick={() => onSelect(branch.name)}
        disabled={isPending || isCurrent}
        className="min-w-0 flex-1 justify-start gap-2 px-0 text-left text-ui-sm font-normal text-fg-default hover:bg-transparent disabled:opacity-100"
      >
        {isPending ? (
          <Spinner size={12} className="shrink-0 animate-spin text-fg-muted" />
        ) : isCurrent ? (
          <Check size={12} className="shrink-0 text-primary" weight="bold" />
        ) : (
          <GitBranchIcon size={12} className="shrink-0 text-fg-muted" />
        )}
        <span className="truncate">{branch.name}</span>
      </Button>

      {!isCurrent && (
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Delete branch"
          onClick={() => onDelete(branch.name)}
          disabled={isDeleteBusy}
          className="text-fg-muted opacity-0 group-hover:opacity-100 hover:text-status-error"
          title="Delete branch"
        >
          <Trash size={12} />
        </Button>
      )}
    </div>
  );
}
