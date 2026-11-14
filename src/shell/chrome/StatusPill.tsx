import { focusAttentionSession } from "@/features/ai/notifications/focusSession";
import { useSessionActivity } from "@/features/ai/notifications/useSessionActivity";
import { StatusDot, type AgentState } from "@/shared/components/ui/status-dot";
import { cn } from "@/shared/lib/utils";

/// How the agents are doing at a glance; a click shows the session that needs you first.
export function StatusPill() {
  const { waiting, running } = useSessionActivity();
  const target = waiting[0] ?? running[0] ?? null;

  const state: AgentState =
    waiting.length > 0 ? "needs-you" : running.length > 0 ? "working" : "idle";
  const label =
    waiting.length > 0
      ? `${waiting.length} ${waiting.length === 1 ? "needs" : "need"} you`
      : running.length > 0
        ? `${running.length} working`
        : "All quiet";

  return (
    <button
      type="button"
      disabled={!target}
      onClick={() => target && focusAttentionSession(target)}
      title={target ? "Show the session that needs you first" : "No agent is running"}
      className="flex h-7.5 items-center gap-2 rounded-full bg-bg-well pr-3 pl-2.5 text-ui-xs text-fg-muted ring-1 ring-border ring-inset transition-shadow outline-none hover:ring-fg-subtle focus-visible:ring-2 focus-visible:ring-border-focus disabled:cursor-default disabled:hover:ring-border"
    >
      <StatusDot state={state} decorative />
      <span className={cn(state === "needs-you" && "font-medium text-state-needs-you")}>
        {label}
      </span>
    </button>
  );
}
