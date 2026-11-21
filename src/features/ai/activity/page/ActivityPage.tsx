"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Kbd } from "@/shared/components/ui/kbd";
import { SegmentedControl } from "@/shared/components/ui/segmented-control";
import { formatShortcut, getIsMac } from "@/shared/lib/shortcuts";
import { cn } from "@/shared/lib/utils";
import { repositorySessions, useAIStore, type ChatSession } from "@/shared/stores/ai";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";
import { useOverlayStore } from "@/shared/stores/overlays";
import { useSettingsStore } from "@/shared/stores/settings";

import { getTerminalEntryStatus } from "../../terminal/runner";
import type { DashboardItem } from "../dashboard";
import { useActivityStore } from "../store";
import { ActivityPlans } from "./ActivityPlans";
import { activitySections, matchesFilter } from "./activityModel";
import { NeedsYouRow } from "./NeedsYouRow";
import { EarlierRow, RUNNING_COLUMNS, RunningRow } from "./SessionRows";

type Scope = "space" | "all";

/// Re-renders every second so the time in each state stays current.
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

function useItems(sessions: readonly ChatSession[]): DashboardItem[] {
  const entries = useActivityStore((state) => state.entries);
  return useMemo(
    () =>
      sessions.flatMap((session): DashboardItem[] => {
        const entry = entries[session.id];
        if (session.archived || !entry) return [];
        // A terminal that still runs counts as running even while it is quiet.
        const live =
          session.kind === "terminal" && getTerminalEntryStatus(session.id) === "running";
        const state = entry.state === "idle" && live ? "working" : entry.state;
        return [{ session, state, since: entry.since }];
      }),
    [sessions, entries],
  );
}

function Count({ cell, value, label }: { cell: string; value: number; label: string }) {
  if (value === 0) return null;
  return (
    <span className="flex items-center gap-1.75 text-fg-muted">
      <span aria-hidden="true" className={cn("size-2", cell)} />
      <span className="text-fg-default tabular-nums">{value}</span>
      {label}
    </span>
  );
}

