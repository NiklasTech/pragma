"use client";

import { useMemo } from "react";
import { ArrowClockwise } from "@phosphor-icons/react";

import { Button } from "@/shared/components/ui/button";
import { Progress } from "@/shared/components/ui/progress";
import { cn } from "@/shared/lib/utils";
import { useAIStore } from "@/shared/stores/ai";

import type { DashboardItem } from "../activity/dashboard";
import { ProviderLogo } from "../panes/ProviderLogo";
import { formatTokens } from "../usage/formatTokens";
import { supportsSubscriptionUsage, useSubscriptionUsageProviders } from "./providers";
import { refreshSubscriptionUsage, selectProviderUsage, useSubscriptionUsageStore } from "./store";
import {
  combineByProvider,
  currentWindows,
  formatPercent,
  formatResetIn,
  formatUpdatedAgo,
  usageLevel,
  type ProviderSessions,
  type UsageLevel,
} from "./summary";
import { USAGE_LEVEL_TEXT } from "./SubscriptionUsageStatus";

const LEVEL_BAR: Record<UsageLevel, string> = {
  normal: "",
  high: "[&_[data-slot=progress-indicator]]:bg-status-warning",
  critical: "[&_[data-slot=progress-indicator]]:bg-status-error",
};

function sessionsSummary(sessions: ProviderSessions): string {
  const parts = [
    sessions.sessions === 1 ? "1 session" : `${sessions.sessions} sessions`,
    `${sessions.working} working`,
  ];
  if (sessions.unreported < sessions.sessions) {
    parts.push(
      `${formatTokens(sessions.tokens)} tokens ${sessions.sessions > 1 ? "together" : "used"}`,
    );
  }
  return parts.join(" · ");
}

interface ProviderUsageCardProps {
  providerId: string;
  name: string;
  sessions: ProviderSessions | undefined;
  now: number;
}

function ProviderUsageCard({ providerId, name, sessions, now }: ProviderUsageCardProps) {
  const supported = supportsSubscriptionUsage(providerId);
  const state = useSubscriptionUsageStore((store) => selectProviderUsage(store, providerId));
  const windows = currentWindows(state.usage, now);
  const error = state.refreshError ?? state.readError;

  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-bg-root px-2.5 py-2 ring-1 ring-border-subtle">
      <div className="flex min-w-0 items-center gap-2">
        <ProviderLogo providerId={providerId} name={name} size={13} />
        <span className="truncate text-ui-sm font-medium text-fg-default">{name}</span>
        {supported && (
          <span className="ml-auto flex shrink-0 items-center gap-1">
            <span className="text-ui-2xs text-fg-subtle">
              {formatUpdatedAgo(state.usage?.fetchedAtMs ?? null, now)}
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              disabled={state.refreshing}
              onClick={() => void refreshSubscriptionUsage(providerId)}
              aria-label={`Refresh ${name} plan usage`}
            >
              <ArrowClockwise size={12} className={cn(state.refreshing && "animate-spin")} />
            </Button>
          </span>
        )}
      </div>

      {supported ? (
        windows.map((window) => {
          const level = usageLevel(window.usedPercent);
          const resetIn = formatResetIn(window.resetsAtMs, now);
          return (
            <div key={window.id} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2 text-ui-2xs">
                <span className="text-fg-muted">{window.label}</span>
                <span className="text-fg-subtle tabular-nums">
                  <span className={cn("font-medium text-fg-default", USAGE_LEVEL_TEXT[level])}>
                    {formatPercent(window.usedPercent)}
                  </span>
                  {resetIn && ` · ${resetIn}`}
                </span>
              </div>
              <Progress value={Math.min(window.usedPercent, 100)} className={LEVEL_BAR[level]} />
            </div>
          );
        })
      ) : (
        <span className="text-ui-2xs text-fg-subtle">
          Plan usage is not available for this CLI.
        </span>
      )}
      {supported && windows.length === 0 && !error && (
        <span className="text-ui-2xs text-fg-subtle">No current usage reported.</span>
      )}
      {error && <span className="text-ui-2xs text-status-error">{error}</span>}

      {sessions && (
        <div className="flex flex-col gap-0.5 border-t border-border-subtle pt-1.5 text-ui-2xs text-fg-subtle">
          <span>{sessionsSummary(sessions)}</span>
          {sessions.unreported > 0 && (
            <span>
              {sessions.unreported === 1
                ? "1 session reports no token counts, for example a CLI in a terminal."
                : `${sessions.unreported} sessions report no token counts, for example CLIs in a terminal.`}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

interface ProviderUsageSectionProps {
  items: DashboardItem[];
  now: number;
}

/// Plan usage per CLI next to the live sessions that consume it.
export function ProviderUsageSection({ items, now }: ProviderUsageSectionProps) {
  const manifests = useAIStore((state) => state.cliManifests);
  const installed = useSubscriptionUsageProviders();
  const combined = useMemo(() => combineByProvider(items), [items]);
  const providerIds = [
    ...new Set([...installed, ...combined.map((sessions) => sessions.providerId)]),
  ];

  if (providerIds.length === 0) return null;

  return (
    <section aria-label="Plan usage" className="flex flex-col gap-1.5">
      <h3 className="px-2 text-ui-2xs font-semibold tracking-wide text-fg-subtle uppercase">
        Plan usage
      </h3>
      {providerIds.map((providerId) => (
        <ProviderUsageCard
          key={providerId}
          providerId={providerId}
          name={manifests.find((manifest) => manifest.id === providerId)?.name ?? providerId}
          sessions={combined.find((sessions) => sessions.providerId === providerId)}
          now={now}
        />
      ))}
    </section>
  );
}
