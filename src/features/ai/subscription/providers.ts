import { useMemo } from "react";

import { useAIStore } from "@/shared/stores/ai";

/// CLIs whose plan usage can be read without touching a running session or the CLI's credentials.
/// Claude Code caches it in its config and `claude -p /usage` refreshes that cache; the other
/// CLIs are not verified yet and show as not available.
export const SUBSCRIPTION_USAGE_PROVIDERS: readonly string[] = ["anthropic-claude"];

export function supportsSubscriptionUsage(cliProviderId: string): boolean {
  return SUBSCRIPTION_USAGE_PROVIDERS.includes(cliProviderId);
}

/// Supported CLIs that are installed on this machine.
export function useSubscriptionUsageProviders(): string[] {
  const statuses = useAIStore((state) => state.cliStatuses);
  return useMemo(
    () => SUBSCRIPTION_USAGE_PROVIDERS.filter((id) => statuses[id]?.installed === true),
    [statuses],
  );
}
