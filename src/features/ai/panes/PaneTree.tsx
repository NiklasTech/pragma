"use client";

import { useCallback, useMemo, useState } from "react";
import { Columns, Rows, SquaresFour, X } from "@phosphor-icons/react";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/shared/components/ui/resizable";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { cn } from "@/shared/lib/utils";
import { useAIStore } from "@/shared/stores/ai";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useAgentStore, type AgentStatus } from "@/features/agent/store";

import { ChatPanel } from "../components/ChatPanel";
import { ChatTranscript } from "./ChatTranscript";
import {
  MAX_PANES,
  type Leaf,
  type PaneNode,
  type SplitNode,
  type SplitZone,
  type TabsNode,
} from "./operations";
import { selectLeafCount, selectRoot, useAgentsPanesStore } from "./store";

const PANE_MIME = "application/x-pragma-pane";
const MIN_PANE_SIZE = `${240}px`;
const MAX_PANES_TITLE = "8 panes is the maximum";

const STATUS_LABELS: Record<AgentStatus, string> = {
  idle: "idle",
  running: "running",
  "waiting-approval": "waiting",
  done: "done",
  error: "error",
  cancelled: "cancelled",
};

const STATUS_DOTS: Record<AgentStatus, string> = {
  idle: "bg-fg-subtle",
  running: "bg-status-success animate-pulse",
  "waiting-approval": "bg-status-warning",
  done: "bg-status-success",
  error: "bg-status-error",
  cancelled: "bg-fg-subtle",
};

type DropZone = SplitZone | "center";

function resolveDropZone(event: React.DragEvent<HTMLElement>): DropZone {
  const rect = event.currentTarget.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width;
  const y = (event.clientY - rect.top) / rect.height;
  if (x < 0.25) return "left";
  if (x > 0.75) return "right";
  if (y < 0.25) return "top";
  if (y > 0.75) return "bottom";
  return "center";
}

function PaneDropOverlay({ zone }: { zone: DropZone }) {
  const base = "pointer-events-none absolute z-20 border-2 border-primary bg-primary/10";
  if (zone === "center") return <div className={cn(base, "inset-1")} aria-hidden="true" />;

  const placement: Record<SplitZone, string> = {
    left: "top-1 bottom-1 left-1 w-1/3",
    right: "top-1 right-1 bottom-1 w-1/3",
    top: "top-1 right-1 left-1 h-1/3",
    bottom: "right-1 bottom-1 left-1 h-1/3",
  };

  return <div className={cn(base, placement[zone])} aria-hidden="true" />;
}

