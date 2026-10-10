"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FolderSimple, Pulse } from "@phosphor-icons/react";

import { PanelEmptyState } from "@/shared/components/PanelEmptyState";
import { cn } from "@/shared/lib/utils";
import { useAIStore } from "@/shared/stores/ai";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";

import { focusAttentionSession } from "../notifications/focusSession";
import { collectLeaves } from "../panes/layout";
import { selectFocusedSessionId, selectRoot, useAgentsPanesStore } from "../panes/store";
import { getTerminalEntryStatus } from "../terminal/runner";
import { ActivityRow } from "./ActivityRow";
import {
  countStates,
  DASHBOARD_STATE_LABELS,
  engineLabel,
  groupByCategory,
  type DashboardItem,
  type DashboardState,
} from "./dashboard";
import { clearOutcome, useActivityStore } from "./store";

const SUMMARY_STATES: DashboardState[] = ["waiting", "working", "failed", "finished", "idle"];

const SUMMARY_TEXT: Record<DashboardState, string> = {
  waiting: "bg-status-warning/12 text-status-warning",
  working: "bg-primary/12 text-primary",
  failed: "bg-status-error/12 text-status-error",
  finished: "bg-status-success/12 text-status-success",
  idle: "bg-bg-hover text-fg-muted",
};

/// Re-renders every second so the time in each state stays current.
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

export function ActivityDashboard() {
  const rootPath = useFileExplorerStore((state) => state.rootPath) ?? "default";
  const chatSessions = useAIStore((state) => state.chatSessions);
  const manifests = useAIStore((state) => state.cliManifests);
  const activeProvider = useAIStore((state) => state.activeProvider);
  const activeModel = useAIStore((state) => state.activeModel);
  const entries = useActivityStore((state) => state.entries);
  const root = useAgentsPanesStore((state) => selectRoot(state, rootPath));
  const focusedSessionId = useAgentsPanesStore((state) => selectFocusedSessionId(state, rootPath));
  const now = useNow();

  const openIds = useMemo(() => new Set(collectLeaves(root).map((leaf) => leaf.sessionId)), [root]);

  // `now` re-reads the terminal statuses, which live outside React.
  const items = useMemo(() => {
    const listed: DashboardItem[] = [];
    for (const session of chatSessions) {
      const entry = entries[session.id];
      if (session.archived || !entry) continue;
      const liveTerminal =
        session.kind === "terminal" && getTerminalEntryStatus(session.id) === "running";
      if (entry.state === "idle" && !openIds.has(session.id) && !liveTerminal) continue;
      listed.push({ session, state: entry.state, since: entry.since });
    }
    return listed;
  }, [chatSessions, entries, openIds, now]);

  const groups = useMemo(() => groupByCategory(items), [items]);
  const counts = useMemo(() => countStates(items), [items]);

  const handleSelect = useCallback((sessionId: string) => {
    clearOutcome(sessionId);
    focusAttentionSession(sessionId);
  }, []);

  if (items.length === 0) {
    return (
      <PanelEmptyState
        icon={Pulse}
        title="No live sessions"
        description="Open or running sessions show their activity here."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3 p-2">
      <div className="flex flex-wrap items-center gap-1 px-1" aria-label="Session states">
        {SUMMARY_STATES.filter((state) => counts[state] > 0).map((state) => (
          <span
            key={state}
            className={cn(
              "rounded-full px-2 py-0.5 text-ui-2xs font-medium tabular-nums",
              SUMMARY_TEXT[state],
            )}
          >
            {counts[state]} {DASHBOARD_STATE_LABELS[state].toLowerCase()}
          </span>
        ))}
      </div>

      {groups.map((group) => (
        <section
          key={group.category ?? ""}
          aria-label={group.category ?? "No category"}
          className="flex flex-col gap-0.5"
        >
          <h3 className="flex items-center gap-1 px-2 pb-0.5 text-ui-2xs font-semibold tracking-wide text-fg-subtle uppercase">
            {group.category && (
              <FolderSimple size={11} weight="fill" className="shrink-0 text-primary/70" />
            )}
            <span className="truncate">{group.category ?? "No category"}</span>
          </h3>
          {group.items.map((item) => (
            <ActivityRow
              key={item.session.id}
              session={item.session}
              state={item.state}
              since={item.since}
              now={now}
              engine={engineLabel(item.session, manifests, {
                provider: activeProvider,
                model: activeModel,
              })}
              rootPath={rootPath}
              focused={item.session.id === focusedSessionId}
              onSelect={handleSelect}
            />
          ))}
        </section>
      ))}
    </div>
  );
}
