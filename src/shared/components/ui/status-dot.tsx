import { cn } from "@/shared/lib/utils";

export type AgentState = "needs-you" | "working" | "done" | "idle";

export const AGENT_STATE_LABELS: Record<AgentState, string> = {
  "needs-you": "Needs you",
  working: "Working",
  done: "Done",
  idle: "Idle",
};

const STATE_CLASSES: Record<AgentState, string> = {
  "needs-you": "bg-state-needs-you motion-safe:animate-pulse",
  working: "border-[1.5px] border-state-working border-t-transparent motion-safe:animate-spin",
  done: "bg-state-done",
  idle: "border-[1.5px] border-state-idle",
};

interface StatusDotProps {
  state: AgentState;
  /** Hides the dot from screen readers when a parent already names the state. */
  decorative?: boolean;
  className?: string;
}

/** The agent state as a dot: pulsing orange, spinner, green or hollow; motion stops with reduced motion. */
export function StatusDot({ state, decorative = false, className }: StatusDotProps) {
  return (
    <span
      data-slot="status-dot"
      data-state={state}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : AGENT_STATE_LABELS[state]}
      aria-hidden={decorative ? true : undefined}
      className={cn("inline-block size-2 shrink-0 rounded-full", STATE_CLASSES[state], className)}
    />
  );
}
