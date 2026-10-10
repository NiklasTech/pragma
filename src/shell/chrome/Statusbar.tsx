import {
  ArrowDown,
  ArrowUp,
  GitBranch,
  Warning,
  XCircle,
  Palette,
  Robot,
} from "@phosphor-icons/react";
import { useSettingsStore, type StatusbarItem } from "@/shared/stores/settings";
import { useGitStore } from "@/shared/stores/git";
import { currentModelName, useAcpSessionOptionsStore } from "@/features/ai/acp/sessionOptions";
import { useAIStore } from "@/shared/stores/ai";
import { useProblemsStore } from "@/shared/stores/problems";
import { useLayoutStore } from "@/shell/layout/store";
import { ExtensionStatusItems } from "@/features/extensions/components/ExtensionStatusItems";
import { useExtensionsStore } from "@/features/extensions/store";
import { formatActivitySummary } from "@/features/ai/notifications/activity";
import { focusAttentionSession } from "@/features/ai/notifications/focusSession";
import { useSessionActivity } from "@/features/ai/notifications/useSessionActivity";
import { useSubscriptionUsageProviders } from "@/features/ai/subscription/providers";
import { SubscriptionUsageStatus } from "@/features/ai/subscription/SubscriptionUsageStatus";
import { cn } from "@/shared/lib/utils";

const LEADING_ITEMS = new Set<StatusbarItem>(["gitBranch", "gitSync", "problems"]);

function StatusChip({
  children,
  onClick,
  label,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  label?: string;
}) {
  const classes = "flex h-5 items-center gap-1.5 rounded-full px-2 text-ui-2xs text-fg-subtle";

  if (!onClick) {
    return <div className={classes}>{children}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(classes, "transition-colors hover:bg-bg-hover hover:text-fg-default")}
    >
      {children}
    </button>
  );
}

/// Workspace-level status. Editor details (cursor, encoding, …) live in the editor card.
export function Statusbar() {
  const statusbar = useSettingsStore((state) => state.statusbar);
  const theme = useSettingsStore((state) => state.theme);
  const snapshot = useGitStore((state) => state.snapshot);
  const activeProvider = useAIStore((state) => state.activeProvider);
  const activeModel = useAIStore((state) => state.activeModel);
  const activeCLIProvider = useAIStore((state) => state.activeCLIProvider);
  const activeChatSessionId = useAIStore((state) => state.activeChatSessionId);
  const cliManifests = useAIStore((state) => state.cliManifests);
  const cliOptions = useAcpSessionOptionsStore((state) =>
    activeChatSessionId ? state.bySession[activeChatSessionId] : undefined,
  );
  const cliName = cliManifests.find((manifest) => manifest.id === activeCLIProvider)?.name;
  const aiLabel = cliName
    ? [cliName, cliOptions ? currentModelName(cliOptions) : null].filter(Boolean).join(" · ")
    : [activeProvider, activeModel].filter(Boolean).join(" · ");
  const problems = useProblemsStore((state) => state.problems);
  const extensionItemCount = useExtensionsStore((state) => state.statusBarItems.length);
  const showSessionSummary = useSettingsStore((state) => state.notifications.statusSummary);
  const activity = useSessionActivity();
  const usageProviders = useSubscriptionUsageProviders();

  if (!statusbar.visible) return null;

  const branch = snapshot?.repo.branch ?? null;
  const ahead = snapshot?.ahead ?? 0;
  const behind = snapshot?.behind ?? 0;

  const errorCount = problems.filter((p) => p.severity === "error").length;
  const warningCount = problems.filter((p) => p.severity === "warning").length;

  const renderItem = (item: StatusbarItem) => {
    switch (item) {
      case "gitBranch":
        if (!branch) return null;
        return (
          <StatusChip key={item}>
            <GitBranch size={12} />
            <span className="text-fg-muted">{branch}</span>
          </StatusChip>
        );

      case "gitSync":
        if (!branch || (ahead === 0 && behind === 0)) return null;
        return (
          <StatusChip key={item}>
            {ahead > 0 && (
              <span className="flex items-center gap-0.5">
                <ArrowUp size={10} weight="bold" />
                {ahead}
              </span>
            )}
            {behind > 0 && (
              <span className="flex items-center gap-0.5">
                <ArrowDown size={10} weight="bold" />
                {behind}
              </span>
            )}
          </StatusChip>
        );

      case "problems":
        if (errorCount === 0 && warningCount === 0) return null;
        return (
          <StatusChip
            key={item}
            label="Open problems panel"
            onClick={() => useLayoutStore.getState().addFloatingPanel("problems")}
          >
            {errorCount > 0 && (
              <>
                <XCircle size={12} className="text-status-error" />
                <span>{errorCount}</span>
              </>
            )}
            {warningCount > 0 && (
              <>
                <Warning size={12} className="text-status-warning" />
                <span>{warningCount}</span>
              </>
            )}
          </StatusChip>
        );

      case "aiProvider":
        return (
          <StatusChip key={item}>
            <span
              aria-hidden="true"
              className={cn(
                "size-1.5 rounded-full",
                activeProvider ? "bg-linear-to-r from-brand-from to-brand-to" : "bg-fg-subtle",
              )}
            />
            <span className="max-w-[160px] truncate">
              {activeProvider || cliName ? aiLabel : "No AI provider"}
            </span>
          </StatusChip>
        );

      case "subscriptionUsage":
        if (usageProviders.length === 0) return null;
        return <SubscriptionUsageStatus key={item} providerIds={usageProviders} />;

      case "theme":
        return (
          <StatusChip key={item}>
            <Palette size={12} />
            <span className="capitalize">{theme}</span>
          </StatusChip>
        );

      default:
        return null;
    }
  };

  const summaryTarget = activity.waiting[0] ?? activity.running[0];
  const sessionSummary =
    showSessionSummary && summaryTarget ? (
      <StatusChip
        key="sessions"
        label={
          activity.waiting.length > 0
            ? "Open the session waiting for approval"
            : "Open the running session"
        }
        onClick={() => focusAttentionSession(summaryTarget)}
      >
        <Robot size={12} className={cn(activity.waiting.length > 0 && "text-status-warning")} />
        <span>{formatActivitySummary(activity)}</span>
      </StatusChip>
    ) : null;

  const leading = statusbar.items.filter((item) => LEADING_ITEMS.has(item)).map(renderItem);
  const trailing = statusbar.items.filter((item) => !LEADING_ITEMS.has(item)).map(renderItem);

  if (
    !sessionSummary &&
    !leading.some(Boolean) &&
    !trailing.some(Boolean) &&
    extensionItemCount === 0
  ) {
    return null;
  }

  return (
    <div className="flex h-statusbar shrink-0 items-center justify-between gap-2 bg-bg-chrome px-2 select-none">
      <div className="flex min-w-0 items-center gap-0.5">
        {sessionSummary}
        {leading}
        <ExtensionStatusItems alignment="left" />
      </div>
      <div className="flex min-w-0 items-center gap-0.5">
        <ExtensionStatusItems alignment="right" />
        {trailing}
      </div>
    </div>
  );
}
