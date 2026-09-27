"use client";

import { useEffect, useMemo, useRef } from "react";

import { cn } from "@/shared/lib/utils";
import { CARD_CLASS } from "@/shared/lib/surfaces";
import { useAIStore } from "@/shared/stores/ai";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useAgentStore } from "@/features/agent/store";
import { ThreadList } from "@/features/ai/threads/ThreadList";
import { AgentForm } from "@/features/ai/named-agents/AgentForm";
import { AgentPage } from "@/features/ai/named-agents/AgentPage";
import { createAgentChat } from "@/features/ai/named-agents/createChat";
import { useNamedAgentsStore } from "@/features/ai/named-agents/store";
import { useNamedAgentsUiStore } from "@/features/ai/named-agents/ui";
import { TaskBoard } from "@/features/ai/tasks/TaskBoard";
import { useTasksStore } from "@/features/ai/tasks/store";
import { useTasksUiStore } from "@/features/ai/tasks/ui";

import { AgentsContextPane } from "./AgentsContextPane";
import { AgentsHome } from "./AgentsHome";
import { PaneTree } from "../panes/PaneTree";
import { selectFocusedSessionId, selectRoot, useAgentsPanesStore } from "../panes/store";
import { shouldAutoOpenContextPane, useAgentsUiStore } from "../store/agentsUi";

export function AgentsWorkspace() {
  const activeChatSessionId = useAIStore((state) => state.activeChatSessionId);
  const setActiveChatSession = useAIStore((state) => state.setActiveChatSession);
  const chatSessions = useAIStore((state) => state.chatSessions);
  const loadSessions = useAIStore((state) => state.loadSessions);
  const rootPath = useFileExplorerStore((state) => state.rootPath) ?? "default";

  const root = useAgentsPanesStore((state) => selectRoot(state, rootPath));
  const focusedSessionId = useAgentsPanesStore((state) => selectFocusedSessionId(state, rootPath));
  const syncSessions = useAgentsPanesStore((state) => state.syncSessions);
  const openSession = useAgentsPanesStore((state) => state.openSession);

  const agentStatus = useAgentStore((state) => state.status);
  const editReviewCount = useAgentStore((state) => state.editReviews.length);
  const checkpointedCount = useAgentStore((state) => state.checkpointedPaths.length);

  const contextPaneCollapsed = useAgentsUiStore((state) => state.contextPaneCollapsed);
  const setContextPaneCollapsed = useAgentsUiStore((state) => state.setContextPaneCollapsed);

  const agents = useNamedAgentsStore((state) => state.agents);
  const view = useNamedAgentsUiStore((state) => state.view);
  const selectedAgentId = useNamedAgentsUiStore((state) => state.selectedAgentId);
  const creatingAgent = useNamedAgentsUiStore((state) => state.creatingAgent);
  const formAgentId = useNamedAgentsUiStore((state) => state.formAgentId);
  const selectAgent = useNamedAgentsUiStore((state) => state.selectAgent);
  const startEditingAgent = useNamedAgentsUiStore((state) => state.startEditingAgent);
  const closeAgentForm = useNamedAgentsUiStore((state) => state.closeAgentForm);

  const boardOpen = useTasksUiStore((state) => state.boardOpen);
  const closeBoard = useTasksUiStore((state) => state.closeBoard);

  useEffect(() => {
    useAgentStore.getState().setModeActive(true);
  }, []);

  useEffect(() => {
    void loadSessions(rootPath);
  }, [loadSessions, rootPath]);

  useEffect(() => {
    if (rootPath === "default" || useTasksStore.getState().rootPath === rootPath) return;
    void useTasksStore.getState().load(rootPath);
  }, [rootPath]);

  const previousFocusRef = useRef(focusedSessionId);
  useEffect(() => {
    if (previousFocusRef.current === focusedSessionId) return;
    previousFocusRef.current = focusedSessionId;
    closeBoard();
  }, [focusedSessionId, closeBoard]);

  const sessionIds = useMemo(() => chatSessions.map((session) => session.id), [chatSessions]);

  useEffect(() => {
    if (sessionIds.length === 0) return;
    syncSessions(rootPath, sessionIds);
  }, [rootPath, sessionIds, syncSessions]);

  useEffect(() => {
    if (!focusedSessionId || focusedSessionId === activeChatSessionId) return;
    setActiveChatSession(focusedSessionId);
  }, [focusedSessionId, activeChatSessionId, setActiveChatSession]);

  const setActiveCLIProvider = useAIStore((state) => state.setActiveCLIProvider);
  const activeSession = chatSessions.find((session) => session.id === activeChatSessionId);
  const activeSessionKind = activeSession?.kind;
  const activeSessionCliProviderId = activeSession?.cliProviderId;

  useEffect(() => {
    if (activeSessionKind === "terminal") return;
    if (activeSessionCliProviderId) setActiveCLIProvider(activeSessionCliProviderId);
  }, [activeSessionKind, activeSessionCliProviderId, setActiveCLIProvider]);

  const autoOpen = shouldAutoOpenContextPane({
    status: agentStatus,
    editReviewCount,
    checkpointedCount,
  });

  useEffect(() => {
    if (autoOpen && contextPaneCollapsed) {
      setContextPaneCollapsed(false);
    }
  }, [autoOpen, contextPaneCollapsed, setContextPaneCollapsed]);

  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId) ?? null;
  const formAgent = formAgentId ? (agents.find((agent) => agent.id === formAgentId) ?? null) : null;
  const showForm = creatingAgent || formAgentId !== null;
  const focusedSession = chatSessions.find((session) => session.id === focusedSessionId);
  const focusedBelongsToSelected =
    selectedAgent !== null && focusedSession?.agentId === selectedAgent.id;
  const showAgentPage =
    !showForm && view === "agents" && selectedAgent !== null && !focusedBelongsToSelected;
  const showBoard = boardOpen && view === "sessions";

  const handleNewChat = (agentId: string) => {
    const agent = agents.find((item) => item.id === agentId);
    if (!agent) return;
    void createAgentChat(rootPath, agent)
      .then((session) => {
        openSession(rootPath, session.id);
      })
      .catch(() => {});
  };

  return (
    <div className="relative flex min-h-0 flex-1 gap-1.5 overflow-hidden px-1.5">
      <aside aria-label="Threads" className="flex h-full w-[256px] shrink-0 flex-col">
        <ThreadList />
      </aside>

      <section aria-label="Transcript" className={cn(CARD_CLASS, "flex min-w-0 flex-1 flex-col")}>
        {showForm ? (
          <AgentForm
            agent={formAgent ?? undefined}
            onCancel={closeAgentForm}
            onSaved={(saved) => selectAgent(saved.id)}
          />
        ) : showAgentPage && selectedAgent ? (
          <AgentPage
            agent={selectedAgent}
            onNewChat={() => handleNewChat(selectedAgent.id)}
            onEdit={() => startEditingAgent(selectedAgent.id)}
            onDeleted={() => selectAgent(null)}
          />
        ) : (
          <>
            {showBoard && <TaskBoard />}
            {/* The pane tree stays mounted under the board so a live run keeps its chat. */}
            {root ? (
              <div className={showBoard ? "hidden" : "contents"}>
                <PaneTree />
              </div>
            ) : (
              !showBoard && <AgentsHome />
            )}
          </>
        )}
      </section>

      <AgentsContextPane />
    </div>
  );
}
