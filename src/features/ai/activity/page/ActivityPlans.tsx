import { useMemo } from "react";
import { ArrowClockwise } from "@phosphor-icons/react";

import { AgentMark } from "@/shared/components/ui/agent-mark";
import { IconButton } from "@/shared/components/ui/icon-button";
import { cn } from "@/shared/lib/utils";
import { useAIStore } from "@/shared/stores/ai";
import { accountLabel, useCliAccountsStore } from "@/shared/stores/ai/cliAccounts";
import { useSettingsStore } from "@/shared/stores/settings";

import {
  supportsSubscriptionUsage,
  useSubscriptionUsageProviders,
} from "../../subscription/providers";
import {
  refreshSubscriptionUsage,
  selectProviderUsage,
  useSubscriptionUsageStore,
} from "../../subscription/store";
import {
  combineByProvider,
  currentWindows,
  formatPercent,
  formatResetIn,
  usageLevel,
  type ProviderSessions,
  type UsageLevel,
} from "../../subscription/summary";
import { usageTargets, type UsageTarget } from "../../subscription/targets";
import { formatTokens } from "../../usage/formatTokens";
import { formatStateDuration, type DashboardItem } from "../dashboard";
import { filledCells, mostRoomKey, PLAN_CELLS } from "./activityModel";

const LEVEL_CELL: Record<UsageLevel, string> = {
  normal: "bg-fg-muted",
  high: "bg-status-warning",
  critical: "bg-status-error",
};

const LEVEL_TEXT: Record<UsageLevel, string> = {
  normal: "text-fg-default",
  high: "text-status-warning",
  critical: "text-status-error",
};

const WINDOW_NAMES: Record<string, string> = {
  five_hour: "session",
  seven_day: "week",
  seven_day_opus: "week opus",
  seven_day_sonnet: "week sonnet",
};

function targetKey(target: Pick<UsageTarget, "providerId" | "configDir">): string {
  return `${target.providerId}:${target.configDir ?? ""}`;
}

function sessionsLine(sessions: ProviderSessions | undefined): string {
  if (!sessions) return "no sessions";
  const parts = [sessions.sessions === 1 ? "1 session" : `${sessions.sessions} sessions`];
  if (sessions.working > 0) parts.push(`${sessions.working} working`);
  if (sessions.unreported < sessions.sessions)
    parts.push(`${formatTokens(sessions.tokens)} tokens`);
  return parts.join(" · ");
}

interface PlanCardProps {
  target: UsageTarget;
  name: string;
  account: string | null;
  best: boolean;
  sessions: ProviderSessions | undefined;
  now: number;
}

