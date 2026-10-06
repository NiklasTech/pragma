"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { ChatsCircle, CheckSquare, MagnifyingGlass, Robot } from "@phosphor-icons/react";
import { toast } from "sonner";

import { Input } from "@/shared/components/ui/input";
import { InputDialog } from "@/shared/components/ui/input-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { useAIStore, type ChatSession } from "@/shared/stores/ai";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useAgentStore } from "@/features/agent/store";
import { useAgentsPanesStore } from "@/features/ai/panes/store";
import { DiscardWorktreeDialog } from "@/features/ai/worktree/DiscardWorktreeDialog";
import { useFinishWorktree } from "@/features/ai/worktree/useFinishWorktree";
import { PanePresetsMenu } from "@/features/ai/panes/PanePresetsMenu";
import { AgentRoster } from "@/features/ai/named-agents/AgentRoster";
import { useNamedAgentsStore } from "@/features/ai/named-agents/store";
import { useNamedAgentsUiStore, type NamedAgentsView } from "@/features/ai/named-agents/ui";
import { TasksEntry } from "@/features/ai/tasks/TasksEntry";
import { useTasksUiStore } from "@/features/ai/tasks/ui";
import { buildSessionTree } from "@/features/ai/children/limits";
import { childThreadStatus, isChildRunning } from "@/features/ai/children/status";
import { useSessionStatuses } from "@/features/ai/children/useSessionStatuses";
import { useStaleTerminalIds } from "@/features/ai/terminal/useStaleTerminals";

