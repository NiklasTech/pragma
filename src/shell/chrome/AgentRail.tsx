import { Fragment, useMemo } from "react";
import { ListBullets, Plus, TerminalWindow } from "@phosphor-icons/react";

import { revealPane } from "@/features/ai/panes/paneCommands";
import { useAgentsPanesStore } from "@/features/ai/panes/store";
import { sessionAgentManifest } from "@/features/ai/sessions/sessionAgent";
import { selectAgentState, useAgentStatesStore } from "@/features/ai/state/agentStates";
import { useAgentsUiStore } from "@/features/ai/store/agentsUi";
import { isShellSession } from "@/features/ai/terminal/shell";
import { AgentMark } from "@/shared/components/ui/agent-mark";
import { Button } from "@/shared/components/ui/button";
import { IconButton } from "@/shared/components/ui/icon-button";
import { AGENT_STATE_LABELS, StatusDot } from "@/shared/components/ui/status-dot";
import { formatShortcut, getIsMac } from "@/shared/lib/shortcuts";
import { cn } from "@/shared/lib/utils";
import { useAIStore } from "@/shared/stores/ai";
import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";
import { useOverlayStore } from "@/shared/stores/overlays";
import { useSettingsStore } from "@/shared/stores/settings";
import { useUiMode } from "@/shell/mode";

import { railGroups, type RailEntry } from "./railEntries";

interface RailCellProps {
  entry: RailEntry;
  spaceId: string;
  focused: boolean;
  dim: boolean;
}

function RailCell({ entry, spaceId, focused, dim }: RailCellProps) {
  const session = useAIStore((state) =>
    state.chatSessions.find((item) => item.id === entry.sessionId),
  );
  const manifest = useAIStore((state) => sessionAgentManifest(state, entry.sessionId));
  const state = useAgentStatesStore(selectAgentState(entry.sessionId));
  if (!session) return null;

  const shell = isShellSession(session) && !manifest;
  const name = manifest?.name ?? (shell ? "Shell" : "Pragma");
  const stateLabel = AGENT_STATE_LABELS[state].toLowerCase();
  const parts = session.title === name ? [name] : [session.title, name];

  return (
    <Button
      variant="ghost"
      aria-label={[...parts, stateLabel, `tab ${entry.tabNumber}`].join(", ")}
      aria-current={focused || undefined}
      title={[...parts, stateLabel].join(" · ")}
      onClick={() => revealPane(spaceId, entry.tabId, entry.leafId)}
      className={cn(
        "size-8 shrink-0 p-0 animate-in duration-200 zoom-in-75 fade-in-0 motion-reduce:animate-none",
        focused && "bg-bg-active ring-1 ring-fg-default/15 ring-inset",
        dim && "opacity-55 hover:opacity-100",
      )}
    >
      {shell ? (
        <span
          aria-hidden="true"
          className="relative inline-flex size-4.5 items-center justify-center rounded-[5px] text-fg-muted ring-1 ring-fg-default/15 ring-inset"
        >
          <TerminalWindow size={11} />
          {state !== "idle" && (
            <StatusDot
              state={state}
              decorative
              className="absolute -right-0.75 -bottom-0.75 ring-2 ring-bg-chrome"
            />
          )}
        </span>
      ) : (
        <AgentMark
          agentId={manifest?.id}
          name={name}
          state={state}
          className="**:data-[slot=status-dot]:ring-bg-chrome"
        />
      )}
    </Button>
  );
}

/// One cell per agent pane of the space, the active tab first; a click shows that pane.
export function AgentRail() {
  const space = useOpenRepositoriesStore(
    (state) => state.spaces.find((candidate) => candidate.id === state.activeSpaceId) ?? null,
  );
  const activateTabKind = useOpenRepositoriesStore((state) => state.activateTabKind);
  const trees = useAgentsPanesStore((state) => state.trees);
  const threadsOpen = useAgentsUiStore((state) => state.threadsOpen);
  const setThreadsOpen = useAgentsUiStore((state) => state.setThreadsOpen);
  const openOverlay = useOverlayStore((state) => state.open);
  const newShortcut = useSettingsStore((state) => state.shortcuts["session.quickStart"]);
  const inAgents = useUiMode() === "agents";
  const groups = useMemo(() => (space ? railGroups(space, trees) : []), [space, trees]);
  const focusedLeafId = space ? (trees[space.activeTabId]?.focusedLeafId ?? null) : null;

  const toggleThreads = () => {
    if (!inAgents) {
      activateTabKind("agents");
      setThreadsOpen(true);
      return;
    }
    setThreadsOpen(!threadsOpen);
  };

  return (
    <nav aria-label="Agents" className="flex w-11 shrink-0 flex-col items-center gap-1.5 pb-1.5">
      <div className="flex min-h-0 flex-1 flex-col items-center gap-1.5 overflow-x-hidden overflow-y-auto [scrollbar-width:none]">
        {space &&
          groups.map((group, index) => (
            <Fragment key={group.tabId}>
              {index > 0 && (
                <span aria-hidden="true" className="my-0.5 h-px w-4.5 shrink-0 bg-border" />
              )}
              {group.entries.map((entry) => (
                <RailCell
                  key={entry.leafId}
                  entry={entry}
                  spaceId={space.id}
                  focused={inAgents && group.active && entry.leafId === focusedLeafId}
                  dim={!inAgents || !group.active}
                />
              ))}
              {(!inAgents || !group.active) && (
                <span aria-hidden="true" className="font-mono text-[9.5px] text-fg-subtle">
                  {group.tabNumber}
                </span>
              )}
            </Fragment>
          ))}
      </div>
      <IconButton
        icon={ListBullets}
        label={inAgents && threadsOpen ? "Hide threads" : "Show threads"}
        aria-pressed={inAgents && threadsOpen}
        data-drawer-toggle
        onClick={toggleThreads}
      />
      <IconButton
        icon={Plus}
        label="New"
        shortcut={newShortcut ? formatShortcut(newShortcut, getIsMac()) : undefined}
        onClick={() => openOverlay("quickStart")}
      />
    </nav>
  );
}
