import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";

import { accountKey } from "@/shared/stores/ai/cliAccounts";

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
  /** By account key: one plan per account of a CLI. */
  byProvider: Readonly<Record<string, ProviderUsageState>>;
}

export const useSubscriptionUsageStore = create<SubscriptionUsageStore>()(() => ({
  byProvider: {},
}));

export function selectProviderUsage(
  state: SubscriptionUsageStore,
  providerId: string,
  configDir: string | null = null,
): ProviderUsageState {
  return state.byProvider[accountKey(providerId, configDir)] ?? EMPTY_STATE;
}

function patch(
  providerId: string,
  configDir: string | null,
  next: Partial<ProviderUsageState>,
): void {
  const { byProvider } = useSubscriptionUsageStore.getState();
  const current = selectProviderUsage({ byProvider }, providerId, configDir);
  useSubscriptionUsageStore.setState({
    byProvider: { ...byProvider, [accountKey(providerId, configDir)]: { ...current, ...next } },
  });
}

function errorText(error: unknown): string {
  if (typeof error === "string") return error;
  return error instanceof Error ? error.message : "Could not load the usage";
}

/// Reads what the CLI last cached. A file read only, so it is cheap to repeat.
export async function readSubscriptionUsage(
  providerId: string,
  configDir: string | null = null,
): Promise<SubscriptionUsage | null> {
  try {
    const usage = await invoke<SubscriptionUsage>("subscription_usage_read", {
      providerId,
      configDir,
    });
    patch(providerId, configDir, { usage, readError: null });
    return usage;
  } catch (error) {
    patch(providerId, configDir, { readError: errorText(error) });
    return null;
  }
}

/// Lets the CLI fetch fresh usage in its own process; never writes into a running session.
export async function refreshSubscriptionUsage(
  providerId: string,
  configDir: string | null = null,
): Promise<void> {
  const state = useSubscriptionUsageStore.getState();
  if (selectProviderUsage(state, providerId, configDir).refreshing) return;
  patch(providerId, configDir, { refreshing: true, refreshedAt: Date.now() });
  try {
    const usage = await invoke<SubscriptionUsage>("subscription_usage_refresh", {
      providerId,
      configDir,
    });
    patch(providerId, configDir, { usage, readError: null, refreshError: null });
  } catch (error) {
    patch(providerId, configDir, { refreshError: errorText(error) });
  } finally {
    patch(providerId, configDir, { refreshing: false });
  }
}
