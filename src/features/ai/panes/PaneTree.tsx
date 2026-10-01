"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  Broom,
  ChatCircle,
  Columns,
  Copy,
  GitBranch,
  Robot,
  Rows,
  Stop,
  TerminalWindow,
  Warning,
  X,
} from "@phosphor-icons/react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/shared/components/ui/resizable";
import { cn } from "@/shared/lib/utils";
import { useAIStore } from "@/shared/stores/ai";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useAgentStore, type AgentStatus } from "@/features/agent/store";

import { BrowserPane } from "../browser/BrowserPane";
import { OpenInBrowserButton } from "../browser/OpenInBrowserButton";
import { ChatPanel } from "../components/ChatPanel";
import { TerminalPane } from "../terminal/TerminalPane";
import { getTerminalEntryStatus, requestTerminalStop } from "../terminal/runner";
import { useTerminalStatus } from "../terminal/useTerminalStatus";
import { clearTerminalView, copyTerminalView } from "../terminal/view";
import { ChildRunView } from "../children/ChildRunView";
import { isRunLive, useChildRunsStore } from "../children/runStore";
import { ChatTranscript } from "./ChatTranscript";
import { EmptyLeafView } from "./EmptyLeafView";
import { splitTerminal } from "./launch";
import { SessionTab } from "./SessionTab";
import { buildCloseConfirm, type CloseConfirm, type SessionCloseTarget } from "./sessionClose";
import {
  MAX_PANES,
  MAX_PANES_TITLE,
  type Leaf,
  type PaneNode,
  type SplitNode,
  type SplitZone,
  type TabsNode,
} from "./operations";
import {
  PANE_MIME,
  isPointerOutside,
  resolveDropZone,
  resolveTabIndex,
  usePaneDragStore,
  type DropZone,
} from "./paneDrag";
import { selectLeafCount, selectRoot, useAgentsPanesStore } from "./store";

const MIN_PANE_SIZE = `${160}px`;
const PANE_CHIP =
  "flex h-6 shrink-0 items-center gap-1.5 rounded-full border border-border-subtle bg-bg-surface px-2 text-ui-2xs font-medium text-fg-muted";
const PANE_ICON_BUTTON =
  "flex size-6 shrink-0 items-center justify-center rounded-full text-fg-subtle transition-colors enabled:hover:bg-bg-hover enabled:hover:text-fg-default disabled:opacity-40";

const STATUS_LABELS: Record<AgentStatus, string> = {
  idle: "Idle",
  running: "Running",
  "waiting-approval": "Waiting",
  done: "Done",
  error: "Error",
  cancelled: "Cancelled",
};

const STATUS_DOTS: Record<AgentStatus, string> = {
  idle: "bg-fg-subtle",
  running: "bg-linear-to-r from-brand-from to-brand-to animate-pulse",
  "waiting-approval": "bg-status-warning",
  done: "bg-status-success",
  error: "bg-status-error",
  cancelled: "bg-fg-subtle",
};

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

