import { useEffect } from "react";

import { useAIStore } from "@/shared/stores/ai";
import { useCliAccountsStore } from "@/shared/stores/ai/cliAccounts";

import { SUBSCRIPTION_USAGE_PROVIDERS } from "./providers";
import {
  readSubscriptionUsage,
  refreshSubscriptionUsage,
  selectProviderUsage,
  useSubscriptionUsageStore,
} from "./store";
import { isStale, STALE_AFTER_MS } from "./summary";
import { usageTargets, type UsageTarget } from "./targets";

const READ_INTERVAL_MS = 60_000;

async function pollTarget({ providerId, configDir }: UsageTarget): Promise<void> {
  const usage = await readSubscriptionUsage(providerId, configDir);
  const now = Date.now();
  const state = useSubscriptionUsageStore.getState();
  const { refreshedAt } = selectProviderUsage(state, providerId, configDir);
  if (!isStale(usage, now)) return;
  if (refreshedAt !== null && now - refreshedAt < STALE_AFTER_MS) return;
  await refreshSubscriptionUsage(providerId, configDir);
}

/// Reads the cached plan usage of installed CLIs every minute while the window is visible,
/// and lets the CLI fetch fresh values at most every 15 minutes.
export function useSubscriptionUsagePoller(): void {
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "hidden") return;
      const statuses = useAIStore.getState().cliStatuses;
      const installed = SUBSCRIPTION_USAGE_PROVIDERS.filter((id) => statuses[id]?.installed);
      const { accounts } = useCliAccountsStore.getState();
      for (const target of usageTargets(installed, accounts)) void pollTarget(target);
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") tick();
    };

    const interval = window.setInterval(tick, READ_INTERVAL_MS);
    document.addEventListener("visibilitychange", handleVisibility);
    const unsubscribe = useAIStore.subscribe((state, previous) => {
      if (state.cliStatuses !== previous.cliStatuses) tick();
    });
    const unsubscribeAccounts = useCliAccountsStore.subscribe((state, previous) => {
      if (state.accounts !== previous.accounts) tick();
    });
    tick();

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
      unsubscribe();
      unsubscribeAccounts();
    };
  }, []);
}
