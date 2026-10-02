"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Warning } from "@phosphor-icons/react";

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
import { ChatPanel } from "../components/ChatPanel";
import { TerminalPane } from "../terminal/TerminalPane";
import { getTerminalEntryStatus } from "../terminal/runner";
import { ChildRunView } from "../children/ChildRunView";
import { isRunLive, useChildRunsStore } from "../children/runStore";
import { ChatTranscript } from "./ChatTranscript";
import { EmptyLeafView } from "./EmptyLeafView";
import { splitTerminal } from "./launch";
import { usePaneMaximizeStore } from "./maximize";
import { PaneHeader } from "./PaneHeader";
import { buildCloseConfirm, type CloseConfirm, type SessionCloseTarget } from "./sessionClose";
import {
  findGroup,
  findLeafGroup,
  MAX_PANES,
  type Leaf,
  type PaneNode,
  type SplitNode,
  type SplitZone,
  type TabsNode,
} from "./operations";
import { isPointerOutside, resolveDropZone, usePaneDragStore, type DropZone } from "./paneDrag";
import { selectLeafCount, selectRoot, useAgentsPanesStore } from "./store";

const MIN_PANE_SIZE = `${160}px`;

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
  const maximized = usePaneMaximizeStore((state) => state.maximized[rootPath] === node.id);
  const toggleMaximize = usePaneMaximizeStore((state) => state.toggle);
  const agentStatus = useAgentStore((state) => state.status);
  const runSessionId = useAgentStore((state) => state.runSessionId);
  const chatSessions = useAIStore((state) => state.chatSessions);
  const cliManifests = useAIStore((state) => state.cliManifests);

  const sourceLeafId = usePaneDragStore((state) => state.sourceLeafId);
  const dropTarget = usePaneDragStore((state) =>
    state.target?.groupId === node.id ? state.target : null,
  );
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
  const terminalManifest =
    activeSession?.kind === "terminal" && activeSession.cliProviderId
      ? cliManifests.find((item) => item.id === activeSession.cliProviderId)
      : undefined;

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
      data-pane-maximized={maximized ? "true" : undefined}
      className={cn(
        "flex min-h-0 flex-col overflow-hidden bg-bg-root",
        maximized ? "absolute inset-0 z-30" : "relative h-full",
      )}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <PaneHeader
        node={node}
        activeLeaf={activeLeaf}
        focused={focused}
        status={status}
        atCap={atCap}
        maximized={maximized}
        splitHint={splitHint}
        onSelectTab={(leafId) => selectTab(rootPath, node.id, leafId)}
        onRequestClose={requestClose}
        onSplit={handleSplit}
        onToggleMaximize={() => {
          focusLeaf(rootPath, activeLeaf.id);
          toggleMaximize(rootPath, node.id);
        }}
      />

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
  const paneMaximized = usePaneMaximizeStore((state) => rootPath in state.maximized);
  const orientation = node.direction === "horizontal" ? "horizontal" : "vertical";
  const childKey = node.children.map((child) => child.id).join("|");
  // Panels re-register when defaultSize changes, so it only follows the store when children change.
  const [initial, setInitial] = useState({ key: childKey, sizes: node.sizes });
  if (initial.key !== childKey) setInitial({ key: childKey, sizes: node.sizes });
  const defaultSizes = initial.key === childKey ? initial.sizes : node.sizes;

  return (
    <ResizablePanelGroup
      id={node.id}
      orientation={orientation}
      className="h-full w-full"
      disabled={paneMaximized}
      resizeTargetMinimumSize={{ fine: 12, coarse: 24 }}
      onLayoutChanged={(layout, meta) => {
        if (!meta.isUserInteraction) return;
        const sizes = node.children.map((child) => layout[child.id] ?? 100 / node.children.length);
        setSplitSizes(rootPath, node.id, sizes);
      }}
    >
      {node.children.flatMap((child, index) => [
        <ResizablePanel
          key={child.id}
          id={child.id}
          defaultSize={`${defaultSizes[index] ?? 100 / node.children.length}%`}
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

function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.closest("input, textarea, select, .xterm, [role='menu'], [role='dialog']") !== null
  );
}

export function PaneTree() {
  const rootPath = useFileExplorerStore((state) => state.rootPath) ?? "default";
  const root = useAgentsPanesStore((state) => selectRoot(state, rootPath));
  const totalLeaves = useAgentsPanesStore((state) => selectLeafCount(state, rootPath));
  const focusedLeafId = useAgentsPanesStore(
    (state) => state.trees[rootPath]?.focusedLeafId ?? null,
  );
  const maximizedGroupId = usePaneMaximizeStore((state) => state.maximized[rootPath] ?? null);
  const restore = usePaneMaximizeStore((state) => state.restore);

  const focusedGroupId = focusedLeafId ? (findLeafGroup(root, focusedLeafId)?.id ?? null) : null;
  const maximizedExists = maximizedGroupId !== null && findGroup(root, maximizedGroupId) !== null;

  useEffect(() => {
    if (!maximizedGroupId) return;
    // A closed pane, a new pane or focus elsewhere brings the full layout back.
    if (!maximizedExists || (focusedGroupId !== null && focusedGroupId !== maximizedGroupId)) {
      restore(rootPath);
    }
  }, [focusedGroupId, maximizedExists, maximizedGroupId, restore, rootPath]);

  useEffect(() => {
    if (!maximizedGroupId) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || isTextEntry(event.target)) return;
      restore(rootPath);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [maximizedGroupId, restore, rootPath]);

  if (!root) return null;

  return (
    <div data-pane-tree="" className="relative min-h-0 flex-1">
      <PaneNodeView node={root} totalLeaves={totalLeaves} />
    </div>
  );
}
