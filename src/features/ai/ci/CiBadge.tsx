import { Button } from "@/shared/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { cn } from "@/shared/lib/utils";
import { useSettingsStore } from "@/shared/stores/settings";

import { CiHistory } from "./CiHistory";
import { ciLabel, type CiState } from "./status";
import { useAgentCiStore } from "./store";

const STATE_CLASSES: Record<CiState | "fixing", string> = {
  failing: "bg-accent-subtle text-state-needs-you ring-state-needs-you/40",
  pending: "text-state-working ring-state-working/40",
  passing: "text-state-done ring-border-subtle",
  fixing: "text-state-working ring-state-working/40",
};

/** The pull request of the pane's worktree and how its CI stands; a click shows what happened. */
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
  const fixes = useAgentCiStore((state) =>
    environmentId ? state.fixes[environmentId] : undefined,
  );
  const asking = useAgentCiStore((state) =>
    environmentId ? state.asking[environmentId] : undefined,
  );
  const tries = useSettingsStore((state) => state.agent.ciFixTries);
  if (!ci || !environmentId) return null;
  const status = ci.status;
  const detail = status
    ? `${status.total - status.pending - status.failing.length} passed, ${status.failing.length} failed, ${status.pending} running`
    : "no checks yet";
  // Between a fix Pragma sent and the next result, the badge counts the tries.
  const fixCount = fixes?.number === ci.number ? fixes.count : 0;
  const fixing =
    fixCount > 0 &&
    !fixes?.stopped &&
    fixCount <= tries &&
    status !== null &&
    status.state !== "passing" &&
    asking !== status.failureKey;
  const look = fixing ? "fixing" : status?.state;
  const label = fixing ? `CI fix ${fixCount} of ${tries}` : status ? ciLabel(status) : null;

  return (
    <Popover>
      <PopoverTrigger
        data-pane-actions=""
        render={
          <Button
            variant="ghost"
            size="xs"
            className={cn("gap-1.5 px-1 font-normal hover:bg-bg-hover", className)}
            title={`Pull request #${ci.number}: ${detail}`}
          >
            <span className="text-fg-subtle">PR #{ci.number}</span>
            {look && label && (
              <span className={cn("rounded-[4px] px-1.5 ring-1 ring-inset", STATE_CLASSES[look])}>
                {label}
              </span>
            )}
          </Button>
        }
      />
      <PopoverContent align="start" className="w-80">
        <CiHistory environmentId={environmentId} ci={ci} fixing={fixing} tries={tries} />
      </PopoverContent>
    </Popover>
  );
}
