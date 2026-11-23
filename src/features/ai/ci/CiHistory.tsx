import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";

import { openCheckLog } from "./failureActions";
import { stopFixing } from "./reaction";
import { useAgentCiStore, type AgentCi, type CiEventKind } from "./store";

const CELL_CLASSES: Record<CiEventKind, string> = {
  fail: "bg-state-needs-you",
  pass: "bg-state-done",
  run: "bg-state-working",
  sent: "bg-state-working",
};

const TEXT_CLASSES: Record<CiEventKind, string> = {
  fail: "text-state-needs-you",
  pass: "text-fg-muted",
  run: "text-state-working",
  sent: "text-fg-muted",
};

function clock(at: number): string {
  return new Date(at).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** What CI did on the pull request, and the way out of the fixes Pragma sends on its own. */
export function CiHistory({
  environmentId,
  ci,
  fixing,
  tries,
}: {
  environmentId: string;
  ci: AgentCi;
  fixing: boolean;
  tries: number;
}) {
  const events = useAgentCiStore((state) => state.history[environmentId]);

  return (
    <div className="flex flex-col gap-3 font-mono text-ui-xs">
      <span className="text-fg-subtle">CI on #{ci.number}</span>
      {events && events.length > 0 ? (
        <ol className="flex flex-col gap-1.5">
          {events.map((event) => (
            <li key={`${event.at}-${event.text}`} className="flex items-baseline gap-2">
              <span className="shrink-0 text-fg-subtle tabular-nums">{clock(event.at)}</span>
              <span
                className={cn("size-[7px] shrink-0 -translate-y-px", CELL_CLASSES[event.kind])}
                aria-hidden="true"
              />
              <span className={TEXT_CLASSES[event.kind]}>{event.text}</span>
            </li>
          ))}
        </ol>
      ) : (
        <span className="text-fg-muted">Nothing happened since Pragma started.</span>
      )}
      <div className="flex flex-col gap-2 border-t border-border-subtle pt-3">
        {fixing && (
          <span className="text-fg-subtle">after {tries} tries it stops and asks you</span>
        )}
        <div className="flex gap-1.5">
          {fixing && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => stopFixing(environmentId, ci.number)}
            >
              Stop fixing
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => openCheckLog(ci.url)}>
            Open PR
          </Button>
        </div>
      </div>
    </div>
  );
}
