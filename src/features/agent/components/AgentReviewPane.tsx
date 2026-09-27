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
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { cn } from "@/shared/lib/utils";

import { useAgentStore, type AgentStatus, type AgentStep } from "../store";
import { AgentRulesStatus } from "./AgentRulesStatus";
import { AgentTodoList } from "./AgentTodoList";

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
      return <Spinner size={12} className="animate-spin text-primary" />;
    case "done":
      return <Check size={11} weight="bold" className="text-status-success" />;
    case "error":
      return <Warning size={11} weight="bold" className="text-status-error" />;
    case "denied":
      return <Prohibit size={11} weight="bold" className="text-status-warning" />;
  }
}

function StepRow({ step, isLast }: { step: AgentStep; isLast: boolean }) {
  return (
    <div className="relative flex items-start gap-3 px-3 pb-3">
      {!isLast && (
        <span aria-hidden="true" className="absolute top-6 bottom-0 left-[23px] w-px bg-border" />
      )}
      <span className="relative flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-bg-surface">
        <StepIcon status={step.status} />
      </span>
      <div className="flex min-w-0 flex-col pt-0.5">
        <span className="text-ui-xs font-medium text-fg-default">{step.label}</span>
        {step.detail && (
          <span className="truncate font-mono text-ui-2xs text-fg-subtle" title={step.detail}>
            {step.detail}
          </span>
        )}
      </div>
    </div>
  );
}

export function AgentReviewPane() {
  const { status, goal, steps, stepCount, summary, error, requestStop } = useAgentStore();

  const canStop = status === "running" || status === "waiting-approval";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {status === "idle" ? (
        <PanelEmptyState
          icon={MagicWand}
          title="No active run"
          description="Start a thread to see steps, todos and approvals here."
        />
      ) : (
        <>
          <div className="m-2 flex shrink-0 flex-col gap-2 rounded-xl border border-border-subtle bg-bg-surface p-3">
            <div className="flex items-center justify-between gap-2">
              <span
                className={cn(
                  "flex items-center gap-1.5 text-ui-xs font-medium",
                  STATUS_COLORS[status],
                )}
              >
                {status === "running" && <Spinner size={12} className="animate-spin" />}
                {status === "waiting-approval" && <CircleDashed size={12} />}
                {STATUS_LABELS[status]}
                {stepCount > 0 && (
                  <span className="font-normal text-fg-subtle">
                    {stepCount === 1 ? "· 1 step" : `· ${stepCount} steps`}
                  </span>
                )}
              </span>
              {canStop && (
                <button
                  type="button"
                  onClick={requestStop}
                  title="Stop agent"
                  aria-label="Stop agent"
                  className="flex h-6 items-center gap-1.5 rounded-full px-2.5 text-ui-xs font-medium text-fg-muted transition-colors hover:bg-status-error/10 hover:text-status-error"
                >
                  <Stop size={11} weight="fill" />
                  Stop
                </button>
              )}
            </div>
            {goal && (
              <p className="line-clamp-3 text-ui-xs break-words text-fg-muted" title={goal}>
                {goal}
              </p>
            )}
          </div>

          <AgentRulesStatus />

          <ScrollArea className="min-h-0 flex-1">
            <div className="flex flex-col pt-1">
              <AgentTodoList />
              {steps.length > 0 && (
                <div className="px-3 pt-2 pb-2 text-ui-2xs font-semibold tracking-wider text-fg-subtle uppercase">
                  Steps
                </div>
              )}
              {steps.map((step, index) => (
                <StepRow key={step.id} step={step} isLast={index === steps.length - 1} />
              ))}
              {status === "waiting-approval" && (
                <div className="mx-3 mb-2 flex items-center gap-2 rounded-lg bg-status-warning/10 px-2.5 py-1.5 text-ui-xs text-status-warning">
                  <CircleDashed size={13} className="shrink-0" />
                  Waiting for your review
                </div>
              )}
            </div>
          </ScrollArea>

          {(summary || error) && (
            <div className="shrink-0 border-t border-border-subtle px-3 py-2.5">
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
