import { Minus, Plus } from "@phosphor-icons/react";

import { IconButton } from "@/shared/components/ui/icon-button";
import { cn } from "@/shared/lib/utils";

import { MAX_PANES } from "../panes/operations";

/** Keeps a count of agents between one and the panes a tab holds. */
export function clampAgentCount(count: number): number {
  return Math.min(Math.max(Math.round(count), 1), MAX_PANES);
}

/// How many of the picked agent a start opens, each in its own pane.
export function AgentCountStepper({
  count,
  onChange,
}: {
  count: number;
  onChange: (count: number) => void;
}) {
  const several = count > 1;
  return (
    <div
      role="group"
      aria-label="How many agents"
      className={cn(
        "flex h-7 items-center rounded-[6px] ring-1 ring-inset transition-colors duration-(--motion-fast)",
        several ? "bg-primary/8 ring-primary/35" : "ring-border-subtle",
      )}
    >
      <IconButton
        type="button"
        icon={Minus}
        size="sm"
        label="One agent fewer"
        disabled={count <= 1}
        onClick={() => onChange(clampAgentCount(count - 1))}
      />
      <span
        aria-live="polite"
        className={cn(
          "min-w-7 text-center font-mono text-ui-xs tabular-nums",
          several ? "font-semibold text-primary" : "text-fg-muted",
        )}
      >
        ×{count}
      </span>
      <IconButton
        type="button"
        icon={Plus}
        size="sm"
        label="One agent more"
        disabled={count >= MAX_PANES}
        onClick={() => onChange(clampAgentCount(count + 1))}
      />
    </div>
  );
}
