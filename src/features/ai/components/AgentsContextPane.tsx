"use client";

import { useCallback, useState } from "react";
import {
  CaretDoubleLeft,
  CaretDoubleRight,
  CheckCircle,
  FileText,
  Files,
} from "@phosphor-icons/react";

import { useEditorPanelId } from "@/shared/hooks/useEditorPanelId";
import { useEditorStore } from "@/shared/stores/editor";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { cn } from "@/shared/lib/utils";
import { useAgentStore } from "@/features/agent/store";
import { AgentReviewPane } from "@/features/agent/components/AgentReviewPane";
import { useUiModeStore } from "@/shell/mode";

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

function ContextFilesList() {
  const checkpointedPaths = useAgentStore((state) => state.checkpointedPaths);
  const rootPath = useFileExplorerStore((state) => state.rootPath);
  const openFile = useEditorStore((state) => state.openFile);
  const editorPanelId = useEditorPanelId();
  const setUiMode = useUiModeStore((state) => state.setUiMode);

  const handleOpen = useCallback(
    (path: string) => {
      openFile(
        {
          id: path,
          path,
          name: path.split("/").pop() ?? path,
          content: "",
          originalContent: "",
          isModified: false,
        },
        editorPanelId,
      );
      setUiMode("editor");
    },
    [editorPanelId, openFile, setUiMode],
  );

  if (checkpointedPaths.length === 0) {
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
          onClick={() => handleOpen(path)}
          title={path}
          className="flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-bg-hover"
        >
          <FileText size={13} className="shrink-0 text-fg-muted" />
          <span className="min-w-0 flex-1 truncate text-ui-xs text-fg-default">
            {toDisplayPath(path, rootPath)}
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

  if (collapsed) {
    return (
      <aside
        aria-label="Context"
        className="flex h-full w-8 shrink-0 flex-col items-center gap-1 border-l border-border/60 bg-bg-surface py-2"
      >
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          aria-label="Expand context pane"
          title="Expand context pane"
          className="flex size-6 items-center justify-center rounded-sm text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default"
        >
          <CaretDoubleLeft size={13} />
        </button>
        <button
          type="button"
          onClick={() => {
            setTab("review");
            setCollapsed(false);
          }}
          aria-label="Review"
          title="Review"
          className="flex size-6 items-center justify-center rounded-sm text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default"
        >
          <CheckCircle size={13} />
        </button>
        <button
          type="button"
          onClick={() => {
            setTab("files");
            setCollapsed(false);
          }}
          aria-label="Files"
          title="Files"
          className="flex size-6 items-center justify-center rounded-sm text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default"
        >
          <Files size={13} />
        </button>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Context"
      style={{ width }}
      className="relative flex h-full shrink-0 flex-col border-l border-border/60 bg-bg-surface"
    >
      <ContextResizeHandle onResize={(delta) => setWidth(width - delta)} />

      <div className="flex h-8 shrink-0 items-center gap-0.5 border-b border-border/60 px-1">
        {TABS.map((item) => {
          const isActive = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => setTab(item.id)}
              className={cn(
                "h-6 rounded-md px-2 text-ui-xs font-medium transition-colors",
                isActive
                  ? "bg-bg-elevated text-fg-default"
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
          className="ml-auto flex size-6 shrink-0 items-center justify-center rounded-sm text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default"
        >
          <CaretDoubleRight size={13} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "review" ? <AgentReviewPane /> : <ContextFilesList />}
      </div>
    </aside>
  );
}
