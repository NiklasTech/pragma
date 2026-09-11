import { Check, CircleDashed, Prohibit, Spinner, Stop, Warning } from "@phosphor-icons/react";

import { AgentTodoList } from "@/features/agent/components/AgentTodoList";
import { useAgentStore, type AgentStatus } from "@/features/agent/store";
import { cn } from "@/shared/lib/utils";

const STATUS_LABELS: Record<AgentStatus, string> = {
  idle: "Idle",
  running: "Running",
  "waiting-approval": "Waiting for approval",
  done: "Done",
  error: "Error",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<AgentStatus, string> = {
  idle: "text-fg-muted",
  running: "text-status-success",
  "waiting-approval": "text-status-warning",
  done: "text-status-success",
  error: "text-status-error",
  cancelled: "text-fg-muted",
};

function StatusIcon({ status }: { status: AgentStatus }) {
  const className = cn("shrink-0", STATUS_COLORS[status]);
  switch (status) {
    case "running":
      return <Spinner size={12} className={cn(className, "animate-spin")} />;
    case "waiting-approval":
      return <CircleDashed size={12} className={className} />;
    case "done":
      return <Check size={12} weight="bold" className={className} />;
    case "error":
      return <Warning size={12} weight="bold" className={className} />;
    case "cancelled":
      return <Prohibit size={12} weight="bold" className={className} />;
    case "idle":
      return null;
  }
}

export function AgentRunBar() {
  const status = useAgentStore((state) => state.status);
  const stepCount = useAgentStore((state) => state.stepCount);
  const maxSteps = useAgentStore((state) => state.maxSteps);
  const editReviews = useAgentStore((state) => state.editReviews);
  const requestStop = useAgentStore((state) => state.requestStop);

  if (status === "idle") return null;

  const canStop = status === "running" || status === "waiting-approval";

  return (
    <div className="mb-2 flex flex-col overflow-hidden rounded-lg border border-border bg-bg-surface">
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <StatusIcon status={status} />
        <span className={cn("text-ui-xs font-medium", STATUS_COLORS[status])}>
          {STATUS_LABELS[status]}
        </span>
        <span className="text-ui-xs text-fg-subtle">
          Step {stepCount} of {maxSteps}
        </span>
        {canStop && (
          <button
            type="button"
            onClick={requestStop}
            aria-label="Stop agent"
            title="Stop agent"
            className="ml-auto flex size-5 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-bg-hover hover:text-status-error"
          >
            <Stop size={12} weight="bold" />
          </button>
        )}
      </div>

      <AgentTodoList />

      {status === "waiting-approval" && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-ui-xs text-status-warning">
          <CircleDashed size={12} className="shrink-0" />
          {editReviews.length > 0 ? "Waiting for review in the editor" : "Waiting for approval"}
        </div>
      )}
    </div>
  );
}
