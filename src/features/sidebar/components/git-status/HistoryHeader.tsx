import { CaretDown, CaretRight, ClockCounterClockwise } from "@phosphor-icons/react";

export function HistoryHeader({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex h-7 w-full items-center gap-1.5 px-3 text-left transition-colors hover:bg-bg-hover"
    >
      {expanded ? (
        <CaretDown size={11} className="text-fg-muted" />
      ) : (
        <CaretRight size={11} className="text-fg-muted" />
      )}
      <ClockCounterClockwise size={11} className="text-fg-muted" />
      <span className="text-ui-xs font-semibold uppercase tracking-[0.14em] text-fg-muted">
        Recent Commits
      </span>
    </button>
  );
}
