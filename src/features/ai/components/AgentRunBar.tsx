import { Check, CircleDashed, Prohibit, Stop, Warning } from "@phosphor-icons/react";

import { AgentTodoList } from "@/features/agent/components/AgentTodoList";
import { useAgentStore, type AgentStatus } from "@/features/agent/store";
import { cn } from "@/shared/lib/utils";

import { PulseDot } from "./PulseDot";
import { Shimmer } from "./Shimmer";
import { useElapsedSeconds } from "./useElapsedSeconds";

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

function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return minutes > 0 ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
}

function StatusIcon({ status }: { status: AgentStatus }) {
  const className = cn("shrink-0", STATUS_COLORS[status]);
  switch (status) {
    case "running":
      return <PulseDot className="size-3" />;
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
  const editReviews = useAgentStore((state) => state.editReviews);
  const requestStop = useAgentStore((state) => state.requestStop);
  const seconds = useElapsedSeconds(status === "running" || status === "waiting-approval");

  if (status === "idle") return null;

  const canStop = status === "running" || status === "waiting-approval";

  return (
    <div className="mb-2 flex animate-in flex-col overflow-hidden rounded-xl border border-border bg-bg-surface duration-200 fade-in-0 slide-in-from-bottom-2 motion-reduce:animate-none">
      <div className="flex h-9 items-center gap-2 pr-1.5 pl-3">
        <StatusIcon status={status} />
        {status === "running" ? (
          <Shimmer as="span" className="text-ui-xs font-medium" duration={1.8}>
            {STATUS_LABELS[status]}
          </Shimmer>
        ) : (
          <span className="text-ui-xs font-medium text-fg-default">{STATUS_LABELS[status]}</span>
        )}
        {stepCount > 0 && (
          <span className="text-ui-xs text-fg-subtle">
            {stepCount === 1 ? "1 step" : `${stepCount} steps`}
          </span>
        )}
        {seconds > 0 && canStop && (
          <span className="text-ui-xs text-fg-subtle tabular-nums">{formatElapsed(seconds)}</span>
        )}
        {canStop && (
          <button
            type="button"
            onClick={requestStop}
            aria-label="Stop agent"
            title="Stop agent"
            className="ml-auto flex h-6 items-center gap-1.5 rounded-full px-2.5 text-ui-xs font-medium text-fg-muted transition-colors outline-none hover:bg-status-error/10 hover:text-status-error focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <Stop size={11} weight="fill" />
            Stop
          </button>
        )}
      </div>

      <AgentTodoList />

      {status === "waiting-approval" && (
        <div className="flex items-center gap-1.5 border-t border-border-subtle bg-status-warning/5 px-3 py-2 text-ui-xs text-status-warning">
          <CircleDashed size={12} className="shrink-0" />
          {editReviews.length > 0 ? "Waiting for review in the editor" : "Waiting for approval"}
        </div>
      )}
    </div>
  );
}
