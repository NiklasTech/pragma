import { type CheckState } from "@/shared/stores/git";
import { Checkbox } from "@/shared/components/ui/checkbox";

export function SectionHeader({
  title,
  count,
  checkState,
  actionBusy,
  onToggleAll,
  onStageAll,
  onUnstageAll,
  mode,
}: {
  title: string;
  count: number;
  checkState: CheckState;
  actionBusy: string | null;
  onToggleAll: () => void;
  onStageAll?: () => void;
  onUnstageAll?: () => void;
  mode: "staged" | "unstaged";
}) {
  return (
    <div className="flex h-7 items-center gap-2 px-3">
      <span className="text-ui-xs font-semibold uppercase tracking-[0.14em] text-fg-muted">
        {title}
      </span>
      <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full border border-border/60 px-1 text-ui-xs font-semibold text-fg-muted">
        {count}
      </span>
      <div className="ml-auto flex items-center gap-1">
        {mode === "unstaged" && onStageAll && count > 0 && (
          <button
            type="button"
            onClick={onStageAll}
            disabled={actionBusy !== null}
            className="text-ui-2xs font-medium text-fg-muted transition-colors hover:text-fg-default disabled:opacity-40"
          >
            Stage all
          </button>
        )}
        {mode === "staged" && onUnstageAll && count > 0 && (
          <button
            type="button"
            onClick={onUnstageAll}
            disabled={actionBusy !== null}
            className="text-ui-2xs font-medium text-fg-muted transition-colors hover:text-fg-default disabled:opacity-40"
          >
            Unstage all
          </button>
        )}
        <label className="ml-2 flex shrink-0 cursor-pointer select-none items-center gap-1.5 text-ui-xs font-medium text-fg-muted hover:text-fg-default">
          <Checkbox
            checked={checkState === "checked"}
            disabled={actionBusy !== null || count === 0}
            onCheckedChange={() => onToggleAll()}
            className="size-3.5"
            data-indeterminate={checkState === "indeterminate" || undefined}
          />
        </label>
      </div>
    </div>
  );
}