/// Everything agents do: plans per account, questions to answer, running work and what ended today.
export function ActivityPage() {
  const rootPath = useFileExplorerStore((state) => state.rootPath) ?? "default";
  const chatSessions = useAIStore((state) => state.chatSessions);
  const openOverlay = useOverlayStore((state) => state.open);
  const activateTabKind = useOpenRepositoriesStore((state) => state.activateTabKind);
  const newShortcut = useSettingsStore((state) => state.shortcuts["session.quickStart"]);
  const [scope, setScope] = useState<Scope>("space");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const toggle = (sessionId: string) => () =>
    setExpanded((current) => (current === sessionId ? null : sessionId));
  const now = useNow();

  const spaceSessions = useMemo(
    () => repositorySessions(chatSessions, rootPath),
    [chatSessions, rootPath],
  );
  const spaceItems = useItems(spaceSessions);
  const allItems = useItems(chatSessions);
  const scoped = scope === "space" ? spaceItems : allItems;
  const items = useMemo(
    () =>
      scoped.filter((item) =>
        matchesFilter([item.session.title, item.session.cliProviderId ?? ""], query),
      ),
    [scoped, query],
  );
  const sections = activitySections(items, now);
  const allSections = activitySections(allItems, now);
  const done = sections.earlier.filter((item) => item.state === "finished").length;
  const failed = sections.earlier.filter((item) => item.state === "failed").length;
  const nothing =
    sections.needs.length === 0 && sections.running.length === 0 && sections.earlier.length === 0;
  const liveElsewhere =
    allSections.needs.length + allSections.running.length + allSections.earlier.length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-center gap-x-4.5 gap-y-2 border-b border-border-subtle px-8 pt-5.5 pb-4.5 font-mono text-ui-xs">
        <h1 className="text-ui-md font-semibold text-fg-default">activity</h1>
        <div className="flex items-center gap-4" aria-label="Session states">
          <Count cell="bg-state-needs-you" value={sections.needs.length} label="needs you" />
          <Count cell="bg-status-info" value={sections.running.length} label="running" />
          <Count cell="bg-state-done" value={done} label="done today" />
          <Count cell="bg-status-error" value={failed} label="failed" />
        </div>
        <span className="flex-1" />
        <SegmentedControl<Scope>
          label="Scope"
          value={scope}
          onValueChange={setScope}
          options={[
            { value: "space", label: "this space" },
            { value: "all", label: "all spaces", count: liveElsewhere },
          ]}
        />
        <label className="flex w-56 items-center gap-2 border-b border-border text-fg-subtle">
          <span className="text-state-needs-you" aria-hidden="true">
            /
          </span>
          <Input
            aria-label="Filter sessions"
            placeholder="filter sessions"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-7 border-0 bg-transparent px-0 font-mono text-ui-xs ring-0 hover:ring-0 focus-visible:ring-0"
          />
        </label>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-6.5 overflow-y-auto px-8 pt-5.5 pb-8">
        <ActivityPlans items={scoped} now={now} />

        {sections.needs.length > 0 && (
          <section aria-label="Needs you" className="flex flex-col gap-2">
            <h2 className="font-mono text-ui-2xs font-semibold text-state-needs-you">
              needs you · {sections.needs.length}
            </h2>
            {sections.needs.map((item) => (
              <NeedsYouRow
                key={item.session.id}
                item={item}
                now={now}
                expanded={expanded === item.session.id}
                onToggle={toggle(item.session.id)}
              />
            ))}
          </section>
        )}

        {sections.running.length > 0 && (
          <section aria-label="Running" className="flex flex-col">
            <div
              className={cn(RUNNING_COLUMNS, "px-4 pb-2 font-mono text-ui-2xs text-fg-subtle")}
              aria-hidden="true"
            >
              <h2 className="font-medium text-fg-muted">running · {sections.running.length}</h2>
              <span>session, last line</span>
              <span>agent</span>
              <span>where</span>
              <span className="text-right">for</span>
              <span className="text-right">tokens</span>
              <span />
            </div>
            {sections.running.map((item) => (
              <RunningRow
                key={item.session.id}
                item={item}
                now={now}
                expanded={expanded === item.session.id}
                onToggle={toggle(item.session.id)}
              />
            ))}
          </section>
        )}

        {sections.earlier.length > 0 && (
          <section aria-label="Earlier today" className="flex flex-col">
            <h2 className="px-4 pb-2 font-mono text-ui-2xs font-medium text-fg-muted">
              earlier today
            </h2>
            <div className="flex flex-col" role="list">
              {sections.earlier.map((item) => (
                <div role="listitem" key={item.session.id}>
                  <EarlierRow
                    item={item}
                    now={now}
                    expanded={expanded === item.session.id}
                    onToggle={toggle(item.session.id)}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {nothing && (
          <section
            aria-label="Nothing running"
            className="flex flex-col items-start gap-3.5 border-t border-border-subtle px-4 py-10"
          >
            <span className="flex items-center gap-2 font-mono text-ui-xs text-fg-subtle">
              <span aria-hidden="true" className="size-2.25 ring-1 ring-fg-subtle ring-inset" />
              {query ? "no session matches the filter" : "nothing running"}
            </span>
            {!query && (
              <>
                <p className="max-w-[560px] text-ui-lg leading-normal text-fg-muted">
                  Agents you start show up here with their state, how long they have been at it and
                  what they changed. Questions they ask land on top, so you can answer without
                  finding the pane.
                </p>
                <div className="flex gap-2">
                  <Button onClick={() => openOverlay("quickStart")} className="font-mono">
                    new task
                    {newShortcut && (
                      <Kbd className="border-0 bg-black/10 text-primary-foreground/70">
                        {formatShortcut(newShortcut, getIsMac())}
                      </Kbd>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => activateTabKind("agents")}
                    className="font-mono"
                  >
                    open agents
                  </Button>
                </div>
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
