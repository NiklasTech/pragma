import { currentWindows } from "./summary";
import type { SubscriptionUsage, UsageWindow } from "./types";

/** The default share of a usage window from which panes show how close their account is. */
export const NEAR_LIMIT_PERCENT = 90;

const SHORT_WINDOW_NAMES: Record<string, string> = {
  five_hour: "5h",
  seven_day: "week",
  seven_day_opus: "opus",
  seven_day_sonnet: "sonnet",
};

/** The fullest window that has not reset yet, or null when the plan reports none. */
export function fullestWindow(usage: SubscriptionUsage | null, now: number): UsageWindow | null {
  let fullest: UsageWindow | null = null;
  for (const window of currentWindows(usage, now)) {
    if (!fullest || window.usedPercent > fullest.usedPercent) fullest = window;
  }
  return fullest;
}

/** The window an account is about to run out of, or null while it has room. */
export function nearLimitWindow(
  usage: SubscriptionUsage | null,
  now: number,
  threshold: number = NEAR_LIMIT_PERCENT,
): UsageWindow | null {
  const fullest = fullestWindow(usage, now);
  return fullest && fullest.usedPercent >= threshold ? fullest : null;
}

export function shortWindowName(window: UsageWindow): string {
  return SHORT_WINDOW_NAMES[window.id] ?? window.label;
}
