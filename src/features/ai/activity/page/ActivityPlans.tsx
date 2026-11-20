import { useMemo, useState } from "react";
import { ArrowClockwise, CaretRight } from "@phosphor-icons/react";

import { AgentMark } from "@/shared/components/ui/agent-mark";
import { Button } from "@/shared/components/ui/button";
import { IconButton } from "@/shared/components/ui/icon-button";
import { cn } from "@/shared/lib/utils";
import { useAIStore } from "@/shared/stores/ai";
import { accountLabel, useCliAccountsStore, type CliAccount } from "@/shared/stores/ai/cliAccounts";
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
  sessionCliProvider,
  usageLevel,
  type ProviderSessions,
  type UsageLevel,
} from "../../subscription/summary";
import { usageTargets, type UsageTarget } from "../../subscription/targets";
import { formatTokens } from "../../usage/formatTokens";
import { DASHBOARD_STATE_LABELS, formatStateDuration, type DashboardItem } from "../dashboard";
import { filledCells, formatMoment, mostRoomKey, PLAN_CELLS } from "./activityModel";

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

function homePath(path: string): string {
  return path.replace(/^\/(Users|home)\/[^/]+/, "~");
}

interface PlanCardProps {
  target: UsageTarget;
  name: string;
  account: string | null;
  best: boolean;
  sessions: ProviderSessions | undefined;
  items: DashboardItem[];
  now: number;
  expanded: boolean;
  onToggle: () => void;
}

/// The exact reset times, where the account lives and the sessions running on it.
function PlanDetails({
  account,
  configDir,
  windows,
  fetchedAt,
  items,
  now,
}: {
  now: number;
  account: CliAccount | null;
  configDir: string | null;
  windows: ReturnType<typeof currentWindows>;
  fetchedAt: number | null;
  items: DashboardItem[];
}) {
  return (
    <dl className="grid grid-cols-[72px_minmax(0,1fr)] gap-x-2.5 gap-y-1.25 border-t border-border-subtle pt-2.25 font-mono text-ui-2xs">
      {windows.map((window) => (
        <div key={window.id} className="contents">
          <dt className="text-fg-subtle">{WINDOW_NAMES[window.id] ?? window.label}</dt>
          <dd className="text-fg-default">
            {Math.round(window.usedPercent)}% used
            {window.resetsAtMs !== null && ` · resets ${formatMoment(window.resetsAtMs, now)}`}
          </dd>
        </div>
      ))}
      <dt className="text-fg-subtle">fetched</dt>
      <dd className="text-fg-default">
        {fetchedAt === null ? "not yet" : formatMoment(fetchedAt, now)}
      </dd>
      {account?.email && (
        <>
          <dt className="text-fg-subtle">account</dt>
          <dd className="truncate text-fg-default">{account.email}</dd>
        </>
      )}
      <dt className="text-fg-subtle">folder</dt>
      <dd className="truncate text-fg-default" title={configDir ?? undefined}>
        {configDir ? homePath(configDir) : "default"}
      </dd>
      <dt className="text-fg-subtle">sessions</dt>
      <dd className="flex min-w-0 flex-col gap-0.5 text-fg-default">
        {items.length === 0
          ? "none"
          : items.map((item) => (
              <span key={item.session.id} className="truncate">
                <span className="text-fg-subtle">
                  {DASHBOARD_STATE_LABELS[item.state].toLowerCase()}
                </span>{" "}
                {item.session.title}
              </span>
            ))}
      </dd>
    </dl>
  );
}

function PlanCard({
  target,
  name,
  account,
  best,
  sessions,
  items,
  now,
  expanded,
  onToggle,
}: PlanCardProps) {
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
        <Button
          variant="ghost"
          aria-expanded={expanded}
          onClick={onToggle}
          title={expanded ? "Hide details" : "Show details"}
          className="-mx-1.5 -my-1 h-7 min-w-0 flex-1 justify-start gap-2 px-1.5 font-mono font-normal"
        >
          <AgentMark agentId={providerId} name={name} size="sm" />
          <span className="shrink-0 font-medium text-fg-default">{name}</span>
          {account && <span className="min-w-0 truncate text-fg-subtle">{account}</span>}
          <CaretRight
            size={10}
            aria-hidden="true"
            className={cn(
              "shrink-0 text-fg-subtle transition-transform duration-(--motion-fast)",
              expanded && "rotate-90",
            )}
          />
        </Button>
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
      {expanded && (
        <PlanDetails
          account={target.account}
          configDir={configDir}
          windows={windows}
          fetchedAt={fetchedAt}
          items={items}
          now={now}
        />
      )}
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
  const [expanded, setExpanded] = useState<string | null>(null);
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
      <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] items-start gap-3">
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
            items={items.filter(
              (item) =>
                sessionCliProvider(item.session) === target.providerId &&
                (item.session.cliAccountDir ?? null) === target.configDir,
            )}
            now={now}
            expanded={expanded === targetKey(target)}
            onToggle={() =>
              setExpanded((current) => (current === targetKey(target) ? null : targetKey(target)))
            }
          />
        ))}
      </div>
    </section>
  );
}
