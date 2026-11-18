import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { revealPane } from "@/features/ai/panes/paneCommands";
import { useAgentsPanesStore } from "@/features/ai/panes/store";
import { openInRepository } from "@/features/ai/sessions/openInRepository";
import { useAgentStatesStore } from "@/features/ai/state/agentStates";
import { useAgentsUiStore } from "@/features/ai/store/agentsUi";
import { sessionEnvironment } from "@/features/ai/worktree/cwd";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Kbd } from "@/shared/components/ui/kbd";
import { AGENT_STATE_LABELS, type AgentState } from "@/shared/components/ui/status-dot";
import { useDrawerDismiss } from "@/shared/hooks/useDrawerDismiss";
import { usePresence } from "@/shared/hooks/usePresence";
import { formatShortcut, getIsMac, TAB_SELECT_SHORTCUTS } from "@/shared/lib/shortcuts";
import { cn } from "@/shared/lib/utils";
import { repositorySessions, useAIStore, type ChatSession } from "@/shared/stores/ai";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";
import { useSettingsStore } from "@/shared/stores/settings";
import { useUiMode } from "@/shell/mode";

import { earlierSessions, sheetGroups } from "./agentSheetGroups";
import { useAgentSheetStore } from "./agentSheetStore";
import { railGroups, type RailEntry } from "./railEntries";
import { SessionMark, STATE_CELL_CLASSES, useSessionIdentity } from "./SessionMark";

// Matches --motion-slow, so the sheet unmounts once it has slid out.
const SLIDE_MS = 250;

function GroupLabel({ state, children }: { state?: AgentState; children: string }) {
  return (
    <div className="flex items-center gap-2 px-3 pt-3.5 pb-1 font-mono text-[10px] tracking-[0.08em] text-fg-subtle uppercase after:h-px after:flex-1 after:bg-border">
      {state && (
        <span
          aria-hidden="true"
          className={cn("size-1.75 rounded-[1.5px]", STATE_CELL_CLASSES[state])}
        />
      )}
      {children}
    </div>
  );
}

interface RowProps {
  sessionId: string;
  details: string[];
  focused?: boolean;
  shortcut?: string;
  onSelect: () => void;
}

function SheetRow({ sessionId, details, focused = false, shortcut, onSelect }: RowProps) {
  const identity = useSessionIdentity(sessionId);
  const environments = useAIStore((store) => store.workEnvironments);
  const { session, name, title } = identity;
  if (!session) return null;
  const environment = sessionEnvironment(session, environments);
  const branch = environment?.kind === "worktree" ? environment.branch : null;
  const sub = [title === name ? null : name, branch, ...details].filter((part): part is string =>
    Boolean(part),
  );

  return (
    <Button
      variant="ghost"
      aria-current={focused || undefined}
      onClick={onSelect}
      className={cn(
        "h-auto w-full justify-start gap-2.5 rounded-none px-3 py-1.75 text-left font-normal",
        focused && "bg-bg-active shadow-[inset_2px_0_0_var(--color-accent)]",
      )}
    >
      <SessionMark identity={identity} surface="sheet" />
      <span className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="truncate font-sans text-ui-sm font-medium text-fg-default">{title}</span>
        <span className="truncate text-[10.5px] text-fg-subtle">{sub.join(" · ")}</span>
      </span>
      {shortcut && <Kbd>{shortcut}</Kbd>}
    </Button>
  );
}

function PaneRow({
  entry,
  spaceId,
  here,
  focused,
  onDone,
}: {
  entry: RailEntry;
  spaceId: string;
  /** In the tab on screen, so the tab needs no mention. */
  here: boolean;
  focused: boolean;
  onDone: () => void;
}) {
  const shortcutId = TAB_SELECT_SHORTCUTS[entry.tabNumber - 1];
  const binding = useSettingsStore((store) => (shortcutId ? store.shortcuts[shortcutId] : null));
  return (
    <SheetRow
      sessionId={entry.sessionId}
      details={here ? [] : [`tab ${entry.tabNumber}`]}
      focused={focused}
      shortcut={!here && binding ? formatShortcut(binding, getIsMac()) : undefined}
      onSelect={() => {
        revealPane(spaceId, entry.tabId, entry.leafId);
        onDone();
      }}
    />
  );
}

