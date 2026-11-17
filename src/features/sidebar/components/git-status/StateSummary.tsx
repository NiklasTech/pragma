import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";

import { FILE_STATES, STATE_INFO, type FileState } from "./fileState";

/// How many files changed and how many per state; a state's letter filters the list to it.
export function StateSummary({
  total,
  counts,
  filter,
  onFilter,
  canStageAll,
  onStageAll,
}: {
  total: number;
  counts: Record<FileState, number>;
  filter: FileState | null;
  onFilter: (state: FileState | null) => void;
  canStageAll: boolean;
  onStageAll: () => void;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-border-subtle px-3 pb-2.5">
      <span className="mr-1.5 font-mono text-[11.5px] text-fg-default tabular-nums">
        {total} {total === 1 ? "file" : "files"}
      </span>
      {FILE_STATES.filter((state) => counts[state] > 0).map((state) => {
        const info = STATE_INFO[state];
        const active = filter === state;
        return (
          <Button
            key={state}
            variant="ghost"
            size="xs"
            title={`${info.title}${active ? ". Click to show all." : ". Click to show only these."}`}
            aria-label={`${counts[state]} ${info.title}`}
            aria-pressed={active}
            onClick={() => onFilter(active ? null : state)}
            className={cn(
              "h-5.5 gap-1.5 bg-current/12 px-1.5 text-[11px] tabular-nums hover:bg-current/20",
              info.color,
              active && "ring-1 ring-current/60 ring-inset",
              filter !== null && !active && "opacity-45",
            )}
          >
            <span className="font-bold">{state}</span>
            {counts[state]}
          </Button>
        );
      })}
      <Button
        variant="ghost"
        size="xs"
        disabled={!canStageAll}
        onClick={onStageAll}
        className="ml-auto h-5.5 px-1.5 text-[11px] text-fg-subtle"
      >
        stage all
      </Button>
    </div>
  );
}
