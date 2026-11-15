import { useMemo } from "react";

import { focusAttentionSession } from "@/features/ai/notifications/focusSession";
import { summarizeAgentStates, useAgentStatesStore } from "@/features/ai/state/agentStates";
import { Button } from "@/shared/components/ui/button";
import { StatusDot, type AgentState } from "@/shared/components/ui/status-dot";
import { cn } from "@/shared/lib/utils";

/// How the agents are doing at a glance; a click shows the session that needs you first.
export function StatusPill() {
  const entries = useAgentStatesStore((store) => store.entries);
  const { needsYou, working, done, first } = useMemo(
    () => summarizeAgentStates(entries),
    [entries],
  );
  const target = first;

  const state: AgentState =
    needsYou.length > 0
      ? "needs-you"
      : working.length > 0
        ? "working"
        : done.length > 0
          ? "done"
          : "idle";
  const parts = [
    needsYou.length > 0 && `${needsYou.length} ${needsYou.length === 1 ? "needs" : "need"} you`,
    working.length > 0 && `${working.length} working`,
    needsYou.length === 0 && done.length > 0 && `${done.length} done`,
  ].filter((part): part is string => Boolean(part));
  const label = parts.length > 0 ? parts.join(" · ") : "All quiet";

  return (
    <Button
      variant="ghost"
      disabled={!target}
      onClick={() => target && focusAttentionSession(target)}
      title={target ? "Show the session that needs you first" : "No agent is running"}
      className="rounded-full bg-bg-well pr-3 pl-2.5 text-ui-xs font-normal ring-1 ring-border ring-inset hover:bg-bg-well hover:ring-fg-subtle disabled:pointer-events-auto disabled:cursor-default disabled:opacity-100 disabled:hover:ring-border"
    >
      <StatusDot state={state} decorative />
      <span className="flex items-center gap-1.5">
        {parts.length > 0 ? (
          parts.map((part, index) => (
            <span
              key={part}
              className={cn(
                index === 0 && state === "needs-you" && "font-medium text-state-needs-you",
                index > 0 && "text-fg-subtle",
              )}
            >
              {index > 0 && "· "}
              {part}
            </span>
          ))
        ) : (
          <span>{label}</span>
        )}
      </span>
    </Button>
  );
}
