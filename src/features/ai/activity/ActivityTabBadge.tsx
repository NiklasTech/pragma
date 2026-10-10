"use client";

import { cn } from "@/shared/lib/utils";

import type { DashboardState } from "./dashboard";
import { useActivityStore } from "./store";

function useStateCount(state: DashboardState): number {
  return useActivityStore(
    (store) => Object.values(store.entries).filter((entry) => entry.state === state).length,
  );
}

/// Sessions that work or wait for the user; turns to the warning color while any waits.
export function ActivityTabBadge() {
  const working = useStateCount("working");
  const waiting = useStateCount("waiting");
  const count = working + waiting;
  if (count === 0) return null;

  const label = `${working} working, ${waiting} waiting for you`;
  return (
    <span
      title={label}
      aria-label={label}
      className={cn(
        "rounded-full px-1.5 text-ui-2xs font-medium tabular-nums",
        waiting > 0 ? "bg-status-warning/12 text-status-warning" : "bg-primary/12 text-primary",
      )}
    >
      {count}
    </span>
  );
}
