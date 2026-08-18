import {
  Check,
  CircleDashed,
  MagicWand,
  Prohibit,
  Spinner,
  Stop,
  Warning,
} from "@phosphor-icons/react";

import { PanelEmptyState } from "@/shared/components/PanelEmptyState";
import { PanelHeader } from "@/shared/components/PanelHeader";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { cn } from "@/shared/lib/utils";

import { useAgentStore, type AgentStatus, type AgentStep } from "../store";

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

function StepIcon({ status }: { status: AgentStep["status"] }) {
  switch (status) {
    case "running":
      return <Spinner size={13} className="shrink-0 animate-spin text-fg-muted" />;
    case "done":
      return <Check size={13} weight="bold" className="shrink-0 text-status-success" />;
    case "error":
      return <Warning size={13} weight="bold" className="shrink-0 text-status-error" />;
    case "denied":
      return <Prohibit size={13} weight="bold" className="shrink-0 text-status-warning" />;
  }
}

function StepRow({ step }: { step: AgentStep }) {
  return (
    <div className="flex items-start gap-2 px-3 py-1.5">
      <div className="mt-0.5">
        <StepIcon status={step.status} />
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="text-ui-xs font-medium text-fg-default">{step.label}</span>
        {step.detail && (
          <span className="truncate text-ui-xs text-fg-subtle" title={step.detail}>
            {step.detail}
          </span>
        )}
      </div>
    </div>
  );
}

export function AgentPanel() {
  const { status, goal, steps, stepCount, maxSteps, summary, error, requestStop } = useAgentStore();

  const canStop = status === "running" || status === "waiting-approval";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PanelHeader
        icon={MagicWand}
        title="Agent"
        subtitle={STATUS_LABELS[status]}
        actions={
          canStop ? (
            <button
              type="button"
              onClick={requestStop}
              title="Stop agent"
              className="flex size-6 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-bg-hover hover:text-status-error"
            >
              <Stop size={13} weight="bold" />
            </button>
          ) : undefined
        }
      />

      {status === "idle" ? (
        <PanelEmptyState
          icon={MagicWand}
          title="No active task"
          description="Enable Agent mode in the chat toolbar and send a task. The agent will plan, edit files and run commands autonomously."
        />
      ) : (
        <>
          <div className="flex shrink-0 flex-col gap-1 border-t border-border/40 px-3 py-2.5">
            <span className="text-ui-xs font-medium text-fg-default">Goal</span>
            <p className="line-clamp-3 text-ui-xs break-words text-fg-muted" title={goal}>
              {goal}
            </p>
            <span className="mt-1 text-ui-xs text-fg-subtle">
              Step {stepCount} of {maxSteps}
            </span>
            <span className={cn("text-ui-xs", STATUS_COLORS[status])}>{STATUS_LABELS[status]}</span>
          </div>

          <ScrollArea className="min-h-0 flex-1 border-t border-border/40">
            <div className="flex flex-col py-1">
              {steps.map((step) => (
                <StepRow key={step.id} step={step} />
              ))}
              {status === "waiting-approval" && (
                <div className="flex items-center gap-2 px-3 py-1.5 text-ui-xs text-status-warning">
                  <CircleDashed size={13} className="shrink-0" />
                  Waiting for approval in the chat panel
                </div>
              )}
            </div>
          </ScrollArea>

          {(summary || error) && (
            <div className="shrink-0 border-t border-border/40 px-3 py-2.5">
              <p
                className={cn(
                  "text-ui-xs break-words",
                  error ? "text-status-error" : "text-fg-muted",
                )}
              >
                {error ?? summary}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