function PlanCard({ target, name, account, best, sessions, now }: PlanCardProps) {
  const { providerId, configDir } = target;
  const supported = supportsSubscriptionUsage(providerId);
  const state = useSubscriptionUsageStore((store) =>
    selectProviderUsage(store, providerId, configDir),
  );
  const windows = currentWindows(state.usage, now);
  const error = state.refreshError ?? state.readError;
  const fetchedAt = state.usage?.fetchedAtMs ?? null;

  return (
    <article
      aria-label={account ? `${name} ${account}` : name}
      className={cn(
        "flex min-w-0 flex-col gap-2.5 rounded-lg bg-bg-sheet px-4 py-3.5 ring-1 ring-inset",
        best ? "ring-state-done/35" : "ring-border-subtle",
      )}
    >
      <div className="flex min-w-0 items-center gap-2 font-mono text-ui-xs">
        <AgentMark agentId={providerId} name={name} size="sm" />
        <span className="shrink-0 font-medium text-fg-default">{name}</span>
        {account && <span className="min-w-0 truncate text-fg-subtle">{account}</span>}
        <span className="flex-1" />
        {best && <span className="shrink-0 text-ui-2xs text-state-done">most room</span>}
        {supported && (
          <>
            <span className="shrink-0 text-ui-2xs text-fg-subtle">
              {fetchedAt === null ? "not loaded" : `${formatStateDuration(now - fetchedAt)} ago`}
            </span>
            <IconButton
              icon={ArrowClockwise}
              label={`Refresh ${account ? `${name} ${account}` : name} plan usage`}
              size="sm"
              disabled={state.refreshing}
              onClick={() => void refreshSubscriptionUsage(providerId, configDir)}
              className={cn("-my-1 size-6", state.refreshing && "animate-spin")}
            />
          </>
        )}
      </div>
      {supported && windows.length > 0 ? (
        <div className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-2 font-mono text-ui-2xs">
          {windows.map((window) => {
            const level = usageLevel(window.usedPercent);
            const filled = filledCells(window.usedPercent);
            return (
              <div key={window.id} className="contents">
                <span className="truncate text-fg-muted">
                  {WINDOW_NAMES[window.id] ?? window.label}
                </span>
                <span
                  role="meter"
                  aria-label={`${WINDOW_NAMES[window.id] ?? window.label} used`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(window.usedPercent)}
                  className="flex gap-0.5"
                >
                  {Array.from({ length: PLAN_CELLS }, (_, index) => (
                    <span
                      key={index}
                      className={cn(
                        "h-2.25 flex-1",
                        index < filled ? LEVEL_CELL[level] : "bg-fg-default/8",
                      )}
                    />
                  ))}
                </span>
                <span className="text-right whitespace-nowrap text-fg-subtle">
                  <span className={cn("font-medium", LEVEL_TEXT[level])}>
                    {formatPercent(window.usedPercent)}
                  </span>
                  {window.resetsAtMs !== null &&
                    ` · ${formatResetIn(window.resetsAtMs, now)?.replace("resets in ", "resets ") ?? ""}`}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="flex min-h-10 items-center font-mono text-ui-2xs text-fg-subtle">
          {!supported ? "this CLI reports no plan usage" : error ? error : "no usage reported yet"}
        </p>
      )}
      <div className="border-t border-border-subtle pt-2.25 font-mono text-ui-2xs text-fg-subtle">
        {sessionsLine(sessions)}
      </div>
    </article>
  );
}

/// The plan of each CLI account, with the one that has the most room left marked.
export function ActivityPlans({ items, now }: { items: DashboardItem[]; now: number }) {
  const manifests = useAIStore((state) => state.cliManifests);
  const installed = useSubscriptionUsageProviders();
  const accounts = useCliAccountsStore((state) => state.accounts);
  const names = useSettingsStore((state) => state.ai.cliAccounts.names);
  const usage = useSubscriptionUsageStore((state) => state.byProvider);
  // Shells and other sessions without a coding CLI run on no plan.
  const combined = useMemo(
    () =>
      combineByProvider(items).filter((sessions) =>
        manifests.some((manifest) => manifest.id === sessions.providerId),
      ),
    [items, manifests],
  );

  const targets = usageTargets(
    [...new Set([...installed, ...combined.map((sessions) => sessions.providerId)])],
    accounts,
  );
  for (const sessions of combined) {
    if (
      !targets.some(
        (target) =>
          targetKey(target) === targetKey({ ...sessions, configDir: sessions.accountDir }),
      )
    ) {
      targets.push({
        providerId: sessions.providerId,
        configDir: sessions.accountDir,
        account: null,
      });
    }
  }
  const best = mostRoomKey(
    targets.map((target) => ({
      key: targetKey(target),
      windows: currentWindows(
        selectProviderUsage({ byProvider: usage }, target.providerId, target.configDir).usage,
        now,
      ),
    })),
  );
  const bestTarget = targets.find((target) => targetKey(target) === best);
  const bestName = bestTarget?.account ? accountLabel(bestTarget.account, names) : null;

  if (targets.length === 0) return null;

  return (
    <section aria-label="Plans" className="flex flex-col gap-2.5">
      <div className="flex items-baseline gap-3 font-mono text-ui-2xs text-fg-subtle">
        <h2 className="text-ui-2xs font-medium text-fg-muted">plans</h2>
        {bestName && <span>{bestName} has the most room left; start new tasks there</span>}
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3">
        {targets.map((target) => (
          <PlanCard
            key={targetKey(target)}
            target={target}
            name={
              manifests.find((manifest) => manifest.id === target.providerId)?.name ??
              target.providerId
            }
            account={target.account ? accountLabel(target.account, names) : null}
            best={targetKey(target) === best}
            sessions={combined.find(
              (sessions) =>
                sessions.providerId === target.providerId &&
                sessions.accountDir === target.configDir,
            )}
            now={now}
          />
        ))}
      </div>
    </section>
  );
}
