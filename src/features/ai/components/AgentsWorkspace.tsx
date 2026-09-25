"use client";

import { useEffect, useMemo } from "react";

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
    <div className="relative flex min-h-0 flex-1 overflow-hidden">
      <aside
        aria-label="Threads"
        className="flex h-full w-[260px] shrink-0 flex-col border-r border-border/60 bg-bg-surface"
      >
        <ThreadList />
      </aside>

      <section aria-label="Transcript" className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {root ? <PaneTree /> : <AgentsHome />}
      </section>

      <AgentsContextPane />
    </div>
  );
}