function LeafContent({ leaf, focused }: { leaf: Leaf; focused: boolean }) {
  const activeChatSessionId = useAIStore((state) => state.activeChatSessionId);
  const session = useAIStore((state) =>
    state.chatSessions.find((item) => item.id === leaf.sessionId),
  );
  const rootPath = useFileExplorerStore((state) => state.rootPath) ?? "default";
  const runningInBackground = useChildRunsStore((state) =>
    leaf.sessionId ? isRunLive(state.runs[leaf.sessionId]) : false,
  );

  if (leaf.browser) return <BrowserPane leafId={leaf.id} />;
  if (leaf.sessionId === null) return <EmptyLeafView leafId={leaf.id} />;
  if (session?.kind === "terminal") {
    return <TerminalPane session={session} workspaceRoot={rootPath} />;
  }
  if (runningInBackground) return <ChildRunView sessionId={leaf.sessionId} />;
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
      if (leaf.browser) return "Browser";
      if (!leaf.sessionId) return "Open a session";
      const session = chatSessions.find((item) => item.id === leaf.sessionId);
      return session?.title ?? "New thread";
    },
    [chatSessions],
  );

  const sourceLeafId = usePaneDragStore((state) => state.sourceLeafId);
  const dropTarget = usePaneDragStore((state) =>
    state.target?.groupId === node.id ? state.target : null,
  );
  const beginDrag = usePaneDragStore((state) => state.begin);
  const endDrag = usePaneDragStore((state) => state.end);
  const [pendingClose, setPendingClose] = useState<{
    leafIds: string[];
    confirm: CloseConfirm;
  } | null>(null);

  const activeLeaf =
    node.children.find((leaf) => leaf.id === node.activeLeafId) ?? node.children[0];
  const focused = node.children.some((leaf) => leaf.id === focusedLeafId);
  const atCap = totalLeaves >= MAX_PANES;
  const activeSession = activeLeaf?.sessionId
    ? chatSessions.find((item) => item.id === activeLeaf.sessionId)
    : undefined;
  const activeBranch = activeSession?.worktree?.branch ?? null;
  const cliManifests = useAIStore((state) => state.cliManifests);
  const terminalSession = activeSession?.kind === "terminal" ? activeSession : null;
  const terminalStatus = useTerminalStatus(terminalSession?.id ?? null);
  const terminalManifest = terminalSession?.cliProviderId
    ? cliManifests.find((item) => item.id === terminalSession.cliProviderId)
    : undefined;
  const terminalLabel =
    terminalStatus.status === "running"
      ? "running"
      : terminalStatus.status === "cancelled"
        ? "cancelled"
        : terminalStatus.exitCode !== null
          ? `exited (${terminalStatus.exitCode})`
          : "exited";

  const handleTabsDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      const { sourceLeafId: source, setTarget } = usePaneDragStore.getState();
      if (!source) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      const tabs = Array.from(
        event.currentTarget.querySelectorAll<HTMLElement>("[data-session-tab]"),
      );
      setTarget({ groupId: node.id, kind: "tab", index: resolveTabIndex(tabs, event.clientX) });
    },
    [node.id],
  );

  const handleContentDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      const { sourceLeafId: source, setTarget } = usePaneDragStore.getState();
      if (!source) return;
      const zone = resolveDropZone(
        event.currentTarget.getBoundingClientRect(),
        event.clientX,
        event.clientY,
      );
      const ownGroup = node.children.some((leaf) => leaf.id === source);
      if (ownGroup && (zone === "center" || node.children.length === 1)) {
        event.dataTransfer.dropEffect = "none";
        setTarget(null);
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setTarget({ groupId: node.id, kind: "zone", zone });
    },
    [node.children, node.id],
  );

  const handleDragLeave = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!isPointerOutside(event.currentTarget, event.clientX, event.clientY)) return;
      const { target, setTarget } = usePaneDragStore.getState();
      if (target?.groupId === node.id) setTarget(null);
    },
    [node.id],
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      const { sourceLeafId: source, target, end } = usePaneDragStore.getState();
      if (!source) return;
      event.preventDefault();
      end();
      if (target?.groupId !== node.id) return;
      if (target.kind === "tab") {
        dockAsTab(rootPath, source, node.id, target.index);
      } else if (target.zone === "center") {
        dockAsTab(rootPath, source, node.id);
      } else {
        splitToward(rootPath, source, node.id, target.zone);
      }
    },
    [dockAsTab, node.id, rootPath, splitToward],
  );

  const requestClose = useCallback(
    (leafIds: string[]) => {
      const targets: SessionCloseTarget[] = leafIds.map((leafId) => {
        const leaf = node.children.find((child) => child.id === leafId);
        const session = leaf?.sessionId
          ? chatSessions.find((item) => item.id === leaf.sessionId)
          : undefined;
        return {
          sessionId: leaf?.sessionId ?? null,
          title: session?.title ?? "New thread",
          kind: session?.kind,
          terminalStatus:
            leaf?.sessionId && session?.kind === "terminal"
              ? getTerminalEntryStatus(leaf.sessionId)
              : null,
        };
      });

      const confirm = buildCloseConfirm(targets, agentStatus, runSessionId);
      if (!confirm) {
        for (const leafId of leafIds) closeLeaf(rootPath, leafId);
        return;
      }
      setPendingClose({ leafIds, confirm });
    },
    [agentStatus, chatSessions, closeLeaf, node.children, rootPath, runSessionId],
  );

  const handleConfirmClose = useCallback(() => {
    if (!pendingClose) return;
    for (const leafId of pendingClose.leafIds) closeLeaf(rootPath, leafId);
    setPendingClose(null);
  }, [closeLeaf, pendingClose, rootPath]);

  if (!activeLeaf) return null;

  const splitHint = terminalManifest ? ` with a new ${terminalManifest.name}` : "";
  const handleSplit = (direction: SplitNode["direction"]) => {
    if (terminalManifest) {
      void splitTerminal(rootPath, activeLeaf.id, direction, terminalManifest).catch(() =>
        toast.error(`Could not start ${terminalManifest.name}`),
      );
      return;
    }
    focusLeaf(rootPath, activeLeaf.id);
    if (direction === "horizontal") splitRight(rootPath);
    else splitDown(rootPath);
  };

  const isRunOwner = activeLeaf.sessionId !== null && activeLeaf.sessionId === runSessionId;
  const isFocused = focusedLeafId === activeLeaf.id;
  const status: AgentStatus =
    isRunOwner || (runSessionId === null && isFocused) ? agentStatus : "idle";

  return (
    <div
      data-pane-group={node.id}
      data-pane-status={status}
      data-pane-focused={focused ? "true" : undefined}
      className="relative flex h-full min-h-0 flex-col overflow-hidden bg-bg-root"
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        className="@container/pane-header flex h-tab shrink-0 items-center gap-2 border-b border-border-subtle px-1.5"
        onDragOver={handleTabsDragOver}
      >
        <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
          {node.children.map((leaf, index) => {
            const isActive = leaf.id === activeLeaf.id;
            const title = titleFor(leaf);
            return (
              <SessionTab
                key={leaf.id}
                title={title}
                isActive={isActive}
                canCloseOthers={node.children.length > 1}
                canCloseToRight={index < node.children.length - 1}
                onSelect={() => selectTab(rootPath, node.id, leaf.id)}
                onClose={() => requestClose([leaf.id])}
                onCloseOthers={() =>
                  requestClose(
                    node.children.filter((child) => child.id !== leaf.id).map((child) => child.id),
                  )
                }
                onCloseToRight={() =>
                  requestClose(node.children.slice(index + 1).map((child) => child.id))
                }
                isDragging={leaf.id === sourceLeafId}
                dropIndicator={
                  dropTarget?.kind !== "tab"
                    ? null
                    : dropTarget.index === index
                      ? "before"
                      : dropTarget.index === node.children.length &&
                          index === node.children.length - 1
                        ? "after"
                        : null
                }
                onDragStart={(event) => {
                  event.dataTransfer.setData(PANE_MIME, leaf.id);
                  event.dataTransfer.effectAllowed = "move";
                  beginDrag(leaf.id);
                }}
                onDragEnd={endDrag}
              />
            );
          })}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {terminalSession ? (
            <>
              <span className={PANE_CHIP} title={terminalManifest?.name ?? "Terminal"}>
                <TerminalWindow size={12} className="shrink-0" />
                <span className="@max-[520px]/pane-header:hidden">
                  {terminalManifest?.name ?? "Terminal"}
                </span>
              </span>
              <span className={PANE_CHIP} data-terminal-status={terminalStatus.status}>
                {terminalLabel}
              </span>
            </>
          ) : activeLeaf.browser ? null : (
            <>
              {activeBranch && (
                <span
                  className={PANE_CHIP}
                  title={
                    activeSession?.worktree
                      ? `${activeSession.worktree.branch} ${activeSession.worktree.path}`
                      : activeBranch
                  }
                >
                  <GitBranch size={12} className="shrink-0" />
                  <span className="max-w-[140px] truncate @max-[560px]/pane-header:hidden">
                    {activeBranch}
                  </span>
                </span>
              )}
              <span className={PANE_CHIP} title={`Mode: ${modeActive ? "Agent" : "Ask"}`}>
                {modeActive ? (
                  <Robot size={12} className="shrink-0" />
                ) : (
                  <ChatCircle size={12} className="shrink-0" />
                )}
                <span className="@max-[460px]/pane-header:hidden">
                  {modeActive ? "Agent" : "Ask"}
                </span>
              </span>
              <span
                className={cn(PANE_CHIP, status === "running" && "text-primary")}
                title={STATUS_LABELS[status]}
              >
                <span
                  className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOTS[status])}
                  aria-hidden="true"
                />
                <span className="@max-[380px]/pane-header:hidden">{STATUS_LABELS[status]}</span>
              </span>
            </>
          )}

          <div className="flex items-center gap-0.5 rounded-full border border-border-subtle p-0.5">
            {terminalSession && (
              <>
                <button
                  type="button"
                  onClick={() => requestTerminalStop(terminalSession.id)}
                  disabled={terminalStatus.status !== "running"}
                  aria-label="Stop"
                  title="Stop"
                  className={cn(PANE_ICON_BUTTON, "enabled:hover:text-status-error")}
                >
                  <Stop size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => copyTerminalView(terminalSession.id)}
                  aria-label="Copy output"
                  title="Copy output"
                  className={PANE_ICON_BUTTON}
                >
                  <Copy size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => clearTerminalView(terminalSession.id)}
                  aria-label="Clear terminal"
                  title="Clear terminal"
                  className={PANE_ICON_BUTTON}
                >
                  <Broom size={13} />
                </button>
              </>
            )}
            {activeSession && (
              <OpenInBrowserButton session={activeSession} className={PANE_ICON_BUTTON} />
            )}
            <button
              type="button"
              onClick={() => handleSplit("horizontal")}
              disabled={atCap}
              aria-label="Split right"
              title={atCap ? MAX_PANES_TITLE : `Split right${splitHint}`}
              className={PANE_ICON_BUTTON}
            >
              <Columns size={13} />
            </button>
            <button
              type="button"
              onClick={() => handleSplit("vertical")}
              disabled={atCap}
              aria-label="Split down"
              title={atCap ? MAX_PANES_TITLE : `Split down${splitHint}`}
              className={PANE_ICON_BUTTON}
            >
              <Rows size={13} />
            </button>
            <button
              type="button"
              onClick={() => requestClose([activeLeaf.id])}
              aria-label="Close pane"
              title="Close pane"
              className={PANE_ICON_BUTTON}
            >
              <X size={13} />
            </button>
          </div>
        </div>
      </div>

      <div className="relative min-h-0 flex-1" onClick={() => focusLeaf(rootPath, activeLeaf.id)}>
        <LeafContent leaf={activeLeaf} focused={focusedLeafId === activeLeaf.id} />
        {sourceLeafId && (
          <div
            className="absolute inset-0 z-20"
            onDragOver={handleContentDragOver}
            aria-hidden="true"
          />
        )}
        {dropTarget?.kind === "zone" && <PaneDropOverlay zone={dropTarget.zone} />}
      </div>

      <AlertDialog
        open={pendingClose !== null}
        onOpenChange={(open) => {
          if (!open) setPendingClose(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <Warning size={20} className="text-status-warning" />
            </AlertDialogMedia>
            <AlertDialogTitle>{pendingClose?.confirm.title}</AlertDialogTitle>
            <AlertDialogDescription>{pendingClose?.confirm.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmClose}>Close</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
          <ResizableHandle
            key={`${child.id}-handle`}
            className="bg-border-subtle hover:bg-primary/50 data-[resize-handle-active]:bg-primary"
          />
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

  if (!root) return null;

  return <PaneNodeView node={root} totalLeaves={totalLeaves} />;
}
