import { useEffect, useState } from "react";

import { cn } from "@/shared/lib/utils";
import type { ChatSession } from "@/shared/stores/ai";

import { filledCells } from "../activity/page/activityModel";
import { nearLimitWindow, shortWindowName } from "./nearLimit";
import { selectProviderUsage, useSubscriptionUsageStore } from "./store";
import { formatPercent, formatResetIn, sessionCliProvider } from "./summary";

const CELLS = 10;
const TICK_MS = 30_000;

/** How full the account of a pane's agent is, once it nears its limit. */
export function PaneUsageMeter({
  session,
  className,
}: {
  session: ChatSession | undefined;
  className?: string;
}) {
  const providerId = session ? sessionCliProvider(session) : null;
  const usage = useSubscriptionUsageStore((store) =>
    providerId
      ? selectProviderUsage(store, providerId, session?.cliAccountDir ?? null).usage
      : null,
  );
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const full = nearLimitWindow(usage, now);
  if (!full) return null;
  const name = shortWindowName(full);
  const filled = filledCells(full.usedPercent, CELLS);
  const reset = formatResetIn(full.resetsAtMs, now);

  return (
    <span
      className={cn(
        "flex shrink-0 items-center gap-1.5 font-mono text-ui-2xs whitespace-nowrap",
        className,
      )}
      title={`${full.label}: ${formatPercent(full.usedPercent)} used${reset ? `, ${reset}` : ""}`}
    >
      <span className="text-fg-muted">{name}</span>
      <span
        role="meter"
        aria-label={`${full.label} used`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(full.usedPercent)}
        className="flex gap-0.5"
      >
        {Array.from({ length: CELLS }, (_, index) => (
          <span
            key={index}
            className={cn(
              "h-2.5 w-[5px]",
              index < filled ? "bg-state-needs-you" : "bg-fg-default/12",
            )}
          />
        ))}
      </span>
      <span className="text-state-needs-you">{formatPercent(full.usedPercent)}</span>
    </span>
  );
}
