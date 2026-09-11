"use client";

import { useEffect } from "react";

import { useAIStore } from "@/shared/stores/ai";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useAgentStore } from "@/features/agent/store";
import { ThreadList } from "@/features/ai/threads/ThreadList";

import { AgentsContextPane } from "./AgentsContextPane";
import { AgentsHome } from "./AgentsHome";
import { ChatPanel } from "./ChatPanel";
import { shouldAutoOpenContextPane, useAgentsUiStore } from "../store/agentsUi";

export function AgentsWorkspace() {
  const activeChatSessionId = useAIStore((state) => state.activeChatSessionId);
  const loadSessions = useAIStore((state) => state.loadSessions);
  const rootPath = useFileExplorerStore((state) => state.rootPath) ?? "default";

  const agentStatus = useAgentStore((state) => state.status);
  const editReviewCount = useAgentStore((state) => state.editReviews.length);
  const checkpointedCount = useAgentStore((state) => state.checkpointedPaths.length);

  const contextPaneCollapsed = useAgentsUiStore((state) => state.contextPaneCollapsed);
  const setContextPaneCollapsed = useAgentsUiStore((state) => state.setContextPaneCollapsed);

  useEffect(() => {
    void loadSessions(rootPath);
  }, [loadSessions, rootPath]);

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
        {activeChatSessionId ? <ChatPanel /> : <AgentsHome />}
      </section>

      <AgentsContextPane />
    </div>
  );
}