function EmptyLeafView({ leafId }: { leafId: string }) {
  const chatSessions = useAIStore((state) => state.chatSessions);
  const rootPath = useFileExplorerStore((state) => state.rootPath) ?? "default";
  const assignSession = useAgentsPanesStore((state) => state.assignSession);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 overflow-y-auto p-6">
      <p className="text-ui-sm font-medium text-fg-muted">Open a session</p>
      {chatSessions.length > 0 && (
        <div className="flex w-full max-w-[280px] flex-col gap-0.5">
          {chatSessions.map((session) => (
            <button
              key={session.id}
              type="button"
              onClick={() => assignSession(rootPath, leafId, session.id)}
              className="truncate rounded-md px-2 py-1.5 text-left text-ui-xs text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default"
            >
              {session.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LeafContent({ leaf, focused }: { leaf: Leaf; focused: boolean }) {
  const activeChatSessionId = useAIStore((state) => state.activeChatSessionId);

  if (leaf.sessionId === null) return <EmptyLeafView leafId={leaf.id} />;
  if (focused && leaf.sessionId === activeChatSessionId) return <ChatPanel hideHeader />;
  return <ChatTranscript sessionId={leaf.sessionId} />;
}

function TabsView({ node, totalLeaves }: { node: TabsNode; totalLeaves: number }) {
  const rootPath = useFileExplorerStore((state) => state.rootPath) ?? "default";
  const focusedLeafId = useAgentsPanesStore(
    (state) => state.trees[rootPath]?.focusedLeafId ?? null,
  );
  const selectTab = useAgentsPanesStore((state) => state.selectTab);
  const focusLeaf = useAgentsPanesStore((state) => state.focusLeaf);
  const closeLeaf = useAgentsPanesStore((state) => state.closeLeaf);
  const splitRight = useAgentsPanesStore((state) => state.splitRight);
  const splitDown = useAgentsPanesStore((state) => state.splitDown);
  const dockAsTab = useAgentsPanesStore((state) => state.dockAsTab);
  const splitToward = useAgentsPanesStore((state) => state.splitToward);
  const modeActive = useAgentStore((state) => state.modeActive);
  const agentStatus = useAgentStore((state) => state.status);
  const runSessionId = useAgentStore((state) => state.runSessionId);
  const chatSessions = useAIStore((state) => state.chatSessions);

  const titleFor = useCallback(
    (leaf: Leaf): string => {
      if (!leaf.sessionId) return "Open a session";
      const session = chatSessions.find((item) => item.id === leaf.sessionId);
      return session?.title ?? "New thread";
    },
    [chatSessions],
  );

  const [dropZone, setDropZone] = useState<DropZone | null>(null);

  const activeLeaf =
    node.children.find((leaf) => leaf.id === node.activeLeafId) ?? node.children[0];
  const focused = node.children.some((leaf) => leaf.id === focusedLeafId);
  const atCap = totalLeaves >= MAX_PANES;

  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!event.dataTransfer.types.includes(PANE_MIME)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      const zone = resolveDropZone(event);
      setDropZone(atCap && zone !== "center" ? "center" : zone);
    },
    [atCap],
  );

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setDropZone(null);
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const sourceLeafId = event.dataTransfer.getData(PANE_MIME);
      const zone = dropZone;
      setDropZone(null);
      if (!sourceLeafId || !zone || !activeLeaf) return;
      if (sourceLeafId === activeLeaf.id) return;
      if (zone === "center") {
        dockAsTab(rootPath, sourceLeafId, activeLeaf.id);
      } else {
        splitToward(rootPath, sourceLeafId, activeLeaf.id, zone);
      }
    },
    [activeLeaf, dockAsTab, dropZone, rootPath, splitToward],
  );

  if (!activeLeaf) return null;

  const isRunOwner = activeLeaf.sessionId !== null && activeLeaf.sessionId === runSessionId;
  const isFocused = focusedLeafId === activeLeaf.id;
  const status: AgentStatus =
    isRunOwner || (runSessionId === null && isFocused) ? agentStatus : "idle";

  return (
    <div
      data-pane-group={node.id}
      data-pane-status={status}
      data-pane-focused={focused ? "true" : undefined}
      className={cn(
        "relative flex h-full min-h-0 flex-col overflow-hidden border bg-bg-root",
        focused ? "border-primary" : "border-border/60",
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex h-8 shrink-0 items-center gap-1 border-b border-border/60 bg-bg-surface px-1">
        <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
          {node.children.map((leaf) => {
            const isActive = leaf.id === activeLeaf.id;
            const title = titleFor(leaf);
            return (
              <button
                key={leaf.id}
                type="button"
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData(PANE_MIME, leaf.id);
                  event.dataTransfer.effectAllowed = "move";
                }}
                onClick={() => selectTab(rootPath, node.id, leaf.id)}
                title={title}
                className={cn(
                  "max-w-[160px] shrink-0 truncate rounded-sm px-1.5 py-1 text-ui-xs transition-colors",
                  isActive
                    ? "bg-bg-elevated font-medium text-fg-default"
                    : "text-fg-muted hover:bg-bg-hover hover:text-fg-default",
                )}
              >
                {title}
              </button>
            );
          })}
        </div>

        <span
          className="shrink-0 rounded-sm bg-bg-hover px-1 text-ui-2xs text-fg-subtle"
          title={`Mode: ${modeActive ? "Agent" : "Ask"}`}
        >
          {modeActive ? "Agent" : "Ask"}
        </span>

        <span className="flex shrink-0 items-center gap-1 text-ui-2xs text-fg-muted">
          <span className={cn("size-1.5 rounded-full", STATUS_DOTS[status])} aria-hidden="true" />
          {STATUS_LABELS[status]}
        </span>

        <button
          type="button"
          onClick={() => {
            focusLeaf(rootPath, activeLeaf.id);
            splitRight(rootPath);
          }}
          disabled={atCap}
          aria-label="Split right"
          title={atCap ? MAX_PANES_TITLE : "Split right"}
          className="flex size-6 shrink-0 items-center justify-center rounded-sm text-fg-muted transition-colors enabled:hover:bg-bg-hover enabled:hover:text-fg-default disabled:opacity-40"
        >
          <Columns size={14} />
        </button>
        <button
          type="button"
          onClick={() => {
            focusLeaf(rootPath, activeLeaf.id);
            splitDown(rootPath);
          }}
          disabled={atCap}
          aria-label="Split down"
          title={atCap ? MAX_PANES_TITLE : "Split down"}
          className="flex size-6 shrink-0 items-center justify-center rounded-sm text-fg-muted transition-colors enabled:hover:bg-bg-hover enabled:hover:text-fg-default disabled:opacity-40"
        >
          <Rows size={14} />
        </button>
        <button
          type="button"
          onClick={() => closeLeaf(rootPath, activeLeaf.id)}
          aria-label="Close pane"
          title="Close pane"
          className="flex size-6 shrink-0 items-center justify-center rounded-sm text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default"
        >
          <X size={14} />
        </button>
      </div>

      <div className="min-h-0 flex-1" onClick={() => focusLeaf(rootPath, activeLeaf.id)}>
        <LeafContent leaf={activeLeaf} focused={focusedLeafId === activeLeaf.id} />
      </div>

      {dropZone && <PaneDropOverlay zone={dropZone} />}
    </div>
  );
}

function SplitView({ node, totalLeaves }: { node: SplitNode; totalLeaves: number }) {
  const rootPath = useFileExplorerStore((state) => state.rootPath) ?? "default";
  const setSplitSizes = useAgentsPanesStore((state) => state.setSplitSizes);
  const orientation = node.direction === "horizontal" ? "horizontal" : "vertical";

  return (
    <ResizablePanelGroup
      id={node.id}
      orientation={orientation}
      className="h-full w-full"
      onLayoutChanged={(layout) => {
        const sizes = node.children.map((child) => layout[child.id] ?? 100 / node.children.length);
        setSplitSizes(rootPath, node.id, sizes);
      }}
    >
      {node.children.flatMap((child, index) => [
        <ResizablePanel
          key={child.id}
          id={child.id}
          defaultSize={`${node.sizes[index] ?? 100 / node.children.length}%`}
          minSize={MIN_PANE_SIZE}
        >
          <PaneNodeView node={child} totalLeaves={totalLeaves} />
        </ResizablePanel>,
        index < node.children.length - 1 ? (
          <ResizableHandle key={`${child.id}-handle`} withHandle />
        ) : null,
      ])}
    </ResizablePanelGroup>
  );
}

function PaneNodeView({ node, totalLeaves }: { node: PaneNode; totalLeaves: number }) {
  if (node.type === "split") return <SplitView node={node} totalLeaves={totalLeaves} />;
  return <TabsView node={node} totalLeaves={totalLeaves} />;
}

export function PaneTree() {
  const rootPath = useFileExplorerStore((state) => state.rootPath) ?? "default";
  const root = useAgentsPanesStore((state) => selectRoot(state, rootPath));
  const totalLeaves = useAgentsPanesStore((state) => selectLeafCount(state, rootPath));
  const applyPreset = useAgentsPanesStore((state) => state.applyPreset);
  const chatSessions = useAIStore((state) => state.chatSessions);

  const sessionIds = useMemo(() => chatSessions.map((session) => session.id), [chatSessions]);

  if (!root) return null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-7 shrink-0 items-center justify-end border-b border-border/60 px-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label="Pane presets"
                title="Pane presets"
                className="flex size-6 items-center justify-center rounded-sm text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default"
              >
                <SquaresFour size={14} />
              </button>
            }
          />
          <DropdownMenuContent align="end" className="min-w-[120px]">
            <DropdownMenuItem onClick={() => applyPreset(rootPath, "focus", sessionIds)}>
              Focus
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => applyPreset(rootPath, "pair", sessionIds)}>
              Pair
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => applyPreset(rootPath, "grid", sessionIds)}>
              Grid
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="min-h-0 flex-1">
        <PaneNodeView node={root} totalLeaves={totalLeaves} />
      </div>
    </div>
  );
}
