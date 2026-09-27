"use client";

import { useEffect, useMemo } from "react";

import { cn } from "@/shared/lib/utils";
import { CARD_CLASS } from "@/shared/lib/surfaces";
import { useAIStore } from "@/shared/stores/ai";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useAgentStore } from "@/features/agent/store";
import { ThreadList } from "@/features/ai/threads/ThreadList";

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

  const agentStatus = useAgentStore((state) => state.status);
  const editReviewCount = useAgentStore((state) => state.editReviews.length);
  const checkpointedCount = useAgentStore((state) => state.checkpointedPaths.length);

  const contextPaneCollapsed = useAgentsUiStore((state) => state.contextPaneCollapsed);
  const setContextPaneCollapsed = useAgentsUiStore((state) => state.setContextPaneCollapsed);

  useEffect(() => {
    useAgentStore.getState().setModeActive(true);
  }, []);

  useEffect(() => {
    void loadSessions(rootPath);
  }, [loadSessions, rootPath]);

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

  return (
    <div className="relative flex min-h-0 flex-1 gap-1.5 overflow-hidden px-1.5">
      <aside aria-label="Threads" className="flex h-full w-[256px] shrink-0 flex-col">
        <ThreadList />
      </aside>

      <section aria-label="Transcript" className={cn(CARD_CLASS, "flex min-w-0 flex-1 flex-col")}>
        {root ? <PaneTree /> : <AgentsHome />}
      </section>

      <AgentsContextPane />
    </div>
  );
}
