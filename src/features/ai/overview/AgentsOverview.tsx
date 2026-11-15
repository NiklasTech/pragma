import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CheckCircle, Clock, Plus, Stack, Star, X } from "@phosphor-icons/react";

import { Button } from "@/shared/components/ui/button";
import { IconButton } from "@/shared/components/ui/icon-button";
import { InputDialog } from "@/shared/components/ui/input-dialog";
import { Kbd } from "@/shared/components/ui/kbd";
import {
  OverlaySheet,
  OverlaySheetContent,
  OverlaySheetTitle,
} from "@/shared/components/ui/overlay-sheet";
import { SegmentedControl } from "@/shared/components/ui/segmented-control";
import { AGENT_STATE_LABELS, StatusDot } from "@/shared/components/ui/status-dot";
import { cn } from "@/shared/lib/utils";
import { useAIStore } from "@/shared/stores/ai";
import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";
import { useOverlayOpen, useOverlayStore } from "@/shared/stores/overlays";
import type { Space } from "@/shared/stores/spaces/model";

import { focusAttentionSession } from "../notifications/focusSession";
import { useAgentStatesStore } from "../state/agentStates";
import { getTerminalEntryStatus } from "../terminal/runner";
import {
  countByState,
  filterTiles,
  overviewTiles,
  STATE_ORDER,
  type OverviewFilter,
  type OverviewGroup,
  type OverviewTile,
} from "./overviewModel";
import { OverviewTileCard } from "./OverviewTileCard";
import { useSavedOverviewViews } from "./savedViews";

const TICK_MS = 1000;

const FILTERS: OverviewFilter[] = ["all", ...STATE_ORDER];

function NavItem({
  active,
  icon,
  label,
  count,
  urgent,
  onClick,
  onRemove,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  count?: number;
  urgent?: boolean;
  onClick: () => void;
  onRemove?: () => void;
}) {
  return (
    <span className="group/nav relative flex">
      <Button
        variant="ghost"
        aria-pressed={active}
        onClick={onClick}
        className="h-8 flex-1 justify-start gap-2.5 px-2.5 text-ui-sm font-normal text-fg-muted aria-pressed:bg-bg-hover aria-pressed:text-fg-default"
      >
        {icon}
        <span className="min-w-0 truncate">{label}</span>
        {count !== undefined && (
          <span
            className={cn(
              "ml-auto text-ui-xs text-fg-subtle tabular-nums group-hover/nav:opacity-0",
              urgent && count > 0 && "text-state-needs-you",
              !onRemove && "group-hover/nav:opacity-100",
            )}
          >
            {count}
          </span>
        )}
      </Button>
      {onRemove && (
        <IconButton
          icon={X}
          label={`Remove view ${label}`}
          size="sm"
          className="absolute top-1 right-1 opacity-0 group-hover/nav:opacity-100 focus-visible:opacity-100"
          onClick={onRemove}
        />
      )}
    </span>
  );
}

function SpaceMark({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-4.5 shrink-0 items-center justify-center rounded-[5px] bg-bg-active text-[10px] font-semibold text-fg-muted"
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function Column({ header, children }: { header: ReactNode; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-2.5">
      <h3 className="flex h-7 shrink-0 items-center gap-2 px-0.5 text-ui-sm font-medium text-fg-default">
        {header}
      </h3>
      {children}
    </section>
  );
}

function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2.5 rounded-[12px] px-3.5 py-4.5 text-ui-sm text-fg-muted ring-1 ring-border-subtle ring-inset">
      {children}
    </div>
  );
}

