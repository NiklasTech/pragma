import { useEffect } from "react";

import { useAIStore } from "@/shared/stores/ai";
import { useEditorStore, type FileTab } from "@/shared/stores/editor";
import { useAgentStore } from "@/features/agent/store";

import { runExtensionDiagnostics } from "./diagnostics";
import { broadcastEvent } from "./host";
import { useExtensionsStore } from "./store";

const DIAGNOSTICS_DEBOUNCE_MS = 500;

export interface SessionFinishedEvent {
  sessionId: string;
  title: string;
  status: "done" | "error" | "cancelled";
}

function activeFileTab(): FileTab | null {
  const { tabs, activeTabId } = useEditorStore.getState();
  const tab = tabs.find((item) => item.id === activeTabId);
  return tab && tab.kind === "file" ? tab : null;
}

function diagnoseTab(tab: FileTab): void {
  void runExtensionDiagnostics({
    path: tab.path,
    language: tab.language ?? null,
    text: tab.content,
  });
}

export function notifyFileSaved(path: string, language: string | null): void {
  broadcastEvent("fileSaved", { path, language });
  const tab = activeFileTab();
  if (tab?.path === path) diagnoseTab(tab);
}

export function notifySessionFinished(event: SessionFinishedEvent): void {
  broadcastEvent("sessionFinished", event);
}

/// Feeds editor changes to extensions: active file events and diagnostics runs.
export function useExtensionEventSources(): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const scheduleDiagnostics = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const tab = activeFileTab();
        if (tab) diagnoseTab(tab);
      }, DIAGNOSTICS_DEBOUNCE_MS);
    };

    const unsubscribeEditor = useEditorStore.subscribe((state, previous) => {
      if (state.activeTabId !== previous.activeTabId) {
        const tab = activeFileTab();
        broadcastEvent(
          "activeFileChanged",
          tab
            ? {
                path: tab.path,
                name: tab.name,
                language: tab.language ?? null,
                cursor: state.cursorPositions[tab.id] ?? null,
              }
            : null,
        );
        scheduleDiagnostics();
        return;
      }
      const tab = state.tabs.find((item) => item.id === state.activeTabId);
      const before = previous.tabs.find((item) => item.id === previous.activeTabId);
      if (tab?.kind === "file" && before?.kind === "file" && tab.content !== before.content) {
        scheduleDiagnostics();
      }
    });

    const unsubscribeProviders = useExtensionsStore.subscribe((state, previous) => {
      if (state.diagnosticsProviders !== previous.diagnosticsProviders) scheduleDiagnostics();
    });

    // Agent Mode runs span several chat streams; they finish when the agent store says so.
    const unsubscribeAgent = useAgentStore.subscribe((state, previous) => {
      const wasRunning = previous.status === "running" || previous.status === "waiting-approval";
      const sessionId = previous.runSessionId;
      if (!wasRunning || !sessionId) return;
      if (state.status !== "done" && state.status !== "error" && state.status !== "cancelled") {
        return;
      }
      const title =
        useAIStore.getState().chatSessions.find((session) => session.id === sessionId)?.title ?? "";
      notifySessionFinished({ sessionId, title, status: state.status });
    });

    return () => {
      clearTimeout(timer);
      unsubscribeEditor();
      unsubscribeProviders();
      unsubscribeAgent();
    };
  }, []);
}