import { CategoryHeader } from "./CategoryHeader";
import { buildThreadSections, listCategories, normalizeCategory } from "./categories";
import { DeleteThreadDialog } from "./DeleteThreadDialog";
import { NewSessionButton } from "./NewSessionButton";
import { resolveThreadStatus } from "./helpers";
import { duplicateThreads, setThreadsCategory } from "./threadActions";
import { ThreadRow } from "./ThreadRow";
import { ThreadSelectionBar } from "./ThreadSelectionBar";
import { useThreadSelection } from "./useThreadSelection";

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
  const [sessionsToDelete, setSessionsToDelete] = useState<string[]>([]);
  const [discardSessionId, setDiscardSessionId] = useState<string | null>(null);
  const [categoryTargets, setCategoryTargets] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const finishWorktree = useFinishWorktree(rootPath ?? "default");

  const staleTerminals = useStaleTerminalIds(chatSessions, rootPath ?? "default");
  const sessions = useMemo(
    () => chatSessions.filter((session) => !session.archived && !staleTerminals.has(session.id)),
    [chatSessions, staleTerminals],
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

  const sections = useMemo(
    () =>
      buildThreadSections(
        tree.roots,
        (session) => resolveThreadStatus(agentStatus, session.id, runSessionId) !== "idle",
      ),
    [agentStatus, runSessionId, tree],
  );

  const categories = useMemo(() => listCategories(sessions), [sessions]);

  const visibleOrder = useMemo(() => {
    const ids: string[] = [];
    const walk = (session: ChatSession) => {
      ids.push(session.id);
      for (const child of tree.childrenOf.get(session.id) ?? []) walk(child);
    };
    for (const section of sections) {
      if (!collapsed.has(section.key)) section.items.forEach(walk);
    }
    return ids;
  }, [collapsed, sections, tree]);

  const selection = useThreadSelection(visibleOrder);
  const { extendTo: extendSelection, toggle: toggleSelection } = selection;
  const selectedSessions = useMemo(
    () => sortedSessions.filter((session) => selection.picked.has(session.id)),
    [selection.picked, sortedSessions],
  );
  const selectedIds = useMemo(
    () => selectedSessions.map((session) => session.id),
    [selectedSessions],
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

  const handleToggleSelect = useCallback(
    (sessionId: string, extend: boolean) => {
      if (view !== "sessions") {
        handleSelect(sessionId);
        return;
      }
      if (extend) extendSelection(sessionId, activeChatSessionId);
      else toggleSelection(sessionId);
    },
    [activeChatSessionId, extendSelection, handleSelect, toggleSelection, view],
  );

  const handleDuplicate = useCallback(
    async (sessionIds: string[]) => {
      try {
        await duplicateThreads(rootPath ?? "default", sessionIds);
      } catch {
        toast.error(
          sessionIds.length > 1 ? "Failed to duplicate threads" : "Failed to duplicate thread",
        );
      }
    },
    [rootPath],
  );

  const handleMoveToCategory = useCallback(
    async (sessionIds: string[], category: string | null) => {
      try {
        await setThreadsCategory(rootPath ?? "default", sessionIds, category);
      } catch {
        toast.error("Failed to update the category");
      }
    },
    [rootPath],
  );

  const toggleCollapsed = useCallback((key: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleLoadAgents = useCallback(() => {
    if (!loaded) void loadAgents();
  }, [loadAgents, loaded]);

  useEffect(() => {
    handleLoadAgents();
  }, [handleLoadAgents]);

  const threadStatus = (session: ChatSession) => {
    const childStatus = childStatuses.get(session.id);
    return childStatus
      ? childThreadStatus(childStatus)
      : resolveThreadStatus(agentStatus, session.id, runSessionId);
  };

  const renderRow = (session: ChatSession, depth = 0) => (
    <ThreadRow
      key={session.id}
      session={session}
      isActive={session.id === activeChatSessionId}
      status={threadStatus(session)}
      depth={depth}
      runningChildren={runningChildren.get(session.id) ?? 0}
      selectionMode={selection.active}
      isSelected={selection.picked.has(session.id)}
      categories={categories}
      onSelect={handleSelect}
      onToggleSelect={handleToggleSelect}
      onRename={handleRename}
      onDuplicate={(sessionId) => void handleDuplicate([sessionId])}
      onMoveToCategory={(sessionId, category) => void handleMoveToCategory([sessionId], category)}
      onNewCategory={(sessionId) => setCategoryTargets([sessionId])}
      onDelete={(sessionId) => setSessionsToDelete([sessionId])}
      onDiscard={setDiscardSessionId}
      onFinish={finishWorktree.finish}
    />
  );

  const renderBranch = (session: ChatSession, depth: number) => (
    <Fragment key={session.id}>
      {renderRow(session, depth)}
      {(tree.childrenOf.get(session.id) ?? []).map((child) => renderBranch(child, depth + 1))}
    </Fragment>
  );

  const deleteTargets = chatSessions.filter((s) => sessionsToDelete.includes(s.id));
  const discardSession = chatSessions.find((s) => s.id === discardSessionId) ?? null;

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      onKeyDown={(event) => {
        const inside = event.target instanceof Node && event.currentTarget.contains(event.target);
        if (event.key === "Escape" && inside && selection.active) selection.exit();
      }}
    >
      <div className="flex shrink-0 flex-col gap-2 pb-1">
        <Tabs
          value={view}
          onValueChange={(value: NamedAgentsView) => {
            if (value === "agents") selection.exit();
            setView(value);
          }}
        >
          <TabsList className="w-full">
            <TabsTrigger value="sessions" className="data-active:[&_svg]:text-primary">
              <ChatsCircle weight={view === "sessions" ? "fill" : "regular"} />
              Sessions
            </TabsTrigger>
            <TabsTrigger value="agents" className="data-active:[&_svg]:text-primary">
              <Robot weight={view === "agents" ? "fill" : "regular"} />
              Agents
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {view === "sessions" ? (
          <>
            <NewSessionButton className="h-8 w-full justify-start gap-2 rounded-full px-3.5 text-ui-sm shadow-[0_6px_18px_-10px_var(--color-accent-glow)]" />
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

        {view === "sessions" && selection.active ? (
          <ThreadSelectionBar
            selected={selectedSessions}
            visibleCount={visibleOrder.length}
            categories={categories}
            onSelectAll={selection.selectAll}
            onClear={selection.clear}
            onDuplicate={() => {
              void handleDuplicate(selectedIds);
              selection.exit();
            }}
            onMove={(category) => void handleMoveToCategory(selectedIds, category)}
            onNewCategory={() => setCategoryTargets(selectedIds)}
            onDelete={() => setSessionsToDelete(selectedIds)}
            onExit={selection.exit}
          />
        ) : (
          <div className="flex h-7 items-center gap-1 pr-0.5 pl-2">
            <span className="text-ui-xs font-semibold text-fg-default">
              {view === "sessions" ? "Threads" : "Agents"}
            </span>
            {view === "sessions" && sessions.length > 0 && (
              <span className="rounded-full bg-bg-hover px-1.5 text-ui-2xs font-medium text-fg-muted tabular-nums">
                {sessions.length}
              </span>
            )}
            <span className="flex-1" />
            {view === "sessions" && sessions.length > 0 && (
              <button
                type="button"
                aria-label="Select threads"
                title="Select threads"
                onClick={selection.start}
                className="flex size-7 shrink-0 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-bg-hover hover:text-fg-default"
              >
                <CheckSquare size={15} />
              </button>
            )}
            {view === "sessions" && <PanePresetsMenu />}
          </div>
        )}

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
              {sections.map((section) => {
                const isCollapsed = collapsed.has(section.key);
                return (
                  <section
                    key={section.key}
                    aria-label={section.label}
                    className="flex flex-col gap-0.5"
                  >
                    {section.isCategory ? (
                      <CategoryHeader
                        label={section.label}
                        count={section.items.length}
                        collapsed={isCollapsed}
                        onToggle={() => toggleCollapsed(section.key)}
                      />
                    ) : (
                      <h3 className="px-2 pb-0.5 text-ui-2xs font-semibold tracking-wide text-fg-subtle uppercase">
                        {section.label}
                      </h3>
                    )}
                    {!isCollapsed && section.items.map((session) => renderBranch(session, 0))}
                  </section>
                );
              })}
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
        sessions={deleteTargets}
        rootPath={rootPath ?? "default"}
        onOpenChange={(open) => {
          if (!open) setSessionsToDelete([]);
        }}
        onDeleted={selection.exit}
      />

      <InputDialog
        open={categoryTargets.length > 0}
        onOpenChange={(open) => {
          if (!open) setCategoryTargets([]);
        }}
        title="New category"
        label="Name"
        confirmLabel="Create"
        onConfirm={(value) => {
          const category = normalizeCategory(value);
          if (category) void handleMoveToCategory(categoryTargets, category);
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

      {finishWorktree.dialogs}
    </div>
  );
}
