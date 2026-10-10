"use client";

import type { Icon } from "@phosphor-icons/react";
import { ChatCircle, FolderSimple, Robot, TerminalWindow } from "@phosphor-icons/react";

import { cn } from "@/shared/lib/utils";
import { getWorkspaceName } from "@/shared/lib/workspaceName";
import type { ChatSession } from "@/shared/stores/ai";

import { providerAccent } from "../panes/providerAccent";
import { ProviderLogo } from "../panes/ProviderLogo";
import { sessionCwd } from "../worktree/cwd";
import { DASHBOARD_STATE_LABELS, formatStateDuration, type DashboardState } from "./dashboard";

const KIND_ICONS: Record<NonNullable<ChatSession["kind"]>, Icon> = {
  ask: ChatCircle,
  agent: Robot,
  terminal: TerminalWindow,
};

const STATE_DOTS: Record<DashboardState, string> = {
  waiting: "bg-status-warning",
  working: "bg-linear-to-r from-brand-from to-brand-to animate-pulse",
  failed: "bg-status-error",
  finished: "bg-status-success",
  idle: "bg-fg-subtle",
};

const STATE_TEXT: Record<DashboardState, string> = {
  waiting: "text-status-warning",
  working: "text-primary",
  failed: "text-status-error",
  finished: "text-status-success",
  idle: "text-fg-subtle",
};

interface ActivityRowProps {
  session: ChatSession;
  state: DashboardState;
  since: number;
  now: number;
  engine: string;
  rootPath: string;
  focused: boolean;
  onSelect: (sessionId: string) => void;
}

export function ActivityRow({
  session,
  state,
  since,
  now,
  engine,
  rootPath,
  focused,
  onSelect,
}: ActivityRowProps) {
  const KindIcon = KIND_ICONS[session.kind ?? "agent"];
  const accent = providerAccent(session);
  const cwd = sessionCwd(session, rootPath);
  const folder = cwd === "default" ? null : getWorkspaceName(cwd);
  const label = DASHBOARD_STATE_LABELS[state];

  return (
    <button
      type="button"
      onClick={() => onSelect(session.id)}
      aria-current={focused ? "true" : undefined}
      data-activity-state={state}
      className={cn(
        "group flex w-full items-center gap-2.5 rounded-lg py-1.5 pr-2 pl-2 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
        focused
          ? "bg-bg-root shadow-[var(--shadow-sm)] ring-1 ring-border-subtle"
          : "hover:bg-bg-hover",
      )}
    >
      <span
        className={cn(
          "relative flex size-7 shrink-0 items-center justify-center rounded-md",
          accent.soft,
          accent.text,
        )}
      >
        {session.cliProviderId ? (
          <ProviderLogo providerId={session.cliProviderId} name={engine} size={14} />
        ) : (
          <KindIcon size={14} weight={focused ? "fill" : "regular"} />
        )}
        <span
          className={cn(
            "absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-bg-chrome",
            STATE_DOTS[state],
          )}
          aria-hidden="true"
        />
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "truncate text-ui-sm",
              focused ? "font-medium text-fg-default" : "text-fg-muted group-hover:text-fg-default",
            )}
            title={session.title}
          >
            {session.title}
          </span>
          <span
            className={cn("ml-auto shrink-0 text-ui-2xs tabular-nums", STATE_TEXT[state])}
            title={label}
          >
            {label} {formatStateDuration(now - since)}
          </span>
        </span>
        <span className="flex min-w-0 items-center gap-1.5 text-ui-2xs text-fg-subtle">
          <span className="truncate" title={engine}>
            {engine}
          </span>
          {folder && (
            <span className="flex min-w-0 shrink items-center gap-1" title={cwd}>
              <FolderSimple size={11} className="shrink-0" />
              <span className="truncate">{folder}</span>
            </span>
          )}
        </span>
      </span>
    </button>
  );
}
