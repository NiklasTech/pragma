import { Minus, Plus } from "@phosphor-icons/react";

import { IconButton } from "@/shared/components/ui/icon-button";
import { cn } from "@/shared/lib/utils";

import { MAX_PANES } from "../panes/operations";

/// How many of one agent a start opens, each in its own pane.
export function AgentCountStepper({
  count,
  onChange,
  label,
  max = MAX_PANES,
  removable = false,
}: {
  count: number;
  onChange: (count: number) => void;
  /** The agent the count belongs to, for screen readers. */
  label: string;
  /** The most this agent may have, after the others of the start. */
  max?: number;
  /** Lets the minus take the agent out of the start at one. */
  removable?: boolean;
}) {
  const several = count > 1;
  return (
    <div
      role="group"
      aria-label={`How many ${label}`}
      className={cn(
        "flex h-7 items-center rounded-[6px] ring-1 ring-inset transition-colors duration-(--motion-fast)",
        several ? "bg-primary/8 ring-primary/35" : "ring-border-subtle",
      )}
    >
      <IconButton
        type="button"
        icon={Minus}
        size="sm"
        label={count <= 1 && removable ? `Remove ${label}` : `One ${label} fewer`}
        disabled={count <= 1 && !removable}
        onClick={() => onChange(count - 1)}
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
        label={`One ${label} more`}
        disabled={count >= max}
        onClick={() => onChange(count + 1)}
      />
    </div>
  );
}