/// Every agent of the space by state, beside the rail; earlier threads below, a filter at the bottom.
export function AgentSheet() {
  const open = useAgentSheetStore((state) => state.open);
  const setOpen = useAgentSheetStore((state) => state.setOpen);
  const space = useOpenRepositoriesStore(
    (state) => state.spaces.find((candidate) => candidate.id === state.activeSpaceId) ?? null,
  );
  const activateTabKind = useOpenRepositoriesStore((state) => state.activateTabKind);
  const trees = useAgentsPanesStore((state) => state.trees);
  const chatSessions = useAIStore((state) => state.chatSessions);
  const agentStates = useAgentStatesStore((state) => state.entries);
  const rootPath = useFileExplorerStore((state) => state.rootPath) ?? "default";
  const setThreadsOpen = useAgentsUiStore((state) => state.setThreadsOpen);
  const inAgents = useUiMode() === "agents";
  const [filter, setFilter] = useState("");
  const ref = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { mounted, shown } = usePresence(open, SLIDE_MS);
  const close = useCallback(() => setOpen(false), [setOpen]);
  useDrawerDismiss(ref, open, close);

  useEffect(() => {
    if (open && shown) inputRef.current?.focus({ preventScroll: true });
    if (!open) setFilter("");
  }, [open, shown]);

  const entries = useMemo(
    () => (space ? railGroups(space, trees).flatMap((group) => group.entries) : []),
    [space, trees],
  );
  const groups = useMemo(() => {
    const byId = new Map(chatSessions.map((session) => [session.id, session]));
    return sheetGroups(
      entries,
      (id) => agentStates[id]?.state ?? "idle",
      (id) => byId.get(id),
      filter,
    );
  }, [entries, chatSessions, agentStates, filter]);
  const earlier = useMemo(
    () =>
      earlierSessions(
        repositorySessions(chatSessions, rootPath),
        new Set(entries.map((entry) => entry.sessionId)),
        filter,
      ),
    [chatSessions, rootPath, entries, filter],
  );

  if (!mounted || !space) return null;

  const focusedLeafId = inAgents ? (trees[space.activeTabId]?.focusedLeafId ?? null) : null;
  const openEarlier = (session: ChatSession) => {
    if (!inAgents) activateTabKind("agents");
    void openInRepository(session.rootPath, session.id);
    close();
  };
  const showAllThreads = () => {
    if (!inAgents) activateTabKind("agents");
    setThreadsOpen(true);
    close();
  };

  return (
    <aside
      ref={ref}
      aria-label={`Agents in ${space.name}`}
      inert={!shown}
      className={cn(
        "absolute top-0 bottom-1.5 left-11 z-40 flex w-[300px] max-w-[calc(100%-3.5rem)] flex-col overflow-hidden rounded-well bg-bg-sheet shadow-[var(--shadow-md)] ring-1 ring-border",
        "transition-[translate,opacity] duration-(--motion-slow) ease-(--motion-ease-out) motion-reduce:transition-none",
        shown ? "translate-x-0 opacity-100" : "-translate-x-3 opacity-0",
      )}
    >
      <header className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3 font-mono text-ui-xs">
        <span className="font-semibold text-fg-default">agents</span>
        <span className="text-fg-subtle">in</span>
        <span className="min-w-0 truncate text-fg-muted">{space.name}</span>
        <Kbd className="ml-auto">esc</Kbd>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        {groups.map((group) => (
          <section key={group.state} aria-label={AGENT_STATE_LABELS[group.state]}>
            <GroupLabel state={group.state}>{AGENT_STATE_LABELS[group.state]}</GroupLabel>
            {group.entries.map((entry) => (
              <PaneRow
                key={entry.leafId}
                entry={entry}
                spaceId={space.id}
                here={inAgents && entry.tabId === space.activeTabId}
                focused={entry.leafId === focusedLeafId}
                onDone={close}
              />
            ))}
          </section>
        ))}
        {earlier.length > 0 && (
          <section aria-label="Earlier">
            <GroupLabel>Earlier</GroupLabel>
            {earlier.map((session) => (
              <SheetRow
                key={session.id}
                sessionId={session.id}
                details={[]}
                onSelect={() => openEarlier(session)}
              />
            ))}
          </section>
        )}
        {groups.length === 0 && earlier.length === 0 && (
          <p className="px-3 pt-4 text-ui-sm text-fg-subtle">
            {filter ? "Nothing matches the filter." : "No agents in this space yet."}
          </p>
        )}
      </div>

      <footer className="flex shrink-0 items-center gap-2 border-t border-border py-2 pr-2 pl-3">
        <label className="flex min-w-0 flex-1 items-center gap-2 border-b border-transparent font-mono text-ui-xs focus-within:border-primary/60">
          <span aria-hidden="true" className="font-semibold text-primary">
            /
          </span>
          <span className="sr-only">Filter agents</span>
          <Input
            ref={inputRef}
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="filter"
            className="h-6 px-0 font-mono text-ui-xs ring-0 hover:ring-0 focus-visible:ring-0"
          />
        </label>
        <Button variant="ghost" size="sm" onClick={showAllThreads}>
          all threads
        </Button>
      </footer>
    </aside>
  );
}
