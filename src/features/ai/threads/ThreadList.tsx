"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";

import { Input } from "@/shared/components/ui/input";
import { useAIStore, type ChatSession } from "@/shared/stores/ai";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useAgentStore } from "@/features/agent/store";
import { useAgentsPanesStore } from "@/features/ai/panes/store";
import { DiscardWorktreeDialog } from "@/features/ai/worktree/DiscardWorktreeDialog";
import { PanePresetsMenu } from "@/features/ai/panes/PanePresetsMenu";
import { AgentRoster } from "@/features/ai/named-agents/AgentRoster";
import { useNamedAgentsStore } from "@/features/ai/named-agents/store";
import { useNamedAgentsUiStore } from "@/features/ai/named-agents/ui";
import { TasksEntry } from "@/features/ai/tasks/TasksEntry";
import { useTasksUiStore } from "@/features/ai/tasks/ui";
import { buildSessionTree } from "@/features/ai/children/limits";
import { isChildRunning } from "@/features/ai/children/status";
import { useSessionStatuses } from "@/features/ai/children/useSessionStatuses";
import { cn } from "@/shared/lib/utils";

import { DeleteThreadDialog } from "./DeleteThreadDialog";
import { NewSessionButton } from "./NewSessionButton";
import { groupThreadsByRecency, resolveThreadStatus } from "./helpers";
import { ThreadRow } from "./ThreadRow";

const SEARCH_THRESHOLD = 8;

