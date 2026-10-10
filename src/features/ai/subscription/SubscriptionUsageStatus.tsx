"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/lib/utils";
import { useAIStore } from "@/shared/stores/ai";

import { refreshSubscriptionUsage, selectProviderUsage, useSubscriptionUsageStore } from "./store";
import {
  currentWindows,
  formatPercent,
  formatResetIn,
  formatUpdatedAgo,
  headlineWindow,
  usageLevel,
  type UsageLevel,
} from "./summary";

export const USAGE_LEVEL_TEXT: Record<UsageLevel, string> = {
  normal: "",
  high: "text-status-warning",
  critical: "text-status-error",
};

function UsageChip({ providerId, name }: { providerId: string; name: string }) {
  const state = useSubscriptionUsageStore((store) => selectProviderUsage(store, providerId));
  const now = Date.now();
  const headline = headlineWindow(state.usage, now);
  const windows = currentWindows(state.usage, now);
  const error = state.refreshError ?? state.readError;

  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        delay={200}
        disabled={state.refreshing}
        onClick={() => void refreshSubscriptionUsage(providerId)}
        aria-label={
          headline
            ? `${name} plan usage ${formatPercent(headline.usedPercent)}, refresh`
            : `Load ${name} plan usage`
        }
        className={cn(
          "flex h-5 items-center gap-1.5 rounded-full px-2 text-ui-2xs text-fg-subtle tabular-nums transition-colors hover:bg-bg-hover hover:text-fg-default",
          state.refreshing && "animate-pulse",
        )}
      >
        <span>{name}</span>
        {headline && (
          <span className={USAGE_LEVEL_TEXT[usageLevel(headline.usedPercent)]}>
            {formatPercent(headline.usedPercent)}
          </span>
        )}
      </TooltipTrigger>
      <TooltipContent side="top" className="min-w-56 flex-col items-start gap-0.5 py-1.5">
        <span className="font-medium">{name} plan usage</span>
        {windows.map((window) => (
          <div key={window.id} className="flex w-full items-center justify-between gap-4">
            <span className="text-fg-muted">{window.label}</span>
            <span className="tabular-nums">
              {[formatPercent(window.usedPercent), formatResetIn(window.resetsAtMs, now)]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
        ))}
        {windows.length === 0 && !error && (
          <span className="text-fg-muted">No current usage reported.</span>
        )}
        {error && <span className="text-status-error">{error}</span>}
        <span className="pt-0.5 text-ui-2xs text-fg-subtle">
          {state.refreshing
            ? "Refreshing..."
            : `${formatUpdatedAgo(state.usage?.fetchedAtMs ?? null, now)}. Click to refresh.`}
        </span>
      </TooltipContent>
    </Tooltip>
  );
}

/// The short form of each installed CLI's plan usage, for the status bar.
export function SubscriptionUsageStatus({ providerIds }: { providerIds: string[] }) {
  const manifests = useAIStore((state) => state.cliManifests);
  return (
    <>
      {providerIds.map((providerId) => (
        <UsageChip
          key={providerId}
          providerId={providerId}
          name={manifests.find((manifest) => manifest.id === providerId)?.name ?? providerId}
        />
      ))}
    </>
  );
}