function OverviewBody({ onClose }: { onClose: () => void }) {
  const sessions = useAIStore((state) => state.chatSessions);
  const entries = useAgentStatesStore((state) => state.entries);
  const spaces = useOpenRepositoriesStore((state) => state.spaces);
  const openOverlay = useOverlayStore((state) => state.open);
  const savedViews = useSavedOverviewViews((state) => state.views);
  const saveView = useSavedOverviewViews((state) => state.save);
  const removeView = useSavedOverviewViews((state) => state.remove);

  const [filter, setFilter] = useState<OverviewFilter>("all");
  const [group, setGroup] = useState<OverviewGroup>("status");
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [naming, setNaming] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  const liveKey = sessions
    .filter((session) => session.kind === "terminal")
    .filter((session) => getTerminalEntryStatus(session.id) === "running")
    .map((session) => session.id)
    .join(",");
  const tiles = useMemo(
    () =>
      overviewTiles({
        sessions,
        entries,
        spaces,
        liveTerminals: new Set(liveKey.split(",")),
        now: Date.now(),
      }),
    [sessions, entries, spaces, liveKey],
  );
  const counts = countByState(spaceId ? filterTiles(tiles, { filter: "all", spaceId }) : tiles);
  const shown = filterTiles(tiles, { filter, spaceId });
  const spaceCount = spaces.length;
  const spaceName = (id: string | null) => spaces.find((space) => space.id === id)?.name ?? null;

  const pick = (next: {
    filter?: OverviewFilter;
    group?: OverviewGroup;
    spaceId?: string | null;
  }) => {
    setSavedId(null);
    if (next.filter !== undefined) setFilter(next.filter);
    if (next.group !== undefined) setGroup(next.group);
    if (next.spaceId !== undefined) setSpaceId(next.spaceId);
  };
  const open = (sessionId: string) => {
    onClose();
    focusAttentionSession(sessionId);
  };
  const tile = (item: OverviewTile) => (
    <OverviewTileCard
      key={item.session.id}
      tile={item}
      spaceName={group === "status" ? spaceName(item.spaceId) : null}
      now={now}
      onOpen={open}
    />
  );
  const builtIn = savedId === null && spaceId === null;

  const statusBoard = STATE_ORDER.filter((state) => filter === "all" || filter === state).map(
    (state) => {
      const items = shown.filter((item) => item.state === state);
      return (
        <Column
          key={state}
          header={
            <>
              <StatusDot state={state} decorative />
              <span className={cn(state === "needs-you" && "text-state-needs-you")}>
                {AGENT_STATE_LABELS[state]}
              </span>
              <span className="font-normal text-fg-subtle tabular-nums">{items.length}</span>
            </>
          }
        >
          {items.map(tile)}
          {items.length === 0 && state === "needs-you" && (
            <EmptyNote>Nothing waits on you.</EmptyNote>
          )}
        </Column>
      );
    },
  );

  const spacesShown: Space[] = spaceId ? spaces.filter((space) => space.id === spaceId) : spaces;
  const spaceBoard = spacesShown.map((space) => {
    const items = shown.filter((item) => item.spaceId === space.id);
    return (
      <Column
        key={space.id}
        header={
          <>
            <SpaceMark name={space.name} />
            {space.name}
            <span className="font-normal text-fg-subtle tabular-nums">{items.length}</span>
          </>
        }
      >
        {items.length > 0 && (
          // A wide space column lays its tiles out side by side instead of stretching them.
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-2.5">
            {items.map(tile)}
          </div>
        )}
        {items.length === 0 && (
          <EmptyNote>
            No agents in this space.
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                onClose();
                openOverlay("quickStart");
              }}
            >
              Start one
            </Button>
          </EmptyNote>
        )}
      </Column>
    );
  });

  return (
    <>
      <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 py-4 pr-4 pl-5.5">
        <OverlaySheetTitle>Agents</OverlaySheetTitle>
        <span className="text-ui-sm text-fg-muted">
          {tiles.length} {tiles.length === 1 ? "session" : "sessions"} in {spaceCount}{" "}
          {spaceCount === 1 ? "space" : "spaces"}
        </span>
        <SegmentedControl<OverviewFilter>
          label="Filter"
          className="ml-3"
          value={filter}
          onValueChange={(value) => pick({ filter: value })}
          options={FILTERS.map((value) => ({
            value,
            label: value === "all" ? "All" : AGENT_STATE_LABELS[value],
            count: counts[value],
          }))}
        />
        <span className="ml-auto flex items-center gap-2.5">
          <span className="text-ui-xs font-medium text-fg-muted">Group by</span>
          <SegmentedControl<OverviewGroup>
            label="Group by"
            value={group}
            onValueChange={(value) => pick({ group: value })}
            options={[
              { value: "status", label: "Status" },
              { value: "space", label: "Space" },
            ]}
          />
          <Button variant="ghost" onClick={onClose}>
            Close
            <Kbd>Esc</Kbd>
          </Button>
        </span>
      </header>
      <div className="flex min-h-0 flex-1 gap-4 px-4 pb-4">
        <nav
          aria-label="Views"
          className="flex w-[210px] shrink-0 flex-col gap-0.5 overflow-y-auto"
        >
          <span className="px-2.5 pt-1 pb-1.5 text-ui-xs font-medium text-fg-subtle">Views</span>
          <NavItem
            active={builtIn && filter === "all"}
            icon={<Stack size={14} aria-hidden="true" />}
            label="Everything"
            count={tiles.length}
            onClick={() => pick({ filter: "all", spaceId: null })}
          />
          <NavItem
            active={builtIn && filter === "needs-you"}
            icon={<Clock size={14} aria-hidden="true" />}
            label="Waiting on me"
            count={countByState(tiles)["needs-you"]}
            urgent
            onClick={() => pick({ filter: "needs-you", spaceId: null })}
          />
          <NavItem
            active={builtIn && filter === "done"}
            icon={<CheckCircle size={14} aria-hidden="true" />}
            label="Ready to review"
            count={countByState(tiles).done}
            onClick={() => pick({ filter: "done", spaceId: null })}
          />
          {savedViews.map((view) => (
            <NavItem
              key={view.id}
              active={savedId === view.id}
              icon={<Star size={14} aria-hidden="true" />}
              label={view.name}
              count={filterTiles(tiles, view).length}
              onClick={() => {
                setFilter(view.filter);
                setGroup(view.group);
                setSpaceId(view.spaceId);
                setSavedId(view.id);
              }}
              onRemove={() => {
                removeView(view.id);
                if (savedId === view.id) setSavedId(null);
              }}
            />
          ))}
          <NavItem
            active={false}
            icon={<Plus size={14} aria-hidden="true" />}
            label="Save this view"
            onClick={() => setNaming(true)}
          />
          <span className="px-2.5 pt-4 pb-1.5 text-ui-xs font-medium text-fg-subtle">Spaces</span>
          {spaces.map((space) => (
            <NavItem
              key={space.id}
              active={savedId === null && spaceId === space.id}
              icon={<SpaceMark name={space.name} />}
              label={space.name}
              count={tiles.filter((item) => item.spaceId === space.id).length}
              onClick={() => pick({ spaceId: spaceId === space.id ? null : space.id })}
            />
          ))}
        </nav>
        <div className="grid min-w-0 flex-1 auto-cols-[minmax(200px,1fr)] grid-flow-col gap-3.5 overflow-auto">
          {group === "status" ? statusBoard : spaceBoard}
        </div>
      </div>
      <InputDialog
        open={naming}
        onOpenChange={setNaming}
        title="Save this view"
        label="Name"
        confirmLabel="Save"
        onConfirm={(name) => {
          if (name) saveView({ name, filter, group, spaceId });
        }}
      />
    </>
  );
}

/// Every agent in every space with its latest output, by status or by space.
export function AgentsOverview() {
  const isOpen = useOverlayOpen("overview");
  const close = useOverlayStore((state) => state.close);

  return (
    <OverlaySheet open={isOpen} onOpenChange={(open) => !open && close("overview")}>
      <OverlaySheetContent className="h-[min(780px,88vh)] max-w-[1320px]">
        <OverviewBody onClose={() => close("overview")} />
      </OverlaySheetContent>
    </OverlaySheet>
  );
}
