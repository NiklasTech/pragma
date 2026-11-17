import { useMemo } from "react";

import { summarizeAgentStates, useAgentStatesStore } from "@/features/ai/state/agentStates";
import { Button } from "@/shared/components/ui/button";
import type { AgentState } from "@/shared/components/ui/status-dot";
import { cn } from "@/shared/lib/utils";
import { useOverlayStore } from "@/shared/stores/overlays";

const MAX_CELLS = 8;

const CELL_CLASSES: Record<AgentState, string> = {
  "needs-you": "bg-state-needs-you shadow-[0_0_6px_var(--color-accent-glow)]",
  working: "bg-state-working",
  done: "bg-state-done",
  idle: "bg-fg-default/15",
};

/// How the agents are doing at a glance: one cell per agent; a click opens the overview of every agent.
export function StatusPill() {
  const entries = useAgentStatesStore((store) => store.entries);
  const summary = useMemo(() => summarizeAgentStates(entries), [entries]);
  const { needsYou, working, done, first } = summary;
  const cells = useMemo(
    (): AgentState[] =>
      [
        ...needsYou.map((): AgentState => "needs-you"),
        ...working.map((): AgentState => "working"),
        ...done.map((): AgentState => "done"),
      ].slice(0, MAX_CELLS),
    [needsYou, working, done],
  );
  const openOverlay = useOverlayStore((state) => state.open);

  const parts = [
    needsYou.length > 0 && `${needsYou.length} ${needsYou.length === 1 ? "needs" : "need"} you`,
    working.length > 0 && `${working.length} working`,
    done.length > 0 && `${done.length} done`,
  ].filter((part): part is string => Boolean(part));

  return (
    <Button
      variant="ghost"
      onClick={() => openOverlay("overview")}
      title={first ? "Show every agent" : "No agent is running"}
      className="h-6.5 gap-2.25 rounded-[5px] px-2.5 text-ui-2xs font-normal text-fg-subtle ring-1 ring-fg-default/15 ring-inset hover:bg-transparent hover:text-fg-muted hover:ring-fg-default/35"
    >
      <span className="flex items-center gap-[3px]" aria-hidden="true">
        {cells.length > 0 ? (
          cells.map((state, index) => (
            <span
              key={`${state}-${index}`}
              className={cn(
                "size-[7px] rounded-[1.5px] animate-in duration-200 zoom-in-50 fade-in-0 motion-reduce:animate-none",
                CELL_CLASSES[state],
              )}
            />
          ))
        ) : (
          <span className={cn("size-[7px] rounded-[1.5px]", CELL_CLASSES.idle)} />
        )}
      </span>
      <span className="flex items-center gap-1.5">
        {parts.length > 0 ? (
          parts.map((part, index) => (
            <span
              key={part}
              className={cn(
                index === 0 && needsYou.length > 0 && "font-medium text-state-needs-you",
              )}
            >
              {index > 0 && "· "}
              {part}
            </span>
          ))
        ) : (
          <span>all quiet</span>
        )}
      </span>
    </Button>
  );
}
