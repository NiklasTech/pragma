import { useEffect } from "react";

import { useAIStore } from "@/shared/stores/ai";
import { useCliAccountsStore } from "@/shared/stores/ai/cliAccounts";
import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";
import { activeTab } from "@/shared/stores/spaces/model";

import { useActivityStore } from "../activity/store";
import { SUBSCRIPTION_USAGE_PROVIDERS, supportsSubscriptionUsage } from "./providers";
import {
  readSubscriptionUsage,
  refreshSubscriptionUsage,
  selectProviderUsage,
  useSubscriptionUsageStore,
} from "./store";
import { isStale, sessionCliProvider, STALE_AFTER_MS } from "./summary";
import { usageTargets, type UsageTarget } from "./targets";

/** The read is a file check that parses only after the CLI wrote, so it can run often. */
const READ_INTERVAL_MS = 3_000;
/** While the activity tab shows the plans, the CLI fetches fresh values this often. */
const WATCHED_STALE_AFTER_MS = 2 * 60_000;
/** After an agent's turn its account is fetched again, but not more often than this. */
const TURN_END_MIN_GAP_MS = 60_000;

type Target = Pick<UsageTarget, "providerId" | "configDir">;

function activityTabShown(): boolean {
  if (document.visibilityState === "hidden") return false;
  const { spaces, activeSpaceId } = useOpenRepositoriesStore.getState();
  const space = spaces.find((candidate) => candidate.id === activeSpaceId);
  return space ? activeTab(space)?.kind === "activity" : false;
}

/** Asks the CLI for fresh values once the cached ones are older than the gap. */
async function pollTarget({ providerId, configDir }: Target, gapMs: number): Promise<void> {
  const usage = await readSubscriptionUsage(providerId, configDir);
  const now = Date.now();
  const state = useSubscriptionUsageStore.getState();
  const { refreshedAt } = selectProviderUsage(state, providerId, configDir);
  if (!isStale(usage, now, gapMs)) return;
  if (refreshedAt !== null && now - refreshedAt < gapMs) return;
  await refreshSubscriptionUsage(providerId, configDir);
}

function installedTargets(): UsageTarget[] {
  const statuses = useAIStore.getState().cliStatuses;
  const installed = SUBSCRIPTION_USAGE_PROVIDERS.filter((id) => statuses[id]?.installed);
  return usageTargets(installed, useCliAccountsStore.getState().accounts);
}

/// Keeps plan usage close to live: reads the CLI's cache every few seconds, lets the CLI fetch
/// fresh values every 15 minutes, every 2 while the activity tab is open, and after an agent's turn.
export function useSubscriptionUsagePoller(): void {
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "hidden") return;
      const gap = activityTabShown() ? WATCHED_STALE_AFTER_MS : STALE_AFTER_MS;
      for (const target of installedTargets()) void pollTarget(target, gap);
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") tick();
    };

    const interval = window.setInterval(tick, READ_INTERVAL_MS);
    document.addEventListener("visibilitychange", handleVisibility);
    const unsubscribes = [
      useAIStore.subscribe((state, previous) => {
        if (state.cliStatuses !== previous.cliStatuses) tick();
      }),
      useCliAccountsStore.subscribe((state, previous) => {
        if (state.accounts !== previous.accounts) tick();
      }),
      useOpenRepositoriesStore.subscribe(() => {
        if (activityTabShown()) tick();
      }),
      // A turn that ended used the plan; its account is fetched again.
      useActivityStore.subscribe((state, previous) => {
        const sessions = useAIStore.getState().chatSessions;
        for (const [sessionId, before] of Object.entries(previous.entries)) {
          if (before.state !== "working" || state.entries[sessionId]?.state === "working") continue;
          const session = sessions.find((item) => item.id === sessionId);
          const providerId = session ? sessionCliProvider(session) : null;
          if (!session || !providerId || !supportsSubscriptionUsage(providerId)) continue;
          void pollTarget(
            { providerId, configDir: session.cliAccountDir ?? null },
            TURN_END_MIN_GAP_MS,
          );
        }
      }),
    ];
    tick();

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
      for (const unsubscribe of unsubscribes) unsubscribe();
    };
  }, []);
}
