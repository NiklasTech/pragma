import { useEffect } from "react";

import { useAIStore } from "@/shared/stores/ai";

import { SUBSCRIPTION_USAGE_PROVIDERS } from "./providers";
import {
  readSubscriptionUsage,
  refreshSubscriptionUsage,
  selectProviderUsage,
  useSubscriptionUsageStore,
} from "./store";
import { isStale, STALE_AFTER_MS } from "./summary";

const READ_INTERVAL_MS = 60_000;

async function pollProvider(providerId: string): Promise<void> {
  const usage = await readSubscriptionUsage(providerId);
  const now = Date.now();
  const { refreshedAt } = selectProviderUsage(useSubscriptionUsageStore.getState(), providerId);
  if (!isStale(usage, now)) return;
  if (refreshedAt !== null && now - refreshedAt < STALE_AFTER_MS) return;
  await refreshSubscriptionUsage(providerId);
}

/// Reads the cached plan usage of installed CLIs every minute while the window is visible,
/// and lets the CLI fetch fresh values at most every 15 minutes.
export function useSubscriptionUsagePoller(): void {
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "hidden") return;
      const statuses = useAIStore.getState().cliStatuses;
      for (const providerId of SUBSCRIPTION_USAGE_PROVIDERS) {
        if (statuses[providerId]?.installed) void pollProvider(providerId);
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") tick();
    };

    const interval = window.setInterval(tick, READ_INTERVAL_MS);
    document.addEventListener("visibilitychange", handleVisibility);
    const unsubscribe = useAIStore.subscribe((state, previous) => {
      if (state.cliStatuses !== previous.cliStatuses) tick();
    });
    tick();

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
      unsubscribe();
    };
  }, []);
}
