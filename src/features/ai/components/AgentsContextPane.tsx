"use client";

import { useCallback, useState } from "react";
import { CaretDoubleRight, FileText, MagicWand } from "@phosphor-icons/react";

import { useEditorPanelId } from "@/shared/hooks/useEditorPanelId";
import { useAIStore } from "@/shared/stores/ai";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { cn } from "@/shared/lib/utils";
import { CARD_CLASS } from "@/shared/lib/surfaces";
import { useAgentStore } from "@/features/agent/store";
import { AgentReviewPane } from "@/features/agent/components/AgentReviewPane";
import { PanelEmptyState } from "@/shared/components/PanelEmptyState";
import { sessionCwd } from "@/features/ai/worktree/cwd";
import { useUiModeStore } from "@/shell/mode";

import { selectFocusedSessionId, useAgentsPanesStore } from "../panes/store";
import { openWorkspaceFile } from "./openWorkspaceFile";
import { SessionChanges } from "./SessionChanges";
import { useAgentsUiStore } from "../store/agentsUi";

type ContextTab = "review" | "files";

const TABS: Array<{ id: ContextTab; label: string }> = [
  { id: "review", label: "Review" },
  { id: "files", label: "Files" },
];

function toDisplayPath(path: string, rootPath: string | null): string {
  if (!rootPath) return path;
  const prefix = rootPath.endsWith("/") ? rootPath : `${rootPath}/`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

function ContextResizeHandle({ onResize }: { onResize: (delta: number) => void }) {
  const handleMouseDown = (event: React.MouseEvent) => {
    event.preventDefault();
    const startX = event.clientX;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      onResize(moveEvent.clientX - startX);
    };
    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div
      className="absolute top-0 bottom-0 left-0 z-10 w-1 cursor-ew-resize hover:bg-primary/20"
      onMouseDown={handleMouseDown}
      aria-hidden="true"
    />
  );
}

function EmptyReview() {
  return (
    <PanelEmptyState
      icon={MagicWand}
      title="No active run"
      description="Start a thread to see steps, todos and approvals here."
    />
  );
}

function ContextFilesList({ live, displayRoot }: { live: boolean; displayRoot: string }) {
  const checkpointedPaths = useAgentStore((state) => state.checkpointedPaths);
  const editorPanelId = useEditorPanelId();
  const setUiMode = useUiModeStore((state) => state.setUiMode);

  const handleOpen = useCallback(
    async (path: string) => {
      if (await openWorkspaceFile(path, editorPanelId)) setUiMode("editor");
    },
    [editorPanelId, setUiMode],
  );

  if (!live || checkpointedPaths.length === 0) {
    return (
      <p className="px-3 py-4 text-center text-ui-xs text-fg-subtle">
        No files changed in this run.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 p-1.5">
      {checkpointedPaths.map((path) => (
        <button
          key={path}
          type="button"
          onClick={() => void handleOpen(path)}
          title={path}
          className="flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-bg-hover"
        >
          <FileText size={13} className="shrink-0 text-fg-muted" />
          <span className="min-w-0 flex-1 truncate text-ui-xs text-fg-default">
            {toDisplayPath(path, displayRoot)}
          </span>
        </button>
      ))}
    </div>
  );
}

export function AgentsContextPane() {
  const collapsed = useAgentsUiStore((state) => state.contextPaneCollapsed);
  const width = useAgentsUiStore((state) => state.contextPaneWidth);
  const setCollapsed = useAgentsUiStore((state) => state.setContextPaneCollapsed);
  const setWidth = useAgentsUiStore((state) => state.setContextPaneWidth);
  const [tab, setTab] = useState<ContextTab>("review");

  const workspacePath = useFileExplorerStore((state) => state.rootPath) ?? "default";
  const focusedSessionId = useAgentsPanesStore((state) =>
    selectFocusedSessionId(state, workspacePath),
  );
  const runSessionId = useAgentStore((state) => state.runSessionId);
  const chatSessions = useAIStore((state) => state.chatSessions);
  const isLive = focusedSessionId !== null && focusedSessionId === runSessionId;
  const runSession = chatSessions.find((session) => session.id === runSessionId);
  const displayRoot = sessionCwd(runSession, workspacePath);
  const focusedSession = chatSessions.find((session) => session.id === focusedSessionId);
  const focusedCwd = focusedSession ? sessionCwd(focusedSession, workspacePath) : null;

  if (collapsed) return null;

  return (
    <aside
      aria-label="Context"
      style={{ width }}
      className={cn(CARD_CLASS, "relative flex h-full shrink-0 flex-col")}
    >
      <ContextResizeHandle onResize={(delta) => setWidth(width - delta)} />

      <div className="flex h-tab shrink-0 items-center gap-1 border-b border-border-subtle px-1.5">
        {TABS.map((item) => {
          const isActive = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => setTab(item.id)}
              className={cn(
                "h-7 rounded-md px-2.5 text-ui-xs font-medium transition-colors",
                isActive
                  ? "bg-bg-surface text-fg-default ring-1 ring-border"
                  : "text-fg-muted hover:bg-bg-hover hover:text-fg-default",
              )}
            >
              {item.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          aria-label="Collapse context pane"
          title="Collapse context pane"
          className="ml-auto flex size-7 shrink-0 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-bg-hover hover:text-fg-default"
        >
          <CaretDoubleRight size={15} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLive ? (
          tab === "review" ? (
            <AgentReviewPane />
          ) : (
            <ContextFilesList live={isLive} displayRoot={displayRoot} />
          )
        ) : focusedCwd && focusedCwd !== "default" ? (
          <SessionChanges cwd={focusedCwd} action={tab === "review" ? "diff" : "open"} />
        ) : (
          <EmptyReview />
        )}
      </div>
    </aside>
  );
}
