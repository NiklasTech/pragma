import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";

import type { SubscriptionUsage } from "./types";

export interface ProviderUsageState {
  usage: SubscriptionUsage | null;
  readError: string | null;
  refreshError: string | null;
  refreshing: boolean;
  /** Last time Pragma asked the CLI to fetch fresh usage. */
  refreshedAt: number | null;
}

const EMPTY_STATE: ProviderUsageState = {
  usage: null,
  readError: null,
  refreshError: null,
  refreshing: false,
  refreshedAt: null,
};

interface SubscriptionUsageStore {
  byProvider: Readonly<Record<string, ProviderUsageState>>;
}

export const useSubscriptionUsageStore = create<SubscriptionUsageStore>()(() => ({
  byProvider: {},
}));

export function selectProviderUsage(
  state: SubscriptionUsageStore,
  providerId: string,
): ProviderUsageState {
  return state.byProvider[providerId] ?? EMPTY_STATE;
}

function patch(providerId: string, next: Partial<ProviderUsageState>): void {
  const { byProvider } = useSubscriptionUsageStore.getState();
  useSubscriptionUsageStore.setState({
    byProvider: {
      ...byProvider,
      [providerId]: { ...selectProviderUsage({ byProvider }, providerId), ...next },
    },
  });
}

function errorText(error: unknown): string {
  if (typeof error === "string") return error;
  return error instanceof Error ? error.message : "Could not load the usage";
}

/// Reads what the CLI last cached. A file read only, so it is cheap to repeat.
export async function readSubscriptionUsage(providerId: string): Promise<SubscriptionUsage | null> {
  try {
    const usage = await invoke<SubscriptionUsage>("subscription_usage_read", { providerId });
    patch(providerId, { usage, readError: null });
    return usage;
  } catch (error) {
    patch(providerId, { readError: errorText(error) });
    return null;
  }
}

/// Lets the CLI fetch fresh usage in its own process; never writes into a running session.
export async function refreshSubscriptionUsage(providerId: string): Promise<void> {
  if (selectProviderUsage(useSubscriptionUsageStore.getState(), providerId).refreshing) return;
  patch(providerId, { refreshing: true, refreshedAt: Date.now() });
  try {
    const usage = await invoke<SubscriptionUsage>("subscription_usage_refresh", { providerId });
    patch(providerId, { usage, readError: null, refreshError: null });
  } catch (error) {
    patch(providerId, { refreshError: errorText(error) });
  } finally {
    patch(providerId, { refreshing: false });
  }
}
