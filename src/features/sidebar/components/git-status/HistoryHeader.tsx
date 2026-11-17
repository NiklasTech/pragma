import { CaretDown, CaretRight, ClockCounterClockwise } from "@phosphor-icons/react";
import { Button } from "@/shared/components/ui/button";

export function HistoryHeader({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  return (
    <Button
      variant="ghost"
      aria-expanded={expanded}
      onClick={onToggle}
      className="h-7 w-full justify-start gap-1.5 rounded-none px-3 text-left font-normal text-fg-default"
    >
      {expanded ? (
        <CaretDown size={11} className="text-fg-muted" />
      ) : (
        <CaretRight size={11} className="text-fg-muted" />
      )}
      <ClockCounterClockwise size={11} className="text-fg-muted" />
      <span className="font-mono text-[10.5px] font-normal tracking-[0.08em] text-fg-subtle uppercase">
        Recent commits
      </span>
    </Button>
  );
}
