/** One plan limit window, as the CLI reports it. */
export interface UsageWindow {
  id: string;
  label: string;
  usedPercent: number;
  resetsAtMs: number | null;
}

/** Plan usage of one CLI subscription; one value per account, so it covers all its sessions. */
export interface SubscriptionUsage {
  providerId: string;
  windows: UsageWindow[];
  /** When the CLI fetched these values; null when it has none cached. */
  fetchedAtMs: number | null;
}
