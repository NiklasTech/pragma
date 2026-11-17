import { Button } from "@/shared/components/ui/button";

export function SectionHeader({
  title,
  count,
  actionBusy,
  onStageAll,
  onUnstageAll,
  mode,
}: {
  title: string;
  count: number;
  actionBusy: string | null;
  onStageAll?: () => void;
  onUnstageAll?: () => void;
  mode: "staged" | "unstaged";
}) {
  return (
    <div className="flex h-6 items-center gap-2 pr-3.5 pl-3">
      <span className="font-mono text-[10.5px] tracking-[0.08em] text-fg-subtle uppercase">
        {title}
      </span>
      <span className="rounded-[3px] px-1.5 font-mono text-[10.5px] text-fg-muted tabular-nums ring-1 ring-fg-default/15 ring-inset">
        {count}
      </span>
      <div className="ml-auto flex items-center gap-1">
        {mode === "unstaged" && onStageAll && count > 0 && (
          <Button
            variant="ghost"
            size="xs"
            onClick={onStageAll}
            disabled={actionBusy !== null}
            className="px-1.5 text-[11px]"
          >
            stage all
          </Button>
        )}
        {mode === "staged" && onUnstageAll && count > 0 && (
          <Button
            variant="ghost"
            size="xs"
            onClick={onUnstageAll}
            disabled={actionBusy !== null}
            className="px-1.5 text-[11px]"
          >
            unstage all
          </Button>
        )}
      </div>
    </div>
  );
}
