import { cn } from "@/shared/lib/utils";

import { ciLabel, type CiState } from "./status";
import { useAgentCiStore } from "./store";

const STATE_CLASSES: Record<CiState, string> = {
  failing: "bg-accent-subtle text-state-needs-you ring-state-needs-you/40",
  pending: "text-state-working ring-state-working/40",
  passing: "text-state-done ring-border-subtle",
};

/** The pull request of the pane's worktree and how its CI stands. */
export function CiBadge({
  environmentId,
  className,
}: {
  environmentId: string | undefined;
  className?: string;
}) {
  const ci = useAgentCiStore((state) =>
    environmentId ? state.byEnvironment[environmentId] : undefined,
  );
  if (!ci) return null;
  const status = ci.status;
  const detail = status
    ? `${status.total - status.pending - status.failing.length} passed, ${status.failing.length} failed, ${status.pending} running`
    : "no checks yet";

  return (
    <span
      className={cn(
        "flex shrink-0 items-center gap-1.5 font-mono text-ui-2xs whitespace-nowrap",
        className,
      )}
      title={`Pull request #${ci.number}: ${detail}`}
    >
      <span className="text-fg-subtle">PR #{ci.number}</span>
      {status && (
        <span className={cn("rounded-[4px] px-1.5 ring-1 ring-inset", STATE_CLASSES[status.state])}>
          {ciLabel(status)}
        </span>
      )}
    </span>
  );
}
