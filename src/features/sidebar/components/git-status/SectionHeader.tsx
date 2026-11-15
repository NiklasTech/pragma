import { Button } from "@/shared/components/ui/button";
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
    <div className="flex h-6 items-center gap-2 pr-3.5 pl-3">
      <span className="text-ui-xs font-semibold text-fg-default">{title}</span>
      <span className="rounded-full bg-bg-hover px-1.5 text-ui-2xs text-fg-muted tabular-nums">
        {count}
      </span>
      <div className="ml-auto flex items-center gap-1">
        {mode === "unstaged" && onStageAll && count > 0 && (
          <Button
            variant="ghost"
            size="xs"
            onClick={onStageAll}
            disabled={actionBusy !== null}
            className="px-1.5 text-ui-xs"
          >
            Stage all
          </Button>
        )}
        {mode === "staged" && onUnstageAll && count > 0 && (
          <Button
            variant="ghost"
            size="xs"
            onClick={onUnstageAll}
            disabled={actionBusy !== null}
            className="px-1.5 text-ui-xs"
          >
            Unstage all
          </Button>
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
