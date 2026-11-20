import type { ChatSession } from "@/shared/stores/ai";

import { formatStateDuration, type DashboardItem } from "../activity/dashboard";
import type { SubscriptionUsage, UsageWindow } from "./types";

/// Cached usage older than this makes the poller ask the CLI for fresh values.
export const STALE_AFTER_MS = 15 * 60_000;

/// Windows whose period has not ended; after a reset the cached percentage no longer applies.
export function currentWindows(usage: SubscriptionUsage | null, now: number): UsageWindow[] {
  return (
    usage?.windows.filter((window) => window.resetsAtMs === null || window.resetsAtMs > now) ?? []
  );
}

export function isStale(
  usage: SubscriptionUsage | null,
  now: number,
  staleAfterMs: number = STALE_AFTER_MS,
): boolean {
  if (!usage || usage.fetchedAtMs === null) return true;
  if (now - usage.fetchedAtMs >= staleAfterMs) return true;
  return currentWindows(usage, now).length < usage.windows.length;
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

export function formatResetIn(resetsAtMs: number | null, now: number): string | null {
  return resetsAtMs === null ? null : `resets in ${formatStateDuration(resetsAtMs - now)}`;
}

export function formatUpdatedAgo(fetchedAtMs: number | null, now: number): string {
  return fetchedAtMs === null
    ? "Not loaded yet"
    : `Updated ${formatStateDuration(now - fetchedAtMs)} ago`;
}

export type UsageLevel = "normal" | "high" | "critical";

export function usageLevel(usedPercent: number): UsageLevel {
  if (usedPercent >= 90) return "critical";
  if (usedPercent >= 75) return "high";
  return "normal";
}

export function sessionCliProvider(
  session: Pick<ChatSession, "cliProviderId" | "agentEngine">,
): string | null {
  if (session.cliProviderId) return session.cliProviderId;
  return session.agentEngine?.kind === "cli" ? (session.agentEngine.cliProviderId ?? null) : null;
}

/// Tokens a session used, or null when its engine reported none, as a CLI in a raw terminal.
export function sessionTokens(session: Pick<ChatSession, "usage">): number | null {
  const usage = session.usage;
  if (!usage || usage.responses === 0) return null;
  return usage.inputTokens + usage.outputTokens;
}

export interface ProviderSessions {
  providerId: string;
  /** The account folder the sessions run with; null is the CLI's default account. */
  accountDir: string | null;
  sessions: number;
  working: number;
  /** Tokens of the sessions that report them, added up. */
  tokens: number;
  /** Sessions whose engine reports no token counts. */
  unreported: number;
}

/// Live CLI sessions combined per provider, in order of first appearance.
export function combineByProvider(
  items: ReadonlyArray<Pick<DashboardItem, "session" | "state">>,
): ProviderSessions[] {
  const byProvider = new Map<string, ProviderSessions>();
  for (const { session, state } of items) {
    const providerId = sessionCliProvider(session);
    if (!providerId) continue;
    const accountDir = session.cliAccountDir ?? null;
    const key = `${providerId}:${accountDir ?? ""}`;
    const entry = byProvider.get(key) ?? {
      providerId,
      accountDir,
      sessions: 0,
      working: 0,
      tokens: 0,
      unreported: 0,
    };
    entry.sessions += 1;
    if (state === "working") entry.working += 1;
    const tokens = sessionTokens(session);
    if (tokens === null) entry.unreported += 1;
    else entry.tokens += tokens;
    byProvider.set(key, entry);
  }
  return [...byProvider.values()];
}