export function ThreadList() {
  const chatSessions = useAIStore((state) => state.chatSessions);
  const activeChatSessionId = useAIStore((state) => state.activeChatSessionId);
  const renameChatSession = useAIStore((state) => state.renameChatSession);
  const rootPath = useFileExplorerStore((state) => state.rootPath);
  const agentStatus = useAgentStore((state) => state.status);
  const runSessionId = useAgentStore((state) => state.runSessionId);
  const openSession = useAgentsPanesStore((state) => state.openSession);

  const agents = useNamedAgentsStore((state) => state.agents);
  const loaded = useNamedAgentsStore((state) => state.loaded);
  const loadAgents = useNamedAgentsStore((state) => state.loadAgents);
  const view = useNamedAgentsUiStore((state) => state.view);
  const setView = useNamedAgentsUiStore((state) => state.setView);
  const selectedAgentId = useNamedAgentsUiStore((state) => state.selectedAgentId);
  const selectAgent = useNamedAgentsUiStore((state) => state.selectAgent);
  const startCreatingAgent = useNamedAgentsUiStore((state) => state.startCreatingAgent);

  const [query, setQuery] = useState("");
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [discardSessionId, setDiscardSessionId] = useState<string | null>(null);

  const sessions = useMemo(
    () => chatSessions.filter((session) => !session.archived),
    [chatSessions],
  );

  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => b.updatedAt - a.updatedAt),
    [sessions],
  );

  const visibleSessions = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return sortedSessions;
    return sortedSessions.filter((session) => session.title.toLowerCase().includes(trimmed));
  }, [query, sortedSessions]);

  const searching = query.trim().length > 0;
  const tree = useMemo(
    () =>
      searching
        ? { roots: visibleSessions, childrenOf: new Map<string, ChatSession[]>() }
        : buildSessionTree(visibleSessions),
    [searching, visibleSessions],
  );

  const groups = useMemo(
    () =>
      groupThreadsByRecency(
        tree.roots,
        (session) => resolveThreadStatus(agentStatus, session.id, runSessionId) !== "idle",
      ),
    [agentStatus, runSessionId, tree],
  );

  const children = useMemo(() => sessions.filter((session) => session.parentId), [sessions]);
  const childStatuses = useSessionStatuses(children);
  const runningChildren = useMemo(() => {
    const counts = new Map<string, number>();
    for (const child of children) {
      const status = childStatuses.get(child.id);
      if (!child.parentId || !status || !isChildRunning(status)) continue;
      counts.set(child.parentId, (counts.get(child.parentId) ?? 0) + 1);
    }
    return counts;
  }, [childStatuses, children]);

  const selectedAgentChats = useMemo(() => {
    if (!selectedAgentId) return [];
    return sessions
      .filter((session) => session.agentId === selectedAgentId)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [selectedAgentId, sessions]);

  const handleSelect = useCallback(
    (sessionId: string) => {
      useTasksUiStore.getState().closeBoard();
      openSession(rootPath ?? "default", sessionId);
    },
    [openSession, rootPath],
  );

  const handleRename = useCallback(
    (sessionId: string, title: string) => {
      void renameChatSession(rootPath ?? "default", sessionId, title);
    },
    [renameChatSession, rootPath],
  );

  const handleLoadAgents = useCallback(() => {
    if (!loaded) void loadAgents();
  }, [loadAgents, loaded]);

  useEffect(() => {
    handleLoadAgents();
  }, [handleLoadAgents]);

  const renderRow = (session: ChatSession, depth = 0) => (
    <ThreadRow
      key={session.id}
      session={session}
      isActive={session.id === activeChatSessionId}
      status={resolveThreadStatus(agentStatus, session.id, runSessionId)}
      depth={depth}
      runningChildren={runningChildren.get(session.id) ?? 0}
      onSelect={handleSelect}
      onRename={handleRename}
      onDelete={setSessionToDelete}
      onDiscard={setDiscardSessionId}
    />
  );

  const renderBranch = (session: ChatSession, depth: number) => (
    <Fragment key={session.id}>
      {renderRow(session, depth)}
      {(tree.childrenOf.get(session.id) ?? []).map((child) => renderBranch(child, depth + 1))}
    </Fragment>
  );

  const sessionToDeleteValue = chatSessions.find((s) => s.id === sessionToDelete) ?? null;
  const discardSession = chatSessions.find((s) => s.id === discardSessionId) ?? null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-col gap-2 pb-1">
        <div className="flex items-center gap-1 rounded-md bg-bg-hover p-[3px]">
          <button
            type="button"
            aria-pressed={view === "sessions"}
            onClick={() => setView("sessions")}
            className={cn(
              "h-6 flex-1 rounded-[4px] text-ui-xs font-medium transition-colors",
              view === "sessions"
                ? "bg-bg-elevated text-fg-default shadow-sm"
                : "text-fg-muted hover:text-fg-default",
            )}
          >
            Sessions
          </button>
          <button
            type="button"
            aria-pressed={view === "agents"}
            onClick={() => setView("agents")}
            className={cn(
              "h-6 flex-1 rounded-[4px] text-ui-xs font-medium transition-colors",
              view === "agents"
                ? "bg-bg-elevated text-fg-default shadow-sm"
                : "text-fg-muted hover:text-fg-default",
            )}
          >
            Agents
          </button>
        </div>

        {view === "sessions" ? (
          <>
            <NewSessionButton
              variant="secondary"
              className="h-8 w-full justify-start gap-2 rounded-full px-3.5 text-ui-sm"
            />
            <TasksEntry />
          </>
        ) : (
          <AgentRoster
            agents={agents}
            selectedAgentId={selectedAgentId}
            chatSessions={chatSessions}
            agentStatus={agentStatus}
            runSessionId={runSessionId}
            onSelectAgent={selectAgent}
            onNewAgent={startCreatingAgent}
          />
        )}

        <div className="flex h-7 items-center gap-1 pr-0.5 pl-2">
          <span className="text-ui-xs font-semibold text-fg-default">
            {view === "sessions" ? "Threads" : "Agents"}
          </span>
          {view === "sessions" && sessions.length > 0 && (
            <span className="text-ui-xs text-fg-subtle tabular-nums">{sessions.length}</span>
          )}
          <span className="flex-1" />
          {view === "sessions" && <PanePresetsMenu />}
        </div>

        {view === "sessions" && sessions.length > SEARCH_THRESHOLD && (
          <div className="relative">
            <MagnifyingGlass
              size={12}
              weight="bold"
              className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-fg-subtle"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search threads"
              aria-label="Search threads"
              className="h-7 rounded-md pl-7 text-ui-xs"
            />
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-1.5">
        {view === "sessions" ? (
          visibleSessions.length === 0 ? (
            <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-ui-xs text-fg-subtle">
              {sessions.length === 0 ? "No threads yet." : "No threads match your search."}
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {groups.map((group) => (
                <section
                  key={group.label}
                  aria-label={group.label}
                  className="flex flex-col gap-0.5"
                >
                  <h3 className="px-2 pb-0.5 text-ui-2xs font-medium text-fg-subtle">
                    {group.label}
                  </h3>
                  {group.items.map((session) => renderBranch(session, 0))}
                </section>
              ))}
            </div>
          )
        ) : !selectedAgentId ? (
          <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-ui-xs text-fg-subtle">
            Select an agent to see its chats.
          </p>
        ) : selectedAgentChats.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-ui-xs text-fg-subtle">
            No chats yet.
          </p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {selectedAgentChats.map((session) => renderRow(session))}
          </div>
        )}
      </div>

      <DeleteThreadDialog
        session={sessionToDeleteValue}
        rootPath={rootPath ?? "default"}
        onOpenChange={(open) => {
          if (!open) setSessionToDelete(null);
        }}
      />

      <DiscardWorktreeDialog
        session={discardSession}
        rootPath={rootPath ?? "default"}
        open={discardSessionId !== null}
        onOpenChange={(open) => {
          if (!open) setDiscardSessionId(null);
        }}
      />
    </div>
  );
}
